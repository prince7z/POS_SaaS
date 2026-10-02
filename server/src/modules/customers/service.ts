import { PaymentMethod, PaymentStatus, SaleStatus, type Prisma } from "@prisma/client";
import { z } from "zod";

import { createMediaDownloadUrl, createMediaUploadUrl, deleteMediaObject } from "../../integrations/aws/media";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { AppError, validationError } from "../../utils/errors";
import * as repository from "./repository";

const uuid = z.string().uuid();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const money = z.coerce.number().min(0);
const imageType = z.enum(["image/jpeg", "image/png", "image/webp"]);

export const listSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().optional(),
	isWalkIn: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
	hasBalance: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
	includeInactive: z.enum(["true", "false"]).transform((value) => value === "true").default("false" as never),
	customerType: z.string().trim().min(1).max(80).optional(),
	includeStats: z.enum(["true", "false"]).transform((value) => value === "true").default("false" as never),
	sortBy: z.enum(["name", "createdAt", "creditBalance"]).default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export const createSchema = z.object({
	name: z.string().trim().min(1).max(150),
	phone: optionalText(50),
	email: z.string().trim().email().transform((value) => value.toLowerCase()).nullable().optional(),
	customerType: optionalText(80),
	addressLine1: optionalText(255),
	addressLine2: optionalText(255),
	city: optionalText(100),
	state: optionalText(100),
	postalCode: optionalText(30),
	creditLimit: money.optional().default(0),
});
export const updateSchema = createSchema.partial();
export const contentTypeSchema = z.object({ contentType: imageType });
export const profileKeySchema = z.object({ profileImageKey: z.string().min(1) });
export const paymentSchema = z.object({
	invoiceId: uuid,
	amount: z.coerce.number().gt(0),
	paymentMethod: z.enum([PaymentMethod.CASH, PaymentMethod.CARD]),
	reference: optionalText(255),
	notes: optionalText(1000),
});
export const paymentListSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
});

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
	const result = schema.safeParse(value);
	if (!result.success) throw validationError(result.error.issues[0]?.message ?? "Invalid request");
	return result.data;
};
export { parse };

const customerView = (customer: any) => ({
	id: customer.id,
	name: customer.name,
	phone: customer.phone,
	email: customer.email,
	profileImageKey: customer.profileImageKey,
	customerType: customer.customerType,
	addressLine1: customer.addressLine1,
	addressLine2: customer.addressLine2,
	city: customer.city,
	state: customer.state,
	postalCode: customer.postalCode,
	creditLimit: Number(customer.creditLimit),
	creditBalance: Number(customer.creditBalance),
	storeCreditBalance: Number(customer.storeCreditBalance),
	isWalkIn: customer.isWalkIn,
	isActive: customer.isActive,
	createdAt: customer.createdAt,
	updatedAt: customer.updatedAt,
});
const pageData = (page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });
const safeAudit = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const customerError = (code: string, message: string, statusCode = 400) => new AppError(message, statusCode, code);

export const listCustomers = async (companyId: string, input: z.infer<typeof listSchema>) => {
	const where: Prisma.CustomerWhereInput = {
		companyId,
		...(input.includeInactive ? {} : { deletedAt: null, isActive: true }),
		...(input.isWalkIn !== undefined && { isWalkIn: input.isWalkIn }),
		...(input.customerType && { customerType: input.customerType }),
		...(input.search && { OR: [{ name: { contains: input.search, mode: "insensitive" } }, { phone: { contains: input.search, mode: "insensitive" } }, { email: { contains: input.search, mode: "insensitive" } }] }),
	};
	const withStats = async (items: any[]) => {
		if (!input.includeStats || items.length === 0) return items.map(customerView);
		const sales = await prisma.sale.groupBy({
			by: ["customerId"],
			where: { companyId, customerId: { in: items.map((item) => item.id) }, status: "COMPLETED" },
			_sum: { total: true },
			_count: { _all: true },
			_max: { soldAt: true },
		});
		const stats = new Map(sales.map((sale) => [sale.customerId, { totalPurchases: Number(sale._sum.total ?? 0), totalOrders: sale._count._all, lastPurchaseAt: sale._max.soldAt }]));
		return items.map((item) => ({ ...customerView(item), stats: stats.get(item.id) ?? { totalPurchases: 0, totalOrders: 0, averageOrderValue: 0, lastPurchaseAt: null }, ...(stats.has(item.id) ? { stats: { ...stats.get(item.id), averageOrderValue: Number(stats.get(item.id)!.totalPurchases) / stats.get(item.id)!.totalOrders } } : {}) }));
	};
	if (input.hasBalance === undefined) {
		const [items, total] = await Promise.all([repository.listCustomers(prisma, where, (input.page - 1) * input.limit, input.limit, input.sortBy, input.sortOrder), repository.countCustomers(prisma, where)]);
		return { items: await withStats(items), pagination: pageData(input.page, input.limit, total) };
	}
	const all = await repository.listCustomers(prisma, where, undefined, undefined, input.sortBy, input.sortOrder);
	const filtered = all.filter((customer) => (Number(customer.creditBalance) > 0) === input.hasBalance);
	const start = (input.page - 1) * input.limit;
	return { items: await withStats(filtered.slice(start, start + input.limit)), pagination: pageData(input.page, input.limit, filtered.length) };
};

