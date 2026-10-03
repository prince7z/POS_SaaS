import { DiscountType, InventoryMovementType, PaymentMethod, PaymentStatus, Prisma, RefundType, SaleSource, SaleStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { queueTakealotStockSync } from "../../integrations/takealot/client";
import { toPublicMediaUrl } from "../../integrations/aws/media";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { queueInvoiceEmail, queueOrderSuccessEmail } from "../notification";
import { AppError, validationError } from "../../utils/errors";
import * as inventoryRepository from "../inventory/repository";
import * as repository from "./repository";

const uuid = z.string().uuid();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const money = z.coerce.number().min(0);
const positiveMoney = z.coerce.number().gt(0);
const positiveQty = z.coerce.number().gt(0);
const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");

export const saleItemSchema = z.object({ productId: uuid, quantity: positiveQty });
export const saleDraftSchema = z.object({
	source: z.nativeEnum(SaleSource).optional().default(SaleSource.POS),
	customerId: uuid.nullable().optional(),
	items: z.array(saleItemSchema).min(1),
	taxRate: money.optional(),
	discountType: z.nativeEnum(DiscountType).nullable().optional(),
	discountValue: money.nullable().optional(),
	notes: optionalText(2000),
});
export const saleDraftUpdateSchema = saleDraftSchema.partial();
export const saleListSchema = z.object({
	page: pageSchema,
	limit: limitSchema,
	search: z.string().trim().optional(),
	customerId: uuid.optional(),
	paymentStatus: z.nativeEnum(PaymentStatus).optional(),
	status: z.nativeEnum(SaleStatus).optional(),
	source: z.nativeEnum(SaleSource).optional(),
	from: z.string().trim().optional(),
	to: z.string().trim().optional(),
	sortBy: z.enum(["soldAt", "invoiceNumber", "total", "createdAt"]).default("soldAt"),
	sortOrder: sortOrderSchema,
});
export const saleCompletePaymentSchema = z.object({
	paymentMethod: z.nativeEnum(PaymentMethod),
	amount: positiveMoney,
	reference: optionalText(255),
});
export const saleCompleteSchema = z.object({
	taxRate: money.optional(),
	discountType: z.nativeEnum(DiscountType).nullable().optional(),
	discountValue: money.nullable().optional(),
	payments: z.array(saleCompletePaymentSchema).min(1),
	customerId: uuid.nullable().optional(),
	notes: optionalText(2000),
	notifyCustomer: z.boolean().default(false),
	notificationEmail: z.string().trim().email().optional(),
});
export const returnItemSchema = z.object({ saleItemId: uuid, quantity: positiveQty });
export const returnCreateSchema = z.object({
	refundType: z.nativeEnum(RefundType),
	reason: z.string().trim().max(1000).optional(),
	notes: optionalText(2000),
	items: z.array(returnItemSchema).min(1),
});
export const returnListSchema = z.object({
	page: pageSchema,
	limit: limitSchema,
	search: z.string().trim().optional(),
	refundType: z.nativeEnum(RefundType).optional(),
	from: z.string().trim().optional(),
	to: z.string().trim().optional(),
});

const sequenceNames = {
	sale: "sale_invoice_number_sequence",
	return: "sale_return_number_sequence",
} as const;

const parseDecimal = (value: number | string | Prisma.Decimal | null | undefined, fallback = 0) => new Prisma.Decimal(value ?? fallback);
const roundMoney = (value: Prisma.Decimal) => new Prisma.Decimal(value.toFixed(2));
const numberValue = (value: unknown): number => Number(value);
const safeAudit = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
	const result = schema.safeParse(value);
	if (!result.success) throw validationError(result.error.issues[0]?.message ?? "Invalid request");
	return result.data;
};
export { parse };

const error = (code: string, message: string, statusCode = 400) => new AppError(message, statusCode, code);
const pageData = (page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });

const combineItems = (items: Array<z.infer<typeof saleItemSchema>>) => {
	const map = new Map<string, number>();
	for (const item of items) map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
	return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity }));
};

const calculateTotals = (items: Array<{ quantity: number; unitPrice: Prisma.Decimal }>, taxRate: number, discountType?: DiscountType | null, discountValue?: number | null) => {
	const subtotal = roundMoney(items.reduce((sum, item) => sum.plus(parseDecimal(item.unitPrice).times(item.quantity)), new Prisma.Decimal(0)));
	const taxAmount = roundMoney(subtotal.times(taxRate).div(100));
	const grossTotal = subtotal.plus(taxAmount);
	const discountAmount = discountType === DiscountType.PERCENT
		? roundMoney(grossTotal.times(parseDecimal(discountValue ?? 0)).div(100))
		: discountType === DiscountType.FIXED
			? roundMoney(parseDecimal(discountValue ?? 0))
			: new Prisma.Decimal(0);
	if (discountAmount.greaterThan(grossTotal)) throw error("DISCOUNT_EXCEEDS_TOTAL", "Discount cannot exceed total");
	const total = roundMoney(grossTotal.minus(discountAmount));
	return { subtotal, taxAmount, discountAmount, total };
};

const saleItemView = (item: any) => ({
	id: item.id,
	productId: item.productId,
	productName: item.productName,
	sku: item.sku,
	barcode: item.barcode,
	quantity: numberValue(item.quantity),
	unitPrice: numberValue(item.unitPrice),
	...(item.unitCost !== undefined && { unitCost: numberValue(item.unitCost) }),
	lineSubtotal: numberValue(item.lineSubtotal),
});

