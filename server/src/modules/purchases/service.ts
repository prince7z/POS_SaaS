import { InventoryMovementType, PaymentMethod, Prisma, PurchaseOrderStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { queueTakealotStockSync } from "../../integrations/takealot/client";
import { toPublicMediaUrl } from "../../integrations/aws/media";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
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

export const supplierListSchema = z.object({
	page: pageSchema,
	limit: limitSchema,
	search: z.string().trim().optional(),
	includeInactive: z.enum(["true", "false"]).transform((value) => value === "true").optional().default("false" as never),
	includeStats: z.enum(["true", "false"]).transform((value) => value === "true").optional().default("false" as never),
});
export const supplierSchema = z.object({
	name: z.string().trim().min(1).max(150),
	contactPerson: optionalText(150),
	phone: optionalText(50),
	email: optionalText(255),
	website: optionalText(255),
	addressLine1: optionalText(255),
	addressLine2: optionalText(255),
	city: optionalText(100),
	state: optionalText(100),
	postalCode: optionalText(30),
	paymentTermsDays: z.coerce.number().int().min(0).default(0),
	creditLimit: money.default(0),
	bankName: optionalText(150),
	accountName: optionalText(150),
	accountNumber: optionalText(150),
});
export const supplierUpdateSchema = supplierSchema.partial();
export const purchaseItemSchema = z.object({ productId: uuid, quantity: positiveQty, unitCost: money });
export const purchaseCreateSchema = z.object({
	supplierId: uuid,
	expectedDate: z.string().trim().optional(),
	taxRate: money.optional(),
	notes: optionalText(2000),
	items: z.array(purchaseItemSchema).min(1),
});
export const purchaseUpdateSchema = purchaseCreateSchema.partial();
export const purchaseListSchema = z.object({
	page: pageSchema,
	limit: limitSchema,
	search: z.string().trim().optional(),
	supplierId: uuid.optional(),
	status: z.enum([PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.PENDING, PurchaseOrderStatus.PARTIALLY_RECEIVED, PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.CANCELLED]).optional(),
	from: z.string().trim().optional(),
	to: z.string().trim().optional(),
	sortBy: z.enum(["orderDate", "poNumber", "total", "createdAt"]).default("orderDate"),
	sortOrder: sortOrderSchema,
});
export const receiveItemSchema = z.object({ purchaseOrderItemId: uuid, quantityReceived: positiveQty });
export const receivePurchaseSchema = z.object({ items: z.array(receiveItemSchema).min(1), notes: optionalText(2000) });
export const supplierPaymentSchema = z.object({
	amount: positiveMoney,
	paymentMethod: z.enum([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.BANK_TRANSFER, PaymentMethod.OTHER]),
	reference: optionalText(255),
	notes: optionalText(2000),
});
export const paymentListSchema = z.object({ page: pageSchema, limit: limitSchema });

const sequenceNames = {
	purchaseOrder: "purchase_order_number_sequence",
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

const supplierView = (supplier: any) => ({
	id: supplier.id,
	name: supplier.name,
	contactPerson: supplier.contactPerson,
	phone: supplier.phone,
	email: supplier.email,
	website: supplier.website,
	addressLine1: supplier.addressLine1,
	addressLine2: supplier.addressLine2,
	city: supplier.city,
	state: supplier.state,
	postalCode: supplier.postalCode,
	paymentTermsDays: supplier.paymentTermsDays,
	creditLimit: numberValue(supplier.creditLimit),
	bankName: supplier.bankName,
	accountName: supplier.accountName,
	accountNumber: supplier.accountNumber,
	isActive: supplier.isActive,
	createdAt: supplier.createdAt,
	updatedAt: supplier.updatedAt,
	...(supplier.stats ? { stats: supplier.stats } : {}),
});

const purchaseItemView = (item: any) => ({
	id: item.id,
	productId: item.productId,
	productName: item.product?.name ?? item.productName,
	sku: item.product?.sku ?? item.sku,
	imageUrl: item.product?.imageKeys?.[0] ? toPublicMediaUrl(item.product.imageKeys[0]) : null,
	orderedQuantity: numberValue(item.orderedQuantity),
	receivedQuantity: numberValue(item.receivedQuantity),
	remainingQuantity: numberValue(item.orderedQuantity) - numberValue(item.receivedQuantity),
	unitCost: numberValue(item.unitCost),
	lineTotal: numberValue(item.lineTotal),
});

const purchaseSummaryView = (order: any) => ({
	id: order.id,
	poNumber: order.poNumber,
	supplier: order.supplier ? { id: order.supplier.id, name: order.supplier.name } : null,
	status: order.status,
	orderDate: order.orderDate,
	expectedDate: order.expectedDate,
	subtotal: numberValue(order.subtotal),
	taxAmount: numberValue(order.taxAmount),
	total: numberValue(order.total),
	paidAmount: numberValue(order.paidAmount),
	balanceDue: numberValue(order.balanceDue),
});

const purchaseDetailView = (order: any) => ({
	id: order.id,
	poNumber: order.poNumber,
	status: order.status,
	supplier: order.supplier ? { id: order.supplier.id, name: order.supplier.name } : null,
	items: order.items.map((item: any) => purchaseItemView(item)),
	subtotal: numberValue(order.subtotal),
	taxAmount: numberValue(order.taxAmount),
	total: numberValue(order.total),
	paidAmount: numberValue(order.paidAmount),
	balanceDue: numberValue(order.balanceDue),
	orderDate: order.orderDate,
	expectedDate: order.expectedDate,
	notes: order.notes,
});

const paymentView = (payment: any) => ({
	id: payment.id,
	amount: numberValue(payment.amount),
	paymentMethod: payment.paymentMethod,
	reference: payment.reference,
	paidAt: payment.paidAt,
	createdBy: payment.creator ? { id: payment.creator.id, name: payment.creator.fullName } : null,
});

const combineItems = (items: Array<z.infer<typeof purchaseItemSchema>>) => {
	const map = new Map<string, { quantity: Prisma.Decimal; unitCost: Prisma.Decimal }>();
	for (const item of items) {
		const current = map.get(item.productId);
		if (!current) {
			map.set(item.productId, { quantity: parseDecimal(item.quantity), unitCost: parseDecimal(item.unitCost) });
			continue;
		}
		if (!current.unitCost.equals(parseDecimal(item.unitCost))) throw error("DUPLICATE_PURCHASE_ITEM", "Duplicate products must use the same unit cost or be combined before saving");
		current.quantity = current.quantity.plus(item.quantity);
	}
	return [...map.entries()].map(([productId, value]) => ({ productId, quantity: value.quantity, unitCost: value.unitCost }));
};

const calculateTotals = (items: Array<{ quantity: Prisma.Decimal; unitCost: Prisma.Decimal }>, taxRate = 0) => {
	const subtotal = roundMoney(items.reduce((sum, item) => sum.plus(item.quantity.times(item.unitCost)), new Prisma.Decimal(0)));
	const taxAmount = roundMoney(subtotal.times(taxRate).div(100));
	const total = roundMoney(subtotal.plus(taxAmount));
	return { subtotal, taxAmount, total };
};

const createSequenceNumber = async (tx: Prisma.TransactionClient, sequenceName: string, prefix: string) => {
	await tx.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "${sequenceName}" START WITH 1001 INCREMENT BY 1`);
	const rows = await tx.$queryRawUnsafe<Array<{ value: bigint }>>(`SELECT nextval('"${sequenceName}"')::bigint AS value`);
	return `${prefix}${rows[0]?.value.toString() ?? "0"}`;
};

const lockSupplier = async (tx: Prisma.TransactionClient, companyId: string, supplierId: string) => {
	await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Supplier" WHERE "id" = ${supplierId} AND "companyId" = ${companyId} FOR UPDATE`);
	return repository.findSupplierById(tx, companyId, supplierId);
};

const lockPurchaseOrderItems = async (tx: Prisma.TransactionClient, purchaseOrderId: string) => {
	await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = ${purchaseOrderId} ORDER BY "id" FOR UPDATE`);
	return tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } });
};

const lockProducts = async (tx: Prisma.TransactionClient, companyId: string, productIds: string[]) => {
	const products = [];
	for (const productId of [...productIds].sort()) {
		const product = await inventoryRepository.lockProduct(tx, companyId, productId);
		if (!product) throw error("PRODUCT_NOT_FOUND", "Product not found", 404);
		products.push(product);
	}
	return products;
};

export const listSuppliers = async (companyId: string, input: z.infer<typeof supplierListSchema>) => {
	const where: Prisma.SupplierWhereInput = {
		companyId,
		...(input.includeInactive ? {} : { isActive: true }),
		...(input.search ? {
			OR: [
				{ name: { contains: input.search, mode: "insensitive" } },
				{ phone: { contains: input.search, mode: "insensitive" } },
				{ email: { contains: input.search, mode: "insensitive" } },
				{ contactPerson: { contains: input.search, mode: "insensitive" } },
			],
		} : {}),
	};
	const [items, total] = await Promise.all([
		repository.listSuppliers(prisma, where, (input.page - 1) * input.limit, input.limit, "asc"),
		repository.countSuppliers(prisma, where),
	]);
	const supplierIds = items.map((item) => item.id);
	const [orderStats, paymentStats] = input.includeStats && supplierIds.length ? await Promise.all([
		prisma.purchaseOrder.groupBy({ by: ["supplierId"], where: { companyId, supplierId: { in: supplierIds }, status: { not: "CANCELLED" } }, _count: { _all: true }, _sum: { total: true, balanceDue: true } }),
		prisma.supplierPayment.groupBy({ by: ["supplierId"], where: { companyId, supplierId: { in: supplierIds } }, _sum: { amount: true } }),
	]) : [[], []];
	const orders = new Map(orderStats.map((row) => [row.supplierId, row]));
	const payments = new Map(paymentStats.map((row) => [row.supplierId, row]));
	return { items: items.map((item) => supplierView({ ...item, stats: input.includeStats ? { totalOrders: orders.get(item.id)?._count._all ?? 0, totalPurchaseValue: numberValue(orders.get(item.id)?._sum.total), pendingAmount: numberValue(orders.get(item.id)?._sum.balanceDue) } : undefined })), pagination: pageData(input.page, input.limit, total) };
};

export const supplierSummary = async (companyId: string) => {
	const [totalSuppliers, activeSuppliers, purchases, payments] = await Promise.all([
		prisma.supplier.count({ where: { companyId } }),
		prisma.supplier.count({ where: { companyId, isActive: true } }),
		prisma.purchaseOrder.aggregate({ where: { companyId, status: { not: "CANCELLED" } }, _sum: { total: true } }),
		prisma.purchaseOrder.aggregate({ where: { companyId, status: { not: "CANCELLED" } }, _sum: { balanceDue: true } }),
	]);
	return { totalSuppliers, activeSuppliers, totalPurchaseValue: numberValue(purchases._sum.total), pendingPayments: numberValue(payments._sum.balanceDue) };
};

export const getSupplier = async (companyId: string, supplierId: string) => {
	const supplier = await repository.findSupplierById(prisma, companyId, supplierId);
	if (!supplier) throw error("SUPPLIER_NOT_FOUND", "Supplier not found", 404);
	const [purchaseTotals, purchaseCount, paymentTotals] = await Promise.all([
		prisma.purchaseOrder.aggregate({ where: { companyId, supplierId, status: { not: "CANCELLED" } }, _sum: { total: true } }),
		prisma.purchaseOrder.count({ where: { companyId, supplierId, status: { not: "CANCELLED" } } }),
		prisma.supplierPayment.aggregate({ where: { companyId, supplierId }, _sum: { amount: true } }),
	]);
	const totalPurchaseValue = numberValue(purchaseTotals._sum.total ?? 0);
	const totalPaid = numberValue(paymentTotals._sum.amount ?? 0);
	return { ...supplierView(supplier), stats: { totalOrders: purchaseCount, totalPurchaseValue, pendingAmount: totalPurchaseValue - totalPaid }, totalPurchaseValue, totalPaid, outstandingBalance: totalPurchaseValue - totalPaid };
};

export const createSupplier = async (companyId: string, userId: string, input: z.infer<typeof supplierSchema>) => {
	if (await repository.findSupplierByName(prisma, companyId, input.name)) throw error("SUPPLIER_ALREADY_EXISTS", "Supplier name already exists", 409);
	const supplier = await prisma.$transaction(async (tx) => {
		const created = await repository.createSupplier(tx, {
			companyId,
			name: input.name,
			contactPerson: input.contactPerson ?? "",
			phone: input.phone ?? "",
			email: input.email ?? "",
			website: input.website ?? null,
			addressLine1: input.addressLine1 ?? "",
			addressLine2: input.addressLine2 ?? null,
			city: input.city ?? "",
			state: input.state ?? "",
			postalCode: input.postalCode ?? "",
			paymentTermsDays: input.paymentTermsDays,
			creditLimit: input.creditLimit,
			bankName: input.bankName ?? null,
			accountName: input.accountName ?? null,
			accountNumber: input.accountNumber ?? null,
		});
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "SUPPLIER_CREATED", entityType: "Supplier", entityId: created.id, afterData: safeAudit({ name: created.name }) });
		return created;
	});
	return supplierView(supplier);
};

export const updateSupplier = async (companyId: string, userId: string, supplierId: string, input: z.infer<typeof supplierUpdateSchema>) => {
	const before = await repository.findSupplierById(prisma, companyId, supplierId);
	if (!before) throw error("SUPPLIER_NOT_FOUND", "Supplier not found", 404);
	if (input.name && await repository.findSupplierByName(prisma, companyId, input.name, supplierId)) throw error("SUPPLIER_ALREADY_EXISTS", "Supplier name already exists", 409);
	const updated = await prisma.$transaction(async (tx) => {
		const next = await repository.updateSupplier(tx, supplierId, {
			...(input.name !== undefined && { name: input.name }),
			...(input.contactPerson !== undefined && { contactPerson: input.contactPerson ?? "" }),
			...(input.phone !== undefined && { phone: input.phone ?? "" }),
			...(input.email !== undefined && { email: input.email ?? "" }),
			...(input.website !== undefined && { website: input.website }),
			...(input.addressLine1 !== undefined && { addressLine1: input.addressLine1 ?? "" }),
			...(input.addressLine2 !== undefined && { addressLine2: input.addressLine2 }),
			...(input.city !== undefined && { city: input.city ?? "" }),
			...(input.state !== undefined && { state: input.state ?? "" }),
			...(input.postalCode !== undefined && { postalCode: input.postalCode ?? "" }),
			...(input.paymentTermsDays !== undefined && { paymentTermsDays: input.paymentTermsDays }),
			...(input.creditLimit !== undefined && { creditLimit: input.creditLimit }),
			...(input.bankName !== undefined && { bankName: input.bankName }),
			...(input.accountName !== undefined && { accountName: input.accountName }),
			...(input.accountNumber !== undefined && { accountNumber: input.accountNumber }),
		});
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "SUPPLIER_UPDATED", entityType: "Supplier", entityId: supplierId, beforeData: safeAudit({ name: before.name }), afterData: safeAudit({ name: next.name }) });
		return next;
	});
	return supplierView(updated);
};

export const deleteSupplier = async (companyId: string, userId: string, supplierId: string) => {
	const supplier = await repository.findSupplierById(prisma, companyId, supplierId);
	if (!supplier) throw error("SUPPLIER_NOT_FOUND", "Supplier not found", 404);
	const count = await repository.countActivePurchaseOrdersForSupplier(prisma, companyId, supplierId);
	if (count > 0) throw error("SUPPLIER_HAS_ACTIVE_ORDERS", "Supplier has active purchase orders", 409);
	await prisma.$transaction(async (tx) => {
		await repository.softDeleteSupplier(tx, supplierId);
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "SUPPLIER_DELETED", entityType: "Supplier", entityId: supplierId });
	});
};

export const listPurchaseOrders = async (companyId: string, input: z.infer<typeof purchaseListSchema>) => {
	const where: Prisma.PurchaseOrderWhereInput = {
		companyId,
		...(input.supplierId && { supplierId: input.supplierId }),
		...(input.status && { status: input.status }),
		...(input.from || input.to ? { orderDate: { ...(input.from && { gte: new Date(input.from) }), ...(input.to && { lte: new Date(input.to) }) } } : {}),
		...(input.search ? {
			OR: [
				{ poNumber: { contains: input.search, mode: "insensitive" } },
				{ supplier: { is: { name: { contains: input.search, mode: "insensitive" } } } },
			],
		} : {}),
	};

	const [items, total] = await Promise.all([
		repository.listPurchaseOrders(prisma, where, (input.page - 1) * input.limit, input.limit, input.sortBy, input.sortOrder),
		repository.countPurchaseOrders(prisma, where),
	]);
	return { items: items.map(purchaseSummaryView), pagination: pageData(input.page, input.limit, total) };
};

export const purchaseOrderSummary = async (companyId: string) => {
	const [orders, spend, pending] = await Promise.all([
		prisma.purchaseOrder.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } }),
		prisma.purchaseOrder.aggregate({ where: { companyId, status: { not: PurchaseOrderStatus.CANCELLED } }, _sum: { total: true } }),
		prisma.purchaseOrder.aggregate({ where: { companyId, status: { in: [PurchaseOrderStatus.PENDING, PurchaseOrderStatus.PARTIALLY_RECEIVED] } }, _sum: { balanceDue: true } }),
	]);
	return { totalOrders: orders.reduce((sum, row) => sum + row._count._all, 0), totalSpend: numberValue(spend._sum.total), pendingAmount: numberValue(pending._sum.balanceDue), byStatus: orders.map((row) => ({ status: row.status, count: row._count._all })) };
};

export const getPurchaseOrder = async (companyId: string, orderId: string) => {
	const order = await repository.findPurchaseOrderById(prisma, companyId, orderId);
	if (!order) throw error("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found", 404);
	return purchaseDetailView(order);
};

export const createPurchaseOrder = async (companyId: string, userId: string, input: z.infer<typeof purchaseCreateSchema>) => {
	const order = await prisma.$transaction(async (tx) => {
		const supplier = await lockSupplier(tx, companyId, input.supplierId);
		if (!supplier || !supplier.isActive) throw error("SUPPLIER_NOT_FOUND", "Supplier not found", 404);
		const combinedItems = combineItems(input.items);
		const products = await lockProducts(tx, companyId, combinedItems.map((item) => item.productId));
		const productMap = new Map(products.map((product) => [product.id, product]));
		for (const item of combinedItems) {
			const product = productMap.get(item.productId);
			if (!product || !product.isActive || product.deletedAt) throw error("PRODUCT_NOT_FOUND", "Product not found", 404);
		}
		const totals = calculateTotals(combinedItems, input.taxRate ?? 0);
		const id = randomUUID();
		const poNumber = await createSequenceNumber(tx, sequenceNames.purchaseOrder, "PO-");
		const created = await repository.createPurchaseOrder(tx, {
			id,
			companyId,
			supplierId: input.supplierId,
			poNumber,
			status: PurchaseOrderStatus.DRAFT,
			orderDate: new Date(),
			expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
			subtotal: totals.subtotal,
			taxAmount: totals.taxAmount,
			total: totals.total,
			paidAmount: 0,
			balanceDue: totals.total,
			notes: input.notes ?? null,
			createdBy: userId,
		});
		for (const item of combinedItems) {
			await repository.createPurchaseOrderItem(tx, {
				purchaseOrderId: created.id,
				productId: item.productId,
				orderedQuantity: item.quantity,
				receivedQuantity: 0,
				unitCost: item.unitCost,
				lineTotal: item.quantity.times(item.unitCost),
			});
		}
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "PURCHASE_ORDER_CREATED", entityType: "PurchaseOrder", entityId: created.id, afterData: safeAudit({ poNumber: created.poNumber }) });
		return repository.findPurchaseOrderById(tx, companyId, created.id);
	});
	if (!order) throw error("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found", 404);
	return purchaseDetailView(order);
};

export const updatePurchaseOrder = async (companyId: string, userId: string, orderId: string, input: z.infer<typeof purchaseUpdateSchema>) => {
	const current = await repository.findPurchaseOrderById(prisma, companyId, orderId);
	if (!current) throw error("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found", 404);
	if (current.status !== PurchaseOrderStatus.DRAFT && input.items) throw error("PURCHASE_ORDER_NOT_EDITABLE", "Purchase order is not editable", 409);
	const updated = await prisma.$transaction(async (tx) => {
		const order = await repository.lockPurchaseOrder(tx, companyId, orderId);
		if (!order) throw error("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found", 404);
		if (order.status !== PurchaseOrderStatus.DRAFT && input.items) throw error("PURCHASE_ORDER_NOT_EDITABLE", "Purchase order is not editable", 409);
		if (input.supplierId) {
			const supplier = await lockSupplier(tx, companyId, input.supplierId);
			if (!supplier || !supplier.isActive) throw error("SUPPLIER_NOT_FOUND", "Supplier not found", 404);
		}
		const nextItems = input.items ? combineItems(input.items) : null;
		const currentTaxRate = numberValue(order.subtotal) === 0 ? 0 : (numberValue(order.taxAmount) / numberValue(order.subtotal)) * 100;
		const nextTaxRate = input.taxRate ?? currentTaxRate;
		let totals = {
			subtotal: order.subtotal,
			taxAmount: order.taxAmount,
			total: order.total,
		};
		if (nextItems) {
			const products = await lockProducts(tx, companyId, nextItems.map((item) => item.productId));
			const productMap = new Map(products.map((product) => [product.id, product]));
			for (const item of nextItems) {
				const product = productMap.get(item.productId);
				if (!product || !product.isActive || product.deletedAt) throw error("PRODUCT_NOT_FOUND", "Product not found", 404);
			}
			totals = calculateTotals(nextItems, nextTaxRate);
			await repository.deletePurchaseOrderItems(tx, orderId);
			for (const item of nextItems) {
				await repository.createPurchaseOrderItem(tx, {
					purchaseOrderId: orderId,
					productId: item.productId,
					orderedQuantity: item.quantity,
					receivedQuantity: 0,
					unitCost: item.unitCost,
					lineTotal: item.quantity.times(item.unitCost),
				});
			}
		} else if (input.taxRate !== undefined) {
			const existingItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: orderId } });
			const baseItems = existingItems.map((item) => ({ quantity: parseDecimal(item.orderedQuantity), unitCost: parseDecimal(item.unitCost) }));
			totals = calculateTotals(baseItems, nextTaxRate);
		}
		await repository.updatePurchaseOrder(tx, orderId, {
			...(input.supplierId && { supplierId: input.supplierId }),
			...(input.expectedDate !== undefined && { expectedDate: input.expectedDate ? new Date(input.expectedDate) : null }),
			...((input.taxRate !== undefined || nextItems) && { subtotal: totals.subtotal, taxAmount: totals.taxAmount, total: totals.total, balanceDue: totals.total }),
			...(input.notes !== undefined && { notes: input.notes }),
		});
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "PURCHASE_ORDER_UPDATED", entityType: "PurchaseOrder", entityId: orderId });
		return repository.findPurchaseOrderById(tx, companyId, orderId);
	});
	if (!updated) throw error("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found", 404);
	return purchaseDetailView(updated);
};

export const receivePurchaseOrder = async (companyId: string, userId: string, orderId: string, input: z.infer<typeof receivePurchaseSchema>) => {
	const result = await prisma.$transaction(async (tx) => {
		const order = await repository.lockPurchaseOrder(tx, companyId, orderId);
		if (!order) throw error("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found", 404);
		if (order.status === PurchaseOrderStatus.CANCELLED) throw error("PURCHASE_ORDER_CANCELLED", "Purchase order is cancelled", 409);
		if (order.status === PurchaseOrderStatus.RECEIVED) throw error("PURCHASE_ORDER_ALREADY_RECEIVED", "Purchase order is already received", 409);
		const orderItems = await repository.lockPurchaseOrderItems(tx, orderId);
		const itemMap = new Map(orderItems.map((item) => [item.id, item]));
		const products = await lockProducts(tx, companyId, orderItems.map((item) => item.productId));
		const productMap = new Map(products.map((product) => [product.id, product]));
		const receivedItems = input.items.map((item) => {
			const orderItem = itemMap.get(item.purchaseOrderItemId);
			if (!orderItem) throw error("INVALID_RECEIVED_QUANTITY", "Purchase order item is invalid", 400);
			const receivedQuantity = parseDecimal(item.quantityReceived);
			const remaining = parseDecimal(orderItem.orderedQuantity).minus(orderItem.receivedQuantity);
			if (receivedQuantity.lte(0) || receivedQuantity.gt(remaining)) throw error("INVALID_RECEIVED_QUANTITY", "Invalid received quantity", 400);
			return { orderItem, receivedQuantity };
		});
		const operationId = randomUUID();
		for (const received of receivedItems) {
			const product = productMap.get(received.orderItem.productId);
			if (!product) throw error("PRODUCT_NOT_FOUND", "Product not found", 404);
			const oldStock = parseDecimal(product.stockQuantity);
			const oldAverageCost = parseDecimal(product.averageCost);
			const receivedCost = parseDecimal(received.orderItem.unitCost);
			const newStock = oldStock.plus(received.receivedQuantity);
			const newAverageCost = oldStock.equals(0)
				? receivedCost
				: roundMoney(oldStock.times(oldAverageCost).plus(received.receivedQuantity.times(receivedCost)).div(newStock));
			await tx.product.update({ where: { id: product.id }, data: { stockQuantity: newStock, averageCost: newAverageCost } });
			await repository.updatePurchaseOrderItem(tx, received.orderItem.id, { receivedQuantity: parseDecimal(received.orderItem.receivedQuantity).plus(received.receivedQuantity) });
			await inventoryRepository.createMovement(tx, {
				companyId,
				productId: product.id,
				movementType: InventoryMovementType.PURCHASE_RECEIPT,
				quantityChange: received.receivedQuantity,
				quantityBefore: oldStock,
				quantityAfter: newStock,
				unitCost: receivedCost,
				operationId,
				referenceType: "PURCHASE_ORDER",
				referenceId: order.id,
				reason: input.notes ?? "Purchase receipt",
				note: input.notes ?? null,
				createdBy: userId,
			});
		}
		const refreshedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: orderId } });
		const fullyReceived = refreshedItems.every((item) => parseDecimal(item.receivedQuantity).gte(item.orderedQuantity));
		const nextStatus = fullyReceived ? PurchaseOrderStatus.RECEIVED : PurchaseOrderStatus.PARTIALLY_RECEIVED;
		await repository.updatePurchaseOrder(tx, orderId, { status: nextStatus });
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "PURCHASE_RECEIVED", entityType: "PurchaseOrder", entityId: orderId, metadata: safeAudit({ operationId }) });
		return { order: await repository.findPurchaseOrderById(tx, companyId, orderId), productIds: [...new Set(receivedItems.map((item) => item.orderItem.productId))] };
	});

	const refreshedProducts = await prisma.product.findMany({ where: { id: { in: result.productIds } }, select: { id: true, takealotSync: true, takealotProductId: true, stockQuantity: true } });
	await Promise.allSettled(refreshedProducts.filter((product) => product.takealotSync && product.takealotProductId).map((product) => queueTakealotStockSync({ companyId, productId: product.id, takealotProductId: product.takealotProductId!, quantity: numberValue(product.stockQuantity) })));
	if (!result.order) throw error("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found", 404);
	return purchaseDetailView(result.order);
};

export const recordSupplierPayment = async (companyId: string, userId: string, orderId: string, input: z.infer<typeof supplierPaymentSchema>) => {
	const payment = await prisma.$transaction(async (tx) => {
		const order = await repository.lockPurchaseOrder(tx, companyId, orderId);
		if (!order) throw error("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found", 404);
		if (order.status === PurchaseOrderStatus.CANCELLED) throw error("PURCHASE_ORDER_CANCELLED", "Purchase order is cancelled", 409);
		const balanceDue = parseDecimal(order.balanceDue);
		if (input.amount > numberValue(balanceDue)) throw error("SUPPLIER_PAYMENT_EXCEEDS_BALANCE", "Payment exceeds outstanding balance", 409);
		const created = await repository.createSupplierPayment(tx, {
			companyId,
			supplierId: order.supplierId,
			purchaseOrderId: order.id,
			paymentMethod: input.paymentMethod,
			amount: input.amount,
			paidAt: new Date(),
			reference: input.reference ?? null,
			notes: input.notes ?? null,
			createdBy: userId,
		});
		const paidAmount = parseDecimal(order.paidAmount).plus(input.amount);
		const nextBalance = parseDecimal(order.balanceDue).minus(input.amount);
		await repository.updatePurchaseOrder(tx, orderId, { paidAmount, balanceDue: nextBalance });
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "SUPPLIER_PAYMENT_RECORDED", entityType: "SupplierPayment", entityId: created.id, metadata: safeAudit({ amount: input.amount }) });
		return { payment: created, paidAmount, balanceDue: nextBalance };
	});
	return { paymentId: payment.payment.id, amount: numberValue(payment.payment.amount), paymentMethod: payment.payment.paymentMethod, paidAmount: numberValue(payment.paidAmount), balanceDue: numberValue(payment.balanceDue) };
};

export const listSupplierPayments = async (companyId: string, orderId: string, input: z.infer<typeof paymentListSchema>) => {
	const [order, items, total] = await Promise.all([
		repository.findPurchaseOrderById(prisma, companyId, orderId),
		repository.listSupplierPayments(prisma, { purchaseOrderId: orderId, companyId }, (input.page - 1) * input.limit, input.limit),
		repository.countSupplierPayments(prisma, { purchaseOrderId: orderId, companyId }),
	]);
	if (!order) throw error("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found", 404);
	return { items: items.map(paymentView), pagination: pageData(input.page, input.limit, total) };
};

export const listSupplierAccountPayments = async (companyId: string, supplierId: string, input: z.infer<typeof paymentListSchema>) => {
	const where = { supplierId, companyId };
	const [items, total] = await Promise.all([
		repository.listSupplierPayments(prisma, where, (input.page - 1) * input.limit, input.limit),
		repository.countSupplierPayments(prisma, where),
	]);
	return { items: items.map(paymentView), pagination: pageData(input.page, input.limit, total) };
};

export const cancelPurchaseOrder = async (companyId: string, userId: string, orderId: string) => {
	const order = await prisma.$transaction(async (tx) => {
		const current = await repository.lockPurchaseOrder(tx, companyId, orderId);
		if (!current) throw error("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found", 404);
		if (current.status !== PurchaseOrderStatus.DRAFT && current.status !== PurchaseOrderStatus.PENDING) throw error("PURCHASE_ORDER_NOT_EDITABLE", "Purchase order is not cancellable", 409);
		const items = await repository.lockPurchaseOrderItems(tx, orderId);
		if (items.some((item) => numberValue(item.receivedQuantity) > 0)) throw error("PURCHASE_ORDER_NOT_EDITABLE", "Received purchase orders cannot be cancelled", 409);
		await repository.updatePurchaseOrder(tx, orderId, { status: PurchaseOrderStatus.CANCELLED });
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "PURCHASE_ORDER_CANCELLED", entityType: "PurchaseOrder", entityId: orderId });
		return repository.findPurchaseOrderById(tx, companyId, orderId);
	});
	if (!order) throw error("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found", 404);
	return purchaseDetailView(order);
};
