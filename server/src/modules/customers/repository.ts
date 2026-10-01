import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const listCustomers = (db: Db, where: Prisma.CustomerWhereInput, skip: number | undefined, take: number | undefined, sortBy: "name" | "createdAt" | "creditBalance", sortOrder: "asc" | "desc") =>
	db.customer.findMany({ where, orderBy: { [sortBy]: sortOrder }, ...(skip !== undefined && { skip }), ...(take !== undefined && { take }) });

export const countCustomers = (db: Db, where: Prisma.CustomerWhereInput) => db.customer.count({ where });
export const findCustomerById = (db: Db, companyId: string, id: string) => db.customer.findFirst({ where: { id, companyId, deletedAt: null } });
export const findCustomerByEmail = (db: Db, companyId: string, email: string, excludeId?: string) => db.customer.findFirst({ where: { companyId, email, ...(excludeId && { id: { not: excludeId } }), deletedAt: null } });
export const createCustomer = (db: Db, data: Prisma.CustomerUncheckedCreateInput) => db.customer.create({ data });
export const updateCustomer = (db: Db, id: string, data: Prisma.CustomerUpdateInput) => db.customer.update({ where: { id }, data });
export const softDeleteCustomer = (db: Db, id: string) => db.customer.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });

export const findSaleForPayment = (db: Db, companyId: string, invoiceId: string, customerId: string) =>
	db.sale.findFirst({ where: { id: invoiceId, companyId, customerId } });

export const lockCustomerAndSale = async (db: Prisma.TransactionClient, companyId: string, customerId: string, invoiceId: string) => {
	await db.$queryRaw(Prisma.sql`SELECT "id" FROM "Customer" WHERE "id" = ${customerId} AND "companyId" = ${companyId} FOR UPDATE`);
	await db.$queryRaw(Prisma.sql`SELECT "id" FROM "Sale" WHERE "id" = ${invoiceId} AND "companyId" = ${companyId} FOR UPDATE`);
	const [customer, sale] = await Promise.all([
		db.customer.findFirst({ where: { id: customerId, companyId, deletedAt: null } }),
		db.sale.findFirst({ where: { id: invoiceId, companyId, customerId } }),
	]);
	return { customer, sale };
};

export const createCustomerPayment = (db: Db, data: Prisma.CustomerPaymentUncheckedCreateInput) => db.customerPayment.create({ data });
export const updateCustomerCredit = (db: Db, id: string, creditBalance: number) => db.customer.update({ where: { id }, data: { creditBalance } });
export const updateSaleBalance = (db: Db, id: string, balanceDue: number, paymentStatus: "PAID" | "PENDING") => db.sale.update({ where: { id }, data: { balanceDue, paymentStatus } });
export const listPayments = (db: Db, where: Prisma.CustomerPaymentWhereInput, skip: number, take: number) =>
	db.customerPayment.findMany({ where, orderBy: { paidAt: "desc" }, skip, take, include: { receiver: { select: { id: true, fullName: true } } } });
export const countPayments = (db: Db, where: Prisma.CustomerPaymentWhereInput) => db.customerPayment.count({ where });
export const createAuditLog = (db: Db, data: Prisma.AuditLogUncheckedCreateInput) => db.auditLog.create({ data });