const salePaymentView = (payment: any) => ({
	id: payment.id,
	paymentMethod: payment.paymentMethod,
	amount: numberValue(payment.amount),
	reference: payment.reference,
	paidAt: payment.paidAt,
});

const saleSummaryView = (sale: any) => ({
	id: sale.id,
	invoiceNumber: sale.invoiceNumber,
	customer: sale.customer ? { id: sale.customer.id, name: sale.customer.name, phone: sale.customer.phone, email: sale.customer.email } : null,
	cashier: sale.cashier ? { id: sale.cashier.id, name: sale.cashier.fullName } : null,
	status: sale.status,
	paymentStatus: sale.paymentStatus,
	subtotal: numberValue(sale.subtotal),
	taxAmount: numberValue(sale.taxAmount),
	discountAmount: numberValue(sale.discountAmount),
	total: numberValue(sale.total),
	paidAmount: numberValue(sale.paidAmount),
	balanceDue: numberValue(sale.balanceDue),
	soldAt: sale.soldAt,
});

const saleDetailView = (sale: any) => ({
	id: sale.id,
	invoiceNumber: sale.invoiceNumber,
	source: sale.source,
	status: sale.status,
	paymentStatus: sale.paymentStatus,
	customer: sale.customer ? { id: sale.customer.id, name: sale.customer.name, phone: sale.customer.phone, email: sale.customer.email, ...(sale.customer.profileImageKey !== undefined && { profileImageUrl: sale.customer.profileImageKey ? toPublicMediaUrl(sale.customer.profileImageKey) : null }) } : null,
	cashier: sale.cashier ? { id: sale.cashier.id, name: sale.cashier.fullName } : null,
	items: sale.items.map((item: any) => saleItemView(item)),
	payments: sale.payments.map((payment: any) => salePaymentView(payment)),
	subtotal: numberValue(sale.subtotal),
	taxRate: numberValue(sale.taxRate),
	taxAmount: numberValue(sale.taxAmount),
	discountType: sale.discountType,
	discountValue: sale.discountValue === null ? null : numberValue(sale.discountValue),
	discountAmount: numberValue(sale.discountAmount),
	total: numberValue(sale.total),
	paidAmount: numberValue(sale.paidAmount),
	balanceDue: numberValue(sale.balanceDue),
	notes: sale.notes,
	soldAt: sale.soldAt,
});

export const getPublicInvoice = async (identifier: string) => {
	const sale = await repository.findPublicSale(prisma, identifier);
	if (!sale) throw error("INVOICE_NOT_FOUND", "Invoice not found", 404);
	return {
		...saleDetailView(sale),
		company: {
			...sale.company,
			logoUrl: sale.company.logoKey ? toPublicMediaUrl(sale.company.logoKey) : null,
			logoKey: undefined,
		},
		items: sale.items.map((item: any) => ({
			...saleItemView(item),
			imageUrl: item.product.imageKeys[0] ? toPublicMediaUrl(item.product.imageKeys[0]) : null,
		})),
	};
};

const returnView = (value: any) => ({
	id: value.id,
	returnNumber: value.returnNumber,
	saleId: value.saleId,
	invoiceNumber: value.sale?.invoiceNumber ?? null,
	customer: value.customer ? { id: value.customer.id, name: value.customer.name, phone: value.customer.phone, imageUrl: value.customer.profileImageKey ? toPublicMediaUrl(value.customer.profileImageKey) : null } : null,
	refundType: value.refundType,
	refundAmount: numberValue(value.refundAmount),
	status: value.status,
	processedBy: value.processor ? { id: value.processor.id, name: value.processor.fullName } : null,
	processedAt: value.processedAt,
	items: value.items?.map((item: any) => ({
		id: item.id,
		saleItemId: item.saleItemId,
		productId: item.productId,
		quantity: numberValue(item.quantity),
		unitRefundPrice: numberValue(item.unitRefundPrice),
		refundAmount: numberValue(item.refundAmount),
		reason: item.reason,
		notes: item.notes,
		productName: item.product?.name ?? null,
		sku: item.product?.sku ?? null,
		imageUrl: item.product?.imageKeys?.[0] ? toPublicMediaUrl(item.product.imageKeys[0]) : null,
	})) ?? undefined,
});

const createSequenceNumber = async (tx: Prisma.TransactionClient, sequenceName: string, prefix: string) => {
	await tx.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "${sequenceName}" START WITH 1001 INCREMENT BY 1`);
	const rows = await tx.$queryRawUnsafe<Array<{ value: bigint }>>(`SELECT nextval('"${sequenceName}"')::bigint AS value`);
	return `${prefix}${rows[0]?.value.toString() ?? "0"}`;
};

const lockCustomer = async (tx: Prisma.TransactionClient, companyId: string, customerId: string) => {
	await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Customer" WHERE "id" = ${customerId} AND "companyId" = ${companyId} AND "deletedAt" IS NULL FOR UPDATE`);
	return repository.findCustomerById(tx, companyId, customerId);
};