export const getSummary = async (companyId: string, from?: string, to?: string) => {
	const dateFilter = from || to ? { createdAt: { ...(from && { gte: new Date(`${from}T00:00:00.000Z`) }), ...(to && { lte: new Date(`${to}T23:59:59.999Z`) }) } } : {};
	const saleDateFilter = from || to ? { soldAt: { ...(from && { gte: new Date(`${from}T00:00:00.000Z`) }), ...(to && { lte: new Date(`${to}T23:59:59.999Z`) }) } } : {};
	const [totalCustomers, activeCustomers, newCustomers, sales] = await Promise.all([
		prisma.customer.count({ where: { companyId, deletedAt: null } }),
		prisma.customer.count({ where: { companyId, deletedAt: null, isActive: true } }),
		prisma.customer.count({ where: { companyId, deletedAt: null, ...dateFilter } }),
		prisma.sale.aggregate({ where: { companyId, customerId: { not: null }, status: "COMPLETED", ...saleDateFilter }, _sum: { total: true } }),
	]);
	return { totalCustomers, activeCustomers, newCustomers, totalCustomerSales: Number(sales._sum.total ?? 0) };
};

export const getCustomer = async (companyId: string, id: string) => {
	const customer = await repository.findCustomerById(prisma, companyId, id);
	if (!customer) throw customerError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
	return customerView(customer);
};

export const createCustomer = async (companyId: string, userId: string, input: z.infer<typeof createSchema>) => {
	if (input.email && await repository.findCustomerByEmail(prisma, companyId, input.email)) throw customerError("CUSTOMER_ALREADY_EXISTS", "Customer email already exists", 409);
	const customer = await prisma.$transaction(async (tx) => {
		const created = await repository.createCustomer(tx, { ...input, companyId, phone: input.phone, email: input.email, customerType: input.customerType ?? null, creditLimit: input.creditLimit, creditBalance: 0, storeCreditBalance: 0, isWalkIn: false });
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "CUSTOMER_CREATED", entityType: "Customer", entityId: created.id, afterData: safeAudit({ name: created.name, email: created.email }) });
		return created;
	});
	return customerView(customer);
};

export const updateCustomer = async (companyId: string, userId: string, id: string, input: z.infer<typeof updateSchema>) => {
	const before = await repository.findCustomerById(prisma, companyId, id);
	if (!before) throw customerError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
	if (input.email && await repository.findCustomerByEmail(prisma, companyId, input.email, id)) throw customerError("CUSTOMER_ALREADY_EXISTS", "Customer email already exists", 409);
	const creditLimit = input.creditLimit === undefined ? Number(before.creditLimit) : input.creditLimit;
	if (before.isWalkIn && creditLimit !== 0) throw customerError("CUSTOMER_CREDIT_LIMIT_INVALID", "Walk-in customer credit limit must be zero");
	if (creditLimit < Number(before.creditBalance)) throw customerError("CUSTOMER_CREDIT_LIMIT_INVALID", "Credit limit cannot be below current credit balance");
	const customer = await prisma.$transaction(async (tx) => {
		const updated = await repository.updateCustomer(tx, id, input);
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "CUSTOMER_UPDATED", entityType: "Customer", entityId: id, beforeData: safeAudit({ name: before.name, creditLimit: before.creditLimit }), afterData: safeAudit({ name: updated.name, creditLimit: updated.creditLimit }) });
		return updated;
	});
	return customerView(customer);
};

export const deleteCustomer = async (companyId: string, userId: string, id: string) => {
	const customer = await repository.findCustomerById(prisma, companyId, id);
	if (!customer) throw customerError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
	if (customer.isWalkIn) throw customerError("WALK_IN_CUSTOMER_PROTECTED", "Walk-in customer cannot be deleted", 409);
	if (Number(customer.creditBalance) > 0 || Number(customer.storeCreditBalance) > 0) throw customerError("CUSTOMER_HAS_BALANCE", "Customer has an outstanding balance", 409);
	await prisma.$transaction(async (tx) => {
		await repository.softDeleteCustomer(tx, id);
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "CUSTOMER_DELETED", entityType: "Customer", entityId: id });
	});
};

const validateProfileKey = (key: string, companyId: string, customerId: string) => {
	const escaped = [companyId, customerId].map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	if (!new RegExp(`^companies/${escaped[0]}/customers/${escaped[1]}/profile/[0-9a-f-]{36}\.(jpg|png|webp)$`).test(key)) throw customerError("INVALID_MEDIA_TYPE", "Invalid customer profile image key");
};

const deleteOldProfile = async (key: string) => {
	try { await deleteMediaObject(key); } catch (error) { logger.error("Failed to delete replaced customer profile image", error); }
};

