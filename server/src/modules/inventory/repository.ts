import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

const productInclude = { category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } } } as const;

export const listInventory = (db: Db, where: Prisma.ProductWhereInput, skip: number | undefined, take: number | undefined, sortBy: "name" | "stockQuantity" | "createdAt", sortOrder: "asc" | "desc") =>
	db.product.findMany({ where, orderBy: { [sortBy]: sortOrder }, ...(skip !== undefined && { skip }), ...(take !== undefined && { take }), include: productInclude });
export const countInventory = (db: Db, where: Prisma.ProductWhereInput) => db.product.count({ where });
export const getInventoryProduct = (db: Db, companyId: string, productId: string) => db.product.findFirst({ where: { id: productId, companyId, deletedAt: null, isActive: true }, include: productInclude });
export const getActiveProducts = (db: Db, companyId: string) => db.product.findMany({ where: { companyId, deletedAt: null, isActive: true }, select: { id: true, stockQuantity: true, averageCost: true, lowStockThreshold: true } });
export const listMovements = (db: Db, where: Prisma.InventoryMovementWhereInput, skip: number, take: number) => db.inventoryMovement.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { creator: { select: { id: true, fullName: true } } } });
export const countMovements = (db: Db, where: Prisma.InventoryMovementWhereInput) => db.inventoryMovement.count({ where });

export const lockProduct = async (db: Prisma.TransactionClient, companyId: string, productId: string) => {
	await db.$queryRaw(Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = ${productId} AND "companyId" = ${companyId} AND "deletedAt" IS NULL AND "isActive" = true FOR UPDATE`);
	return db.product.findFirst({ where: { id: productId, companyId, deletedAt: null, isActive: true } });
};

export const updateInventory = (db: Db, productId: string, stockQuantity: number, averageCost: number) => db.product.update({ where: { id: productId }, data: { stockQuantity, averageCost } });
export const createMovement = (db: Db, data: Prisma.InventoryMovementUncheckedCreateInput) => db.inventoryMovement.create({ data });
export const createAuditLog = (db: Db, data: Prisma.AuditLogUncheckedCreateInput) => db.auditLog.create({ data });