const resolveSaleItems = async (tx: Prisma.TransactionClient, companyId: string, items: Array<z.infer<typeof saleItemSchema>>) => {
	const combined = combineItems(items);
	const productIds = combined.map((item) => item.productId);
	const products = await repository.findProductsByIds(tx, companyId, productIds);
	if (products.length !== productIds.length) throw error("PRODUCT_NOT_FOUND", "One or more products are invalid", 404);
	const productMap = new Map(products.map((product) => [product.id, product]));
	return combined.map((item) => {
		const product = productMap.get(item.productId);
		if (!product) throw error("PRODUCT_NOT_FOUND", "Product not found", 404);
		if (!product.isActive || product.deletedAt) throw error("PRODUCT_NOT_AVAILABLE", "Product is not available", 400);
		return {
			productId: product.id,
			productName: product.name,
			sku: product.sku,
			barcode: product.barcode,
			quantity: item.quantity,
			unitPrice: numberValue(product.sellingPrice),
		};
	});
};

const recalcSaleState = (items: Array<{ quantity: number; unitPrice: number }>, taxRate: number, discountType?: DiscountType | null, discountValue?: number | null) => {
	const decimals = items.map((item) => ({ quantity: item.quantity, unitPrice: new Prisma.Decimal(item.unitPrice) }));
	return calculateTotals(decimals, taxRate, discountType, discountValue);
};

const getCompanyWalkIn = async (companyId: string) => repository.findWalkInCustomer(prisma, companyId);

export const createSaleDraft = async (companyId: string, userId: string, input: z.infer<typeof saleDraftSchema>) => {
	const draftId = randomUUID();
	const source = input.source ?? SaleSource.POS;
	const customerId = input.customerId ?? null;
	const taxRate = input.taxRate ?? 0;
	const combinedItems = combineItems(input.items);
	const items = await prisma.$transaction(async (tx) => {
		const resolved = await resolveSaleItems(tx, companyId, input.items);
		if (customerId) {
			const customer = await repository.findCustomerById(tx, companyId, customerId);
			if (!customer) throw error("CUSTOMER_NOT_FOUND", "Customer not found", 404);
		}
		const totals = recalcSaleState(resolved, taxRate, input.discountType ?? null, input.discountValue ?? null);
		const sale = await repository.createSale(tx, {
			id: draftId,
			companyId,
			invoiceNumber: `DRAFT-${draftId}`,
			customerId,
			cashierId: userId,
			source,
			status: SaleStatus.DRAFT,
			paymentStatus: PaymentStatus.PENDING,
			soldAt: new Date(),
			subtotal: totals.subtotal,
			taxRate,
			taxAmount: totals.taxAmount,
			discountType: input.discountType ?? null,
			discountValue: input.discountValue ?? null,
			discountAmount: totals.discountAmount,
			total: totals.total,
			paidAmount: 0,
			balanceDue: totals.total,
			notes: input.notes ?? null,
		});
		for (const item of resolved) {
			await repository.createSaleItem(tx, {
				saleId: sale.id,
				productId: item.productId,
				productName: item.productName,
				sku: item.sku,
				barcode: item.barcode,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				unitCost: 0,
				lineSubtotal: item.quantity * item.unitPrice,
			});
		}
		await repository.createAuditLog(tx, {
			companyId,
			actorUserId: userId,
			action: "SALE_DRAFT_CREATED",
			entityType: "Sale",
			entityId: sale.id,
			afterData: safeAudit({ subtotal: totals.subtotal.toString(), total: totals.total.toString() }),
		});
		return repository.findSaleById(tx, companyId, sale.id);
	});
	if (!items) throw error("SALE_NOT_FOUND", "Sale not found", 404);
	return {
		id: items.id,
		source: items.source,
		status: items.status,
		paymentStatus: items.paymentStatus,
		customer: items.customer ? { id: items.customer.id, name: items.customer.name } : null,
		items: items.items.map((item: any) => ({
			id: item.id,
			productId: item.productId,
			productName: item.productName,
			sku: item.sku,
			barcode: item.barcode,
			quantity: numberValue(item.quantity),
			unitPrice: numberValue(item.unitPrice),
			lineSubtotal: numberValue(item.lineSubtotal),
		})),
		subtotal: numberValue(items.subtotal),
		taxRate: numberValue(items.taxRate),
		taxAmount: numberValue(items.taxAmount),
		discountType: items.discountType,
		discountValue: items.discountValue === null ? null : numberValue(items.discountValue),
		discountAmount: numberValue(items.discountAmount),
		total: numberValue(items.total),
		paidAmount: numberValue(items.paidAmount),
		balanceDue: numberValue(items.balanceDue),
	};
};

