import { Prisma, type PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const listSuppliers = (db: Db, where: Prisma.SupplierWhereInput, skip: number, take: number, sortOrder: "asc" | "desc") =>
	db.supplier.findMany({ where, orderBy: { name: sortOrder }, skip, take });

export const countSuppliers = (db: Db, where: Prisma.SupplierWhereInput) => db.supplier.count({ where });
export const findSupplierById = (db: Db, companyId: string, id: string) => db.supplier.findFirst({ where: { id, companyId } });
export const findSupplierByName = (db: Db, companyId: string, name: string, excludeId?: string) => db.supplier.findFirst({ where: { companyId, name, ...(excludeId && { id: { not: excludeId } }) } });
export const createSupplier = (db: Db, data: Prisma.SupplierUncheckedCreateInput) => db.supplier.create({ data });
export const updateSupplier = (db: Db, id: string, data: Prisma.SupplierUpdateInput) => db.supplier.update({ where: { id }, data });
export const softDeleteSupplier = (db: Db, id: string) => db.supplier.update({ where: { id }, data: { isActive: false } });

export const listPurchaseOrders = (db: Db, where: Prisma.PurchaseOrderWhereInput, skip: number, take: number, sortBy: "orderDate" | "poNumber" | "total" | "createdAt", sortOrder: "asc" | "desc") =>
	db.purchaseOrder.findMany({
		where,
		orderBy: { [sortBy]: sortOrder },
		skip,
		take,
		include: { supplier: { select: { id: true, name: true } } },
	});

export const countPurchaseOrders = (db: Db, where: Prisma.PurchaseOrderWhereInput) => db.purchaseOrder.count({ where });

export const findPurchaseOrderById = (db: Db, companyId: string, id: string) =>
	db.purchaseOrder.findFirst({
		where: { id, companyId },
		include: {
			supplier: { select: { id: true, name: true, contactPerson: true, phone: true, email: true } },
			items: { orderBy: { id: "asc" }, include: { product: { select: { id: true, name: true, sku: true, imageKeys: true } } } },
			payments: { orderBy: { paidAt: "asc" }, include: { creator: { select: { id: true, fullName: true } } } },
		},
	});

export const lockPurchaseOrder = async (db: Prisma.TransactionClient, companyId: string, id: string) => {
	await db.$queryRaw(Prisma.sql`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${id} AND "companyId" = ${companyId} FOR UPDATE`);
	return db.purchaseOrder.findFirst({ where: { id, companyId } });
};

export const lockPurchaseOrderItems = async (db: Prisma.TransactionClient, purchaseOrderId: string) => {
	await db.$queryRaw(Prisma.sql`SELECT "id" FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = ${purchaseOrderId} ORDER BY "id" FOR UPDATE`);
	return db.purchaseOrderItem.findMany({ where: { purchaseOrderId } });
};

export const createPurchaseOrder = (db: Db, data: Prisma.PurchaseOrderUncheckedCreateInput) => db.purchaseOrder.create({ data });
export const updatePurchaseOrder = (db: Db, id: string, data: Prisma.PurchaseOrderUpdateInput) => db.purchaseOrder.update({ where: { id }, data });
export const deletePurchaseOrderItems = (db: Db, purchaseOrderId: string) => db.purchaseOrderItem.deleteMany({ where: { purchaseOrderId } });
export const createPurchaseOrderItem = (db: Db, data: Prisma.PurchaseOrderItemUncheckedCreateInput) => db.purchaseOrderItem.create({ data });
export const updatePurchaseOrderItem = (db: Db, id: string, data: Prisma.PurchaseOrderItemUpdateInput) => db.purchaseOrderItem.update({ where: { id }, data });

export const createSupplierPayment = (db: Db, data: Prisma.SupplierPaymentUncheckedCreateInput) => db.supplierPayment.create({ data });
export const listSupplierPayments = (db: Db, where: Prisma.SupplierPaymentWhereInput, skip: number, take: number) =>
	db.supplierPayment.findMany({ where, orderBy: { paidAt: "desc" }, skip, take, select: { id: true, amount: true, paymentMethod: true, reference: true, paidAt: true, creator: { select: { id: true, fullName: true } } } });
export const countSupplierPayments = (db: Db, where: Prisma.SupplierPaymentWhereInput) => db.supplierPayment.count({ where });

export const countActivePurchaseOrdersForSupplier = (db: Db, companyId: string, supplierId: string) =>
	db.purchaseOrder.count({ where: { companyId, supplierId, status: { not: "CANCELLED" } } });

export const createAuditLog = (db: Db, data: Prisma.AuditLogUncheckedCreateInput) => db.auditLog.create({ data });