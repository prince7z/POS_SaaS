import { Prisma, type PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

const saleCustomerInclude = { customer: { select: { id: true, name: true, phone: true, email: true, isWalkIn: true } }, cashier: { select: { id: true, fullName: true } } } as const;

export const findSaleById = (db: Db, companyId: string, id: string) =>
	db.sale.findFirst({
		where: { id, companyId },
		include: {
			customer: { select: { id: true, name: true, phone: true, email: true, isWalkIn: true } },
			cashier: { select: { id: true, fullName: true } },
			items: { orderBy: { createdAt: "asc" } },
			payments: { orderBy: { paidAt: "asc" } },
		},
	});

export const findSaleSummaryById = (db: Db, companyId: string, id: string) =>
	db.sale.findFirst({
		where: { id, companyId },
		include: saleCustomerInclude,
	});

export const listSales = (
	db: Db,
	where: Prisma.SaleWhereInput,
	skip: number,
	take: number,
	sortBy: "soldAt" | "invoiceNumber" | "total" | "createdAt",
	sortOrder: "asc" | "desc",
) =>
	db.sale.findMany({
		where,
		orderBy: { [sortBy]: sortOrder },
		skip,
		take,
		include: saleCustomerInclude,
	});

export const countSales = (db: Db, where: Prisma.SaleWhereInput) => db.sale.count({ where });

export const lockSale = async (db: Prisma.TransactionClient, companyId: string, saleId: string) => {
	await db.$queryRaw(Prisma.sql`SELECT "id" FROM "Sale" WHERE "id" = ${saleId} AND "companyId" = ${companyId} FOR UPDATE`);
	return db.sale.findFirst({ where: { id: saleId, companyId } });
};

export const lockSaleItems = async (db: Prisma.TransactionClient, saleId: string) => {
	await db.$queryRaw(Prisma.sql`SELECT "id" FROM "SaleItem" WHERE "saleId" = ${saleId} ORDER BY "id" FOR UPDATE`);
};

export const lockProducts = async (db: Prisma.TransactionClient, productIds: string[]) => {
	for (const productId of [...productIds].sort()) {
		await db.$queryRaw(Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = ${productId} AND "deletedAt" IS NULL FOR UPDATE`);
	}
	return db.product.findMany({
		where: { id: { in: productIds } },
	});
};

export const findProductsByIds = (db: Db, companyId: string, productIds: string[]) =>
	db.product.findMany({
		where: { id: { in: productIds }, companyId, deletedAt: null, isActive: true },
	});

export const findCustomerById = (db: Db, companyId: string, customerId: string) =>
	db.customer.findFirst({ where: { id: customerId, companyId, deletedAt: null } });

export const findWalkInCustomer = (db: Db, companyId: string) =>
	db.customer.findFirst({ where: { companyId, isWalkIn: true, deletedAt: null } });

export const createSale = (db: Db, data: Prisma.SaleUncheckedCreateInput) => db.sale.create({ data });

export const updateSale = (db: Db, saleId: string, data: Prisma.SaleUncheckedUpdateInput) =>
	db.sale.update({ where: { id: saleId }, data });

export const deleteSaleItems = (db: Db, saleId: string) => db.saleItem.deleteMany({ where: { saleId } });

export const createSaleItem = (db: Db, data: Prisma.SaleItemUncheckedCreateInput) => db.saleItem.create({ data });

export const createSalePayment = (db: Db, data: Prisma.SalePaymentUncheckedCreateInput) => db.salePayment.create({ data });

export const listSalePayments = (db: Db, saleId: string) =>
	db.salePayment.findMany({
		where: { saleId },
		orderBy: { paidAt: "asc" },
		select: { id: true, paymentMethod: true, amount: true, reference: true, paidAt: true, createdBy: true },
	});

export const createReturn = (db: Db, data: Prisma.ReturnUncheckedCreateInput) => db.return.create({ data });

export const createReturnItem = (db: Db, data: Prisma.ReturnItemUncheckedCreateInput) => db.returnItem.create({ data });

export const listReturns = (
	db: Db,
	where: Prisma.ReturnWhereInput,
	skip: number,
	take: number,
) =>
	db.return.findMany({
		where,
		orderBy: { processedAt: "desc" },
		skip,
		take,
		include: {
			sale: { select: { id: true, invoiceNumber: true, customer: { select: { id: true, name: true, phone: true } } } },
			customer: { select: { id: true, name: true, phone: true } },
			processor: { select: { id: true, fullName: true } },
		},
	});

export const countReturns = (db: Db, where: Prisma.ReturnWhereInput) => db.return.count({ where });

export const findReturnBySale = (db: Db, companyId: string, saleId: string) =>
	db.return.findMany({
		where: { companyId, saleId },
		orderBy: { processedAt: "desc" },
		include: {
			items: { orderBy: { id: "asc" } },
			customer: { select: { id: true, name: true, phone: true, email: true, isWalkIn: true } },
			processor: { select: { id: true, fullName: true } },
			sale: { select: { id: true, invoiceNumber: true } },
		},
	});

export const findReturnableSale = (db: Db, companyId: string, saleId: string) =>
	db.sale.findFirst({
		where: { id: saleId, companyId, status: "COMPLETED" },
		include: {
			items: {
				orderBy: { createdAt: "asc" },
				include: { returnItems: { select: { quantity: true } } },
			},
			customer: { select: { id: true, name: true, phone: true, email: true, isWalkIn: true } },
		},
	});

export const createAuditLog = (db: Db, data: Prisma.AuditLogUncheckedCreateInput) => db.auditLog.create({ data });

export const createEmailLog = (db: Db, data: Prisma.EmailLogUncheckedCreateInput) => db.emailLog.create({ data });