export const updateSaleDraft = async (companyId: string, userId: string, saleId: string, input: z.infer<typeof saleDraftUpdateSchema>) => {
	const sale = await repository.findSaleById(prisma, companyId, saleId);
	if (!sale) throw error("SALE_NOT_FOUND", "Sale not found", 404);
	if (sale.status !== SaleStatus.DRAFT) throw error("SALE_NOT_EDITABLE", "Sale is not editable", 409);
	const updated = await prisma.$transaction(async (tx) => {
		const current = await repository.lockSale(tx, companyId, saleId);
		if (!current) throw error("SALE_NOT_FOUND", "Sale not found", 404);
		if (current.status !== SaleStatus.DRAFT) throw error("SALE_NOT_EDITABLE", "Sale is not editable", 409);
		const existingItems = input.items ? await resolveSaleItems(tx, companyId, input.items) : null;
		const nextCustomerId = input.customerId === undefined ? current.customerId : input.customerId;
		let nextTaxRate = input.taxRate === undefined ? numberValue(current.taxRate) : input.taxRate;
		let nextDiscountType = input.discountType === undefined ? current.discountType : input.discountType;
		let nextDiscountValue = input.discountValue === undefined ? (current.discountValue === null ? null : numberValue(current.discountValue)) : input.discountValue;
		let nextNotes = input.notes === undefined ? current.notes : input.notes;
		let recalculated = {
			subtotal: current.subtotal,
			taxAmount: current.taxAmount,
			discountAmount: current.discountAmount,
			total: current.total,
		};
		if (existingItems) {
			recalculated = recalcSaleState(existingItems, nextTaxRate, nextDiscountType, nextDiscountValue);
			await repository.deleteSaleItems(tx, saleId);
			for (const item of existingItems) {
				await repository.createSaleItem(tx, {
					saleId,
					productId: item.productId,
					productName: item.productName,
					sku: item.sku,
					barcode: item.barcode,
					quantity: item.quantity,
					unitPrice: item.unitPrice,
					unitCost: 0,
					lineSubtotal: item.quantity * item.unitPrice,
				});
			}
		}
		if (nextCustomerId) {
			const customer = await repository.findCustomerById(tx, companyId, nextCustomerId);
			if (!customer) throw error("CUSTOMER_NOT_FOUND", "Customer not found", 404);
		}
		await repository.updateSale(tx, saleId, {
			customerId: nextCustomerId ?? null,
			taxRate: nextTaxRate,
			discountType: nextDiscountType,
			discountValue: nextDiscountValue,
			notes: nextNotes ?? null,
			subtotal: recalculated.subtotal,
			taxAmount: recalculated.taxAmount,
			discountAmount: recalculated.discountAmount,
			total: recalculated.total,
			balanceDue: recalculated.total,
		});
		await repository.createAuditLog(tx, {
			companyId,
			actorUserId: userId,
			action: "SALE_DRAFT_UPDATED",
			entityType: "Sale",
			entityId: saleId,
			afterData: safeAudit({ taxRate: nextTaxRate, discountType: nextDiscountType, discountValue: nextDiscountValue }),
		});
		return repository.findSaleById(tx, companyId, saleId);
	});
	if (!updated) throw error("SALE_NOT_FOUND", "Sale not found", 404);
	return saleDetailView(updated);
};

export const listSales = async (companyId: string, input: z.infer<typeof saleListSchema>) => {
	const where: Prisma.SaleWhereInput = {
		companyId,
		...(input.customerId && { customerId: input.customerId }),
		...(input.paymentStatus && { paymentStatus: input.paymentStatus }),
		...(input.status && { status: input.status }),
		...(input.source && { source: input.source }),
		...(input.from || input.to ? { soldAt: { ...(input.from && { gte: new Date(input.from) }), ...(input.to && { lte: new Date(input.to) }) } } : {}),
		...(input.search ? {
			OR: [
				{ invoiceNumber: { contains: input.search, mode: "insensitive" } },
				{ customer: { is: { name: { contains: input.search, mode: "insensitive" } } } },
				{ customer: { is: { phone: { contains: input.search, mode: "insensitive" } } } },
			],
		} : {}),
	};
	const [items, total] = await Promise.all([
		repository.listSales(prisma, where, (input.page - 1) * input.limit, input.limit, input.sortBy, input.sortOrder),
		repository.countSales(prisma, where),
	]);
	return { items: items.map(saleSummaryView), pagination: pageData(input.page, input.limit, total) };
};

export const getSale = async (companyId: string, saleId: string) => {
	const sale = await repository.findSaleById(prisma, companyId, saleId);
	if (!sale) throw error("SALE_NOT_FOUND", "Sale not found", 404);
	return saleDetailView(sale);
};