export const createProfileUploadUrl = async (companyId: string, id: string, contentType: string) => {
	const customer = await repository.findCustomerById(prisma, companyId, id);
	if (!customer) throw customerError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
	if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) throw customerError("INVALID_MEDIA_TYPE", "Profile image must be JPEG, PNG, or WebP");
	return createMediaUploadUrl({ companyId, resource: "CUSTOMER_PROFILE", resourceId: id, contentType });
};

export const updateProfile = async (companyId: string, userId: string, id: string, profileImageKey: string) => {
	const customer = await repository.findCustomerById(prisma, companyId, id);
	if (!customer) throw customerError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
	validateProfileKey(profileImageKey, companyId, id);
	const updated = await repository.updateCustomer(prisma, id, { profileImageKey });
	await repository.createAuditLog(prisma, { companyId, actorUserId: userId, action: "CUSTOMER_PROFILE_UPDATED", entityType: "Customer", entityId: id });
	if (customer.profileImageKey) await deleteOldProfile(customer.profileImageKey);
	return { profileImageKey: updated.profileImageKey };
};

export const removeProfile = async (companyId: string, userId: string, id: string) => {
	const customer = await repository.findCustomerById(prisma, companyId, id);
	if (!customer) throw customerError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
	await repository.updateCustomer(prisma, id, { profileImageKey: null });
	await repository.createAuditLog(prisma, { companyId, actorUserId: userId, action: "CUSTOMER_PROFILE_REMOVED", entityType: "Customer", entityId: id });
	if (customer.profileImageKey) await deleteOldProfile(customer.profileImageKey);
};

export const profileUrl = async (companyId: string, id: string) => {
	const customer = await repository.findCustomerById(prisma, companyId, id);
	if (!customer) throw customerError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
	if (!customer.profileImageKey) throw customerError("CUSTOMER_PROFILE_NOT_FOUND", "Customer profile image not found", 404);
	return createMediaDownloadUrl({ key: customer.profileImageKey });
};

export const recordPayment = async (companyId: string, userId: string, customerId: string, input: z.infer<typeof paymentSchema>) => {
	const result = await prisma.$transaction(async (tx) => {
		const locked = await repository.lockCustomerAndSale(tx, companyId, customerId, input.invoiceId);
		if (!locked.customer) throw customerError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
		if (!locked.sale) throw customerError("INVOICE_NOT_FOUND", "Invoice not found for customer", 404);
		if (locked.sale.status !== SaleStatus.COMPLETED) throw customerError("INVALID_INVOICE_STATUS", "Invoice must be completed");
		const saleBalance = Number(locked.sale.balanceDue);
		const creditBalance = Number(locked.customer.creditBalance);
		if (saleBalance <= 0 || input.amount > saleBalance) throw customerError("INVALID_PAYMENT_AMOUNT", "Payment exceeds invoice balance");
		if (input.amount > creditBalance) throw customerError("CREDIT_BALANCE_INVALID", "Payment exceeds customer credit balance");
		const balanceDue = saleBalance - input.amount;
		const newCreditBalance = creditBalance - input.amount;
		const payment = await repository.createCustomerPayment(tx, { companyId, customerId, invoiceId: input.invoiceId, amount: input.amount, paymentMethod: input.paymentMethod, reference: input.reference, notes: input.notes, paidAt: new Date(), receivedBy: userId });
		await repository.updateSaleBalance(tx, input.invoiceId, balanceDue, balanceDue === 0 ? PaymentStatus.PAID : PaymentStatus.PENDING);
		await repository.updateCustomerCredit(tx, customerId, newCreditBalance);
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "CUSTOMER_PAYMENT_RECEIVED", entityType: "CustomerPayment", entityId: payment.id, afterData: safeAudit({ customerId, invoiceId: input.invoiceId, amount: input.amount }) });
		return { payment, balanceDue, newCreditBalance };
	});
	return { paymentId: result.payment.id, amount: Number(result.payment.amount), paymentMethod: result.payment.paymentMethod, invoiceId: result.payment.invoiceId, invoiceBalanceDue: result.balanceDue, customerCreditBalance: result.newCreditBalance, paidAt: result.payment.paidAt };
};

export const listPayments = async (companyId: string, customerId: string, input: z.infer<typeof paymentListSchema>) => {
	if (!await repository.findCustomerById(prisma, companyId, customerId)) throw customerError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
	const where: Prisma.CustomerPaymentWhereInput = { companyId, customerId, ...(input.from || input.to ? { paidAt: { ...(input.from && { gte: new Date(input.from) }), ...(input.to && { lte: new Date(input.to) }) } } : {}) };
	const [items, total] = await Promise.all([repository.listPayments(prisma, where, (input.page - 1) * input.limit, input.limit), repository.countPayments(prisma, where)]);
	return { items: items.map((payment) => ({ id: payment.id, invoiceId: payment.invoiceId, amount: Number(payment.amount), paymentMethod: payment.paymentMethod, reference: payment.reference, paidAt: payment.paidAt, receivedBy: { id: payment.receiver.id, name: payment.receiver.fullName } })), pagination: pageData(input.page, input.limit, total) };
};