export const completeSale = async (companyId: string, userId: string, saleId: string, input: z.infer<typeof saleCompleteSchema>) => {
	const result = await prisma.$transaction(async (tx) => {
		const sale = await repository.lockSale(tx, companyId, saleId);
		if (!sale) throw error("SALE_NOT_FOUND", "Sale not found", 404);
		if (sale.status === SaleStatus.COMPLETED) throw error("SALE_ALREADY_COMPLETED", "Sale is already completed", 409);
		if (sale.status === SaleStatus.CANCELLED) throw error("SALE_ALREADY_CANCELLED", "Sale is cancelled", 409);
		if (sale.status !== SaleStatus.DRAFT) throw error("SALE_NOT_EDITABLE", "Sale is not editable", 409);

		const saleItems = await tx.saleItem.findMany({ where: { saleId }, orderBy: { createdAt: "asc" } });
		if (saleItems.length === 0) throw error("SALE_NOT_EDITABLE", "Sale has no items", 409);
		await repository.lockSaleItems(tx, saleId);
		const productIds = [...new Set(saleItems.map((item) => item.productId))];
		const products = [];
		for (const productId of [...productIds].sort()) {
			const product = await inventoryRepository.lockProduct(tx, companyId, productId);
			if (!product) throw error("PRODUCT_NOT_FOUND", "Product not found", 404);
			if (!product.isActive || product.deletedAt) throw error("PRODUCT_NOT_AVAILABLE", "Product is not available", 400);
			products.push(product);
		}
		const productMap = new Map(products.map((product) => [product.id, product]));
		for (const item of saleItems) {
			const product = productMap.get(item.productId);
			if (!product) throw error("PRODUCT_NOT_FOUND", "Product not found", 404);
			if (numberValue(product.stockQuantity) < numberValue(item.quantity)) throw error("INSUFFICIENT_STOCK", "Insufficient stock", 409);
		}

		const customerId = input.customerId ?? sale.customerId ?? null;
		const finalCustomer = customerId ? await lockCustomer(tx, companyId, customerId) : await getCompanyWalkIn(companyId);
		if (!finalCustomer) throw error("CUSTOMER_NOT_FOUND", "Customer not found", 404);
		if (customerId && !finalCustomer.isWalkIn && !finalCustomer.isActive) throw error("CUSTOMER_NOT_FOUND", "Customer not found", 404);

		const taxRate = input.taxRate ?? numberValue(sale.taxRate);
		const discountType = input.discountType === undefined ? sale.discountType : input.discountType;
		const discountValue = input.discountValue === undefined ? (sale.discountValue === null ? null : numberValue(sale.discountValue)) : input.discountValue;
		const totals = calculateTotals(saleItems.map((item) => ({ quantity: numberValue(item.quantity), unitPrice: item.unitPrice })), taxRate, discountType, discountValue);

		const paymentTotals = input.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
		if (paymentTotals.greaterThan(totals.total)) throw error("PAYMENT_EXCEEDS_TOTAL", "Payment exceeds sale total", 409);

		const storeCreditPayments = input.payments.filter((payment) => payment.paymentMethod === PaymentMethod.STORE_CREDIT);
		if (storeCreditPayments.length > 0) {
			if (!customerId || finalCustomer.isWalkIn) throw error("CUSTOMER_REQUIRED_FOR_CREDIT", "Customer is required for store credit", 400);
			const storeCreditTotal = storeCreditPayments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
			if (storeCreditTotal.greaterThan(parseDecimal(finalCustomer.storeCreditBalance))) throw error("STORE_CREDIT_INSUFFICIENT", "Store credit balance is insufficient", 409);
		}

		const balanceDue = roundMoney(totals.total.minus(paymentTotals));
		if (balanceDue.lessThan(0)) throw error("PAYMENT_EXCEEDS_TOTAL", "Payment exceeds sale total", 409);
		const needsCustomerCredit = balanceDue.greaterThan(0);
		if (needsCustomerCredit) {
			if (!customerId || finalCustomer.isWalkIn) throw error("CUSTOMER_REQUIRED_FOR_CREDIT", "Customer is required for credit sales", 400);
			const projected = parseDecimal(finalCustomer.creditBalance).plus(balanceDue);
			if (projected.greaterThan(parseDecimal(finalCustomer.creditLimit))) throw error("CREDIT_LIMIT_EXCEEDED", "Credit limit exceeded", 409);
		}

		const invoiceNumber = await createSequenceNumber(tx, sequenceNames.sale, "INV-");
		const operationId = randomUUID();
		const productChanges: Array<{ productId: string; stockBefore: Prisma.Decimal; stockAfter: Prisma.Decimal; averageCost: Prisma.Decimal }> = [];
		for (const item of saleItems) {
			const product = productMap.get(item.productId)!;
			const quantity = parseDecimal(item.quantity);
			const stockBefore = parseDecimal(product.stockQuantity);
			const stockAfter = stockBefore.minus(quantity);
			productChanges.push({ productId: product.id, stockBefore, stockAfter, averageCost: parseDecimal(product.averageCost) });
		}

		for (const item of saleItems) {
			const product = productMap.get(item.productId)!;
			const stockBefore = parseDecimal(product.stockQuantity);
			const stockAfter = stockBefore.minus(item.quantity);
			await tx.product.update({ where: { id: product.id }, data: { stockQuantity: stockAfter, } });
			await inventoryRepository.createMovement(tx, {
				companyId,
				productId: product.id,
				movementType: InventoryMovementType.SALE,
				quantityChange: new Prisma.Decimal(0).minus(item.quantity),
				quantityBefore: stockBefore,
				quantityAfter: stockAfter,
				unitCost: product.averageCost,
				operationId,
				referenceType: "SALE",
				referenceId: sale.id,
				createdBy: userId,
				reason: "Sale completion",
			});
		}

		await repository.deleteSaleItems(tx, saleId);
		for (const item of saleItems) {
			const product = productMap.get(item.productId)!;
			await repository.createSaleItem(tx, {
				saleId,
				productId: product.id,
				productName: product.name,
				sku: product.sku,
				barcode: product.barcode,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				unitCost: product.averageCost,
				lineSubtotal: numberValue(item.quantity) * numberValue(item.unitPrice),
			});
		}
		for (const payment of input.payments) {
			await repository.createSalePayment(tx, {
				saleId,
				paymentMethod: payment.paymentMethod,
				amount: payment.amount,
				reference: payment.reference ?? null,
				paidAt: new Date(),
				createdBy: userId,
			});
		}

		if (customerId && !finalCustomer.isWalkIn) {
			const currentCredit = parseDecimal(finalCustomer.creditBalance);
			const currentStoreCredit = parseDecimal(finalCustomer.storeCreditBalance);
			const creditUpdate = needsCustomerCredit ? currentCredit.plus(balanceDue) : currentCredit;
			const storeCreditSpent = storeCreditPayments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
			const storeCreditUpdate = currentStoreCredit.minus(storeCreditSpent);
			await tx.customer.update({
				where: { id: finalCustomer.id },
				data: {
					creditBalance: creditUpdate,
					storeCreditBalance: storeCreditUpdate,
				},
			});
		}

		await repository.updateSale(tx, saleId, {
			invoiceNumber,
			customerId: finalCustomer.id,
			source: sale.source,
			status: SaleStatus.COMPLETED,
			paymentStatus: balanceDue.equals(0) ? PaymentStatus.PAID : PaymentStatus.PENDING,
			soldAt: new Date(),
			subtotal: totals.subtotal,
			taxRate,
			taxAmount: totals.taxAmount,
			discountType,
			discountValue,
			discountAmount: totals.discountAmount,
			total: totals.total,
			paidAmount: paymentTotals,
			balanceDue,
			notes: input.notes ?? sale.notes,
		});
		await repository.createAuditLog(tx, {
			companyId,
			actorUserId: userId,
			action: "SALE_COMPLETED",
			entityType: "Sale",
			entityId: saleId,
			metadata: safeAudit({ invoiceNumber, operationId }),
		});
		return { sale: await repository.findSaleById(tx, companyId, saleId), productIds: [...productMap.values()].filter((product) => product.takealotSync && product.takealotProductId).map((product) => ({ id: product.id, takealotProductId: product.takealotProductId as string, stockQuantity: 0 })) };
	});

	if (!result.sale) throw error("SALE_NOT_FOUND", "Sale not found", 404);

	const refreshedProducts = await prisma.product.findMany({ where: { id: { in: result.productIds.map((product) => product.id) } }, select: { id: true, takealotSync: true, takealotProductId: true, stockQuantity: true } });
	await Promise.allSettled([
		...(refreshedProducts.filter((product) => product.takealotSync && product.takealotProductId).map((product) => queueTakealotStockSync({ companyId, productId: product.id, takealotProductId: product.takealotProductId!, quantity: numberValue(product.stockQuantity) }))),
		...(result.sale.customer && !result.sale.customer.isWalkIn && result.sale.customer.email ? [repository.createEmailLog(prisma, {
			companyId,
			customerId: result.sale.customer.id,
			emailType: "INVOICE",
			recipientEmail: result.sale.customer.email,
			recipientName: result.sale.customer.name,
			subject: `Invoice ${result.sale.invoiceNumber}`,
			bodyText: `Your invoice ${result.sale.invoiceNumber} is ready.`,
			entityType: "Sale",
			entityId: result.sale.id,
			status: "QUEUED",
		})] : []),
	]);
	if (input.notifyCustomer) {
		const recipientEmail = input.notificationEmail ?? (result.sale.customer && !result.sale.customer.isWalkIn ? result.sale.customer.email : null);
		if (recipientEmail) {
			await queueOrderSuccessEmail({
				companyId,
				orderId: result.sale.id,
				invoiceNumber: result.sale.invoiceNumber,
				email: recipientEmail,
				name: result.sale.customer?.name,
				customerId: result.sale.customer?.id,
				triggeredBy: "pos-checkout",
			}).catch(() => undefined);
		}
	}

	return saleDetailView(result.sale);
};

export const sendInvoice = async (companyId: string, userId: string, invoiceId: string, notificationEmail?: string) => {
	const sale = await repository.findSaleById(prisma, companyId, invoiceId);
	if (!sale || sale.status !== SaleStatus.COMPLETED) throw error("INVOICE_NOT_FOUND", "Invoice not found", 404);
	const recipientEmail = notificationEmail ?? (sale.customer && !sale.customer.isWalkIn ? sale.customer.email : null);
	if (!recipientEmail) throw error("INVOICE_RECIPIENT_REQUIRED", "A customer email or recipient email is required", 400);
	await queueInvoiceEmail({
		companyId,
		invoiceId: sale.id,
		invoiceNumber: sale.invoiceNumber,
		email: recipientEmail,
		name: sale.customer?.name,
		customerId: sale.customer?.id,
		triggeredBy: userId,
	});
	return { queued: true, invoiceId: sale.id, recipientEmail };
};

export const cancelSale = async (companyId: string, userId: string, saleId: string) => {
	const sale = await prisma.$transaction(async (tx) => {
		const current = await repository.lockSale(tx, companyId, saleId);
		if (!current) throw error("SALE_NOT_FOUND", "Sale not found", 404);
		if (current.status !== SaleStatus.DRAFT) throw error("SALE_NOT_EDITABLE", "Only draft sales can be cancelled", 409);
		await repository.updateSale(tx, saleId, { status: SaleStatus.CANCELLED });
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "SALE_DRAFT_CANCELLED", entityType: "Sale", entityId: saleId });
		return repository.findSaleById(tx, companyId, saleId);
	});
	if (!sale) throw error("SALE_NOT_FOUND", "Sale not found", 404);
	return saleDetailView(sale);
};

export const getReturnableItems = async (companyId: string, saleId: string) => {
	const sale = await repository.findReturnableSale(prisma, companyId, saleId);
	if (!sale) throw error("RETURN_NOT_ALLOWED", "Return is not allowed", 400);
	return {
		saleId: sale.id,
		invoiceNumber: sale.invoiceNumber,
		soldAt: sale.soldAt,
		total: numberValue(sale.total),
		customer: sale.customer ? { id: sale.customer.id, name: sale.customer.name, phone: sale.customer.phone, imageUrl: sale.customer.profileImageKey ? toPublicMediaUrl(sale.customer.profileImageKey) : null } : null,
		items: sale.items.map((item: any) => {
			const returnedQuantity = item.returnItems.reduce((sum: Prisma.Decimal, entry: any) => sum.plus(entry.quantity), new Prisma.Decimal(0));
			const soldQuantity = parseDecimal(item.quantity);
			const returnableQuantity = soldQuantity.minus(returnedQuantity);
			return {
				saleItemId: item.id,
				productId: item.productId,
				productName: item.productName,
				sku: item.sku,
				imageUrl: item.product?.imageKeys?.[0] ? toPublicMediaUrl(item.product.imageKeys[0]) : null,
				soldQuantity: numberValue(soldQuantity),
				returnedQuantity: numberValue(returnedQuantity),
				returnableQuantity: numberValue(returnableQuantity),
				unitPrice: numberValue(item.unitPrice),
			};
		}),
	};
};

export const listReturnsForSale = async (companyId: string, saleId: string) => {
	const sale = await repository.findSaleById(prisma, companyId, saleId);
	if (!sale) throw error("SALE_NOT_FOUND", "Sale not found", 404);
	const returns = await repository.findReturnBySale(prisma, companyId, saleId);
	return {
		items: returns.map((item: any) => returnView(item)),
	};
};

export const createReturn = async (companyId: string, userId: string, saleId: string, input: z.infer<typeof returnCreateSchema>) => {
	const result = await prisma.$transaction(async (tx) => {
		const sale = await repository.lockSale(tx, companyId, saleId);
		if (!sale) throw error("SALE_NOT_FOUND", "Sale not found", 404);
		if (sale.status !== SaleStatus.COMPLETED) throw error("RETURN_NOT_ALLOWED", "Return is not allowed", 400);
		const saleItems = await tx.saleItem.findMany({ where: { saleId }, include: { returnItems: true } });
		await repository.lockSaleItems(tx, saleId);
		const productIds = [...new Set(saleItems.map((item) => item.productId))];
		const products = [];
		for (const productId of [...productIds].sort()) {
			const product = await inventoryRepository.lockProduct(tx, companyId, productId);
			if (!product) throw error("PRODUCT_NOT_FOUND", "Product not found", 404);
			products.push(product);
		}
		const saleItemMap = new Map(saleItems.map((item) => [item.id, item]));
		const requestedQuantities = new Map<string, Prisma.Decimal>();
		for (const item of input.items) {
			const quantity = parseDecimal(item.quantity);
			requestedQuantities.set(item.saleItemId, (requestedQuantities.get(item.saleItemId) ?? new Prisma.Decimal(0)).plus(quantity));
		}
		let refundAmount = new Prisma.Decimal(0);
		const requestedItems = [...requestedQuantities.entries()].map(([saleItemId, quantity]) => {
			const saleItem = saleItemMap.get(saleItemId);
			if (!saleItem) throw error("RETURN_NOT_ALLOWED", "Sale item is invalid", 400);
			const returnedQuantity = saleItem.returnItems.reduce((sum: Prisma.Decimal, entry: any) => sum.plus(entry.quantity), new Prisma.Decimal(0));
			const soldQuantity = parseDecimal(saleItem.quantity);
			const remainingQuantity = soldQuantity.minus(returnedQuantity);
			if (quantity.lte(0)) throw error("RETURN_QUANTITY_EXCEEDED", "Return quantity must be greater than zero", 400);
			if (quantity.gt(remainingQuantity)) throw error("RETURN_QUANTITY_EXCEEDED", "Return quantity exceeds available quantity", 409);
			const lineRefund = roundMoney(quantity.times(saleItem.unitPrice));
			refundAmount = refundAmount.plus(lineRefund);
			return { saleItem, quantity, lineRefund };
		});
		refundAmount = roundMoney(refundAmount);
		const paidAmount = parseDecimal(sale.paidAmount);
		if (refundAmount.gt(paidAmount)) throw error("RETURN_AMOUNT_EXCEEDED_PAID_AMOUNT", "Return amount exceeds paid amount", 409);

		const customer = sale.customerId ? await lockCustomer(tx, companyId, sale.customerId) : null;
		if (input.refundType === RefundType.STORE_CREDIT) {
			if (!customer) throw error("RETURN_CUSTOMER_REQUIRED", "Customer is required for store credit", 400);
			if (customer.isWalkIn) throw error("STORE_CREDIT_NOT_ALLOWED_FOR_WALKIN", "Walk-in customer cannot receive store credit", 409);
			await tx.customer.update({ where: { id: customer.id }, data: { storeCreditBalance: parseDecimal(customer.storeCreditBalance).plus(refundAmount) } });
		}

		const returnNumber = await createSequenceNumber(tx, sequenceNames.return, "RET-");
		const returnRecord = await repository.createReturn(tx, {
			companyId,
			returnNumber,
			saleId,
			customerId: sale.customerId,
			reason: input.reason ?? "Return processed",
			notes: input.notes ?? null,
			refundType: input.refundType,
			refundAmount,
			status: "COMPLETED",
			processedBy: userId,
			processedAt: new Date(),
		});
		for (const item of requestedItems) {
			await repository.createReturnItem(tx, {
				returnId: returnRecord.id,
				saleItemId: item.saleItem.id,
				productId: item.saleItem.productId,
				quantity: item.quantity,
				unitRefundPrice: item.saleItem.unitPrice,
				refundAmount: item.lineRefund,
			});
			const product = products.find((entry) => entry.id === item.saleItem.productId)!;
			const stockBefore = parseDecimal(product.stockQuantity);
			const stockAfter = stockBefore.plus(item.quantity);
			await tx.product.update({ where: { id: product.id }, data: { stockQuantity: stockAfter } });
			await inventoryRepository.createMovement(tx, {
				companyId,
				productId: product.id,
				movementType: InventoryMovementType.RETURN,
				quantityChange: item.quantity,
				quantityBefore: stockBefore,
				quantityAfter: stockAfter,
				unitCost: product.averageCost,
				operationId: returnRecord.id,
				referenceType: "RETURN",
				referenceId: returnRecord.id,
				reason: input.reason ?? "Return processed",
				note: input.notes ?? null,
				createdBy: userId,
			});
		}
		await repository.createAuditLog(tx, {
			companyId,
			actorUserId: userId,
			action: "RETURN_PROCESSED",
			entityType: "Return",
			entityId: returnRecord.id,
			metadata: safeAudit({ refundType: input.refundType, refundAmount: refundAmount.toString() }),
		});
		return { returnRecord, productIds: [...new Set(requestedItems.map((item) => item.saleItem.productId))], customer };
	});

	const refreshedReturnProducts = await prisma.product.findMany({ where: { id: { in: result.productIds } }, select: { id: true, takealotSync: true, takealotProductId: true, stockQuantity: true } });
	await Promise.allSettled([
		...refreshedReturnProducts.filter((product) => product.takealotSync && product.takealotProductId).map((product) => queueTakealotStockSync({ companyId, productId: product.id, takealotProductId: product.takealotProductId!, quantity: numberValue(product.stockQuantity) })),
		...(result.returnRecord.refundType === RefundType.STORE_CREDIT && result.customer?.email ? [repository.createEmailLog(prisma, {
			companyId,
			customerId: result.customer.id,
			emailType: "CREDIT",
			recipientEmail: result.customer.email,
			recipientName: result.customer.name,
			subject: `Store credit for return ${result.returnRecord.returnNumber}`,
			bodyText: `A store credit of ${numberValue(result.returnRecord.refundAmount)} has been issued.`,
			entityType: "Return",
			entityId: result.returnRecord.id,
			status: "QUEUED",
		})] : []),
	]);

	return returnView(await repository.findReturnBySale(prisma, companyId, saleId).then((returns) => returns.find((value) => value.id === result.returnRecord.id) ?? result.returnRecord));
};

export const listReturns = async (companyId: string, input: z.infer<typeof returnListSchema>) => {
	const where: Prisma.ReturnWhereInput = {
		companyId,
		...(input.refundType && { refundType: input.refundType }),
		...(input.from || input.to ? { createdAt: { ...(input.from && { gte: new Date(input.from) }), ...(input.to && { lte: new Date(input.to) }) } } : {}),
		...(input.search ? {
			OR: [
				{ returnNumber: { contains: input.search, mode: "insensitive" } },
				{ sale: { is: { invoiceNumber: { contains: input.search, mode: "insensitive" } } } },
				{ customer: { is: { name: { contains: input.search, mode: "insensitive" } } } },
				{ customer: { is: { phone: { contains: input.search, mode: "insensitive" } } } },
			],
		} : {}),
	};
	const [items, total] = await Promise.all([
		repository.listReturns(prisma, where, (input.page - 1) * input.limit, input.limit),
		repository.countReturns(prisma, where),
	]);
	return {
		items: items.map((item: any) => ({
			id: item.id,
			returnNumber: item.returnNumber,
			invoiceNumber: item.sale?.invoiceNumber ?? null,
			customer: item.customer ? { id: item.customer.id, name: item.customer.name, phone: item.customer.phone, imageUrl: item.customer.profileImageKey ? toPublicMediaUrl(item.customer.profileImageKey) : null } : null,
			items: item.items?.map((returnItem: any) => ({ productId: returnItem.productId, productName: returnItem.product?.name ?? null, sku: returnItem.product?.sku ?? null, imageUrl: returnItem.product?.imageKeys?.[0] ? toPublicMediaUrl(returnItem.product.imageKeys[0]) : null, quantity: numberValue(returnItem.quantity), refundAmount: numberValue(returnItem.refundAmount) })) ?? [],
			refundType: item.refundType,
			refundAmount: numberValue(item.refundAmount),
			reason: item.reason,
			notes: item.notes,
			status: item.status,
			processedBy: item.processor ? { id: item.processor.id, name: item.processor.fullName } : null,
			processedAt: item.processedAt,
		})),
		pagination: pageData(input.page, input.limit, total),
	};
};

export const returnSummary = async (companyId: string, input: Pick<z.infer<typeof returnListSchema>, "from" | "to" | "refundType">) => {
	const where: Prisma.ReturnWhereInput = {
		companyId,
		...(input.refundType && { refundType: input.refundType }),
		...(input.from || input.to ? { processedAt: { ...(input.from && { gte: new Date(`${input.from}T00:00:00.000Z`) }), ...(input.to && { lte: new Date(`${input.to}T23:59:59.999Z`) }) } } : {}),
	};
	const rows = await prisma.return.findMany({ where, select: { status: true, refundAmount: true, items: { select: { quantity: true } } } });
	return {
		totalReturns: rows.length,
		totalRefunded: rows.reduce((sum, row) => sum + numberValue(row.refundAmount), 0),
		totalItemsReturned: rows.reduce((sum, row) => sum + row.items.reduce((itemSum, item) => itemSum + numberValue(item.quantity), 0), 0),
		pendingReturns: rows.filter((row) => row.status !== "COMPLETED").length,
	};
};
