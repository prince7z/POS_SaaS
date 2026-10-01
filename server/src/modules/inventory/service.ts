import { InventoryMovementType, type Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { queueTakealotStockSync } from "../../integrations/takealot/client";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { AppError, validationError } from "../../utils/errors";
import * as repository from "./repository";

const uuid = z.string().uuid();
const booleanQuery = z.enum(["true", "false"]).transform((value) => value === "true");
export const listSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().optional(),
	categoryId: uuid.optional(),
	brandId: uuid.optional(),
	lowStock: booleanQuery.optional(),
	outOfStock: booleanQuery.optional(),
	sortBy: z.enum(["name", "stockQuantity", "createdAt"]).default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export const movementListSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	movementType: z.nativeEnum(InventoryMovementType).optional(),
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
});
export const openingSchema = z.object({ productId: uuid, quantity: z.coerce.number().min(0), unitCost: z.coerce.number().min(0).optional(), note: z.string().trim().max(1000).optional() });
const adjustmentItemSchema = z.object({ productId: uuid, action: z.enum(["ADD", "REMOVE"]), quantity: z.coerce.number().gt(0), unitCost: z.coerce.number().min(0).optional(), reason: z.string().trim().max(255).optional(), note: z.string().trim().max(1000).optional() });
export const adjustmentSchema = z.object({ items: z.array(adjustmentItemSchema).min(1).max(50) });

export const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
	const result = schema.safeParse(value);
	if (!result.success) throw validationError(result.error.issues[0]?.message ?? "Invalid request");
	return result.data;
};

const inventoryError = (code: string, message: string, statusCode = 400) => new AppError(message, statusCode, code);
const pageData = (page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });
const numberValue = (value: unknown): number => Number(value);
const productView = (product: any) => ({
	productId: product.id,
	name: product.name,
	sku: product.sku,
	barcode: product.barcode,
	category: product.category,
	brand: product.brand,
	stockQuantity: numberValue(product.stockQuantity),
	averageCost: numberValue(product.averageCost),
	sellingPrice: numberValue(product.sellingPrice),
	purchaseCost: numberValue(product.purchaseCost),
	lowStockThreshold: numberValue(product.lowStockThreshold),
	isLowStock: numberValue(product.stockQuantity) <= numberValue(product.lowStockThreshold),
	isOutOfStock: numberValue(product.stockQuantity) === 0,
	takealotSync: product.takealotSync,
});
const safeAudit = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const inventoryWhere = (companyId: string, input: z.infer<typeof listSchema>): Prisma.ProductWhereInput => ({
	companyId,
	deletedAt: null,
	isActive: true,
	...(input.categoryId && { categoryId: input.categoryId }),
	...(input.brandId && { brandId: input.brandId }),
	...(input.search && { OR: [{ name: { contains: input.search, mode: "insensitive" } }, { sku: { contains: input.search, mode: "insensitive" } }, { barcode: { contains: input.search, mode: "insensitive" } }] }),
});

export const listInventory = async (companyId: string, input: z.infer<typeof listSchema>) => {
	const where = inventoryWhere(companyId, input);
	if (input.lowStock === undefined && input.outOfStock === undefined) {
		const [items, total] = await Promise.all([repository.listInventory(prisma, where, (input.page - 1) * input.limit, input.limit, input.sortBy, input.sortOrder), repository.countInventory(prisma, where)]);
		return { items: items.map(productView), pagination: pageData(input.page, input.limit, total) };
	}
	const all = await repository.listInventory(prisma, where, undefined, undefined, input.sortBy, input.sortOrder);
	const filtered = all.filter((product) => (input.lowStock === undefined || (numberValue(product.stockQuantity) <= numberValue(product.lowStockThreshold)) === input.lowStock) && (input.outOfStock === undefined || (numberValue(product.stockQuantity) === 0) === input.outOfStock));
	const start = (input.page - 1) * input.limit;
	return { items: filtered.slice(start, start + input.limit).map(productView), pagination: pageData(input.page, input.limit, filtered.length) };
};

export const getSummary = async (companyId: string) => {
	const products = await repository.getActiveProducts(prisma, companyId);
	return {
		totalProducts: products.length,
		totalUnits: products.reduce((sum, product) => sum + numberValue(product.stockQuantity), 0),
		lowStockProducts: products.filter((product) => numberValue(product.stockQuantity) > 0 && numberValue(product.stockQuantity) <= numberValue(product.lowStockThreshold)).length,
		outOfStockProducts: products.filter((product) => numberValue(product.stockQuantity) === 0).length,
		inventoryValue: products.reduce((sum, product) => sum + numberValue(product.stockQuantity) * numberValue(product.averageCost), 0),
	};
};

export const getProductInventory = async (companyId: string, productId: string) => {
	const product = await repository.getInventoryProduct(prisma, companyId, productId);
	if (!product) throw inventoryError("PRODUCT_NOT_FOUND", "Product not found", 404);
	return productView(product);
};

export const listMovements = async (companyId: string, productId: string, input: z.infer<typeof movementListSchema>) => {
	if (!await repository.getInventoryProduct(prisma, companyId, productId)) throw inventoryError("PRODUCT_NOT_FOUND", "Product not found", 404);
	const where: Prisma.InventoryMovementWhereInput = { companyId, productId, ...(input.movementType && { movementType: input.movementType }), ...(input.from || input.to ? { createdAt: { ...(input.from && { gte: new Date(input.from) }), ...(input.to && { lte: new Date(input.to) }) } } : {}) };
	const [items, total] = await Promise.all([repository.listMovements(prisma, where, (input.page - 1) * input.limit, input.limit), repository.countMovements(prisma, where)]);
	return { items: items.map((movement) => ({ id: movement.id, movementType: movement.movementType, quantityChange: numberValue(movement.quantityChange), quantityBefore: numberValue(movement.quantityBefore), quantityAfter: numberValue(movement.quantityAfter), unitCost: movement.unitCost === null ? null : numberValue(movement.unitCost), operationId: movement.operationId, referenceType: movement.referenceType, referenceId: movement.referenceId, reason: movement.reason, note: movement.note, createdBy: { id: movement.creator.id, name: movement.creator.fullName }, createdAt: movement.createdAt })), pagination: pageData(input.page, input.limit, total) };
};

const queueSync = async (products: Array<{ id: string; takealotSync: boolean; takealotProductId: string | null; stockQuantity: number }>, companyId: string) => {
	for (const product of products) {
		if (!product.takealotSync || !product.takealotProductId) continue;
		try { await queueTakealotStockSync({ companyId, productId: product.id, takealotProductId: product.takealotProductId, quantity: product.stockQuantity }); } catch (error) { logger.error("Takealot stock sync failed", error); }
	}
};

export const setOpeningStock = async (companyId: string, userId: string, input: z.infer<typeof openingSchema>) => {
	let syncProduct: { id: string; takealotSync: boolean; takealotProductId: string | null; stockQuantity: number } | undefined;
	const result = await prisma.$transaction(async (tx) => {
		const product = await repository.lockProduct(tx, companyId, input.productId);
		if (!product) throw inventoryError("PRODUCT_NOT_FOUND", "Product not found", 404);
		if (numberValue(product.stockQuantity) !== 0) throw inventoryError("OPENING_STOCK_ALREADY_EXISTS", "Opening stock already exists", 409);
		const cost = input.unitCost ?? numberValue(product.purchaseCost);
		const operationId = randomUUID();
		const updated = await repository.updateInventory(tx, product.id, input.quantity, cost);
		await repository.createMovement(tx, { companyId, productId: product.id, movementType: InventoryMovementType.OPENING, quantityChange: input.quantity, quantityBefore: 0, quantityAfter: input.quantity, unitCost: cost, operationId, note: input.note, createdBy: userId });
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "INVENTORY_OPENING_STOCK", entityType: "Product", entityId: product.id, afterData: safeAudit({ quantity: input.quantity, averageCost: cost }) });
		syncProduct = { id: product.id, takealotSync: product.takealotSync, takealotProductId: product.takealotProductId, stockQuantity: input.quantity };
		return updated;
	});
	if (syncProduct) await queueSync([syncProduct], companyId);
	return { productId: result.id, stockQuantity: numberValue(result.stockQuantity), averageCost: numberValue(result.averageCost) };
};

export const adjustStock = async (companyId: string, userId: string, input: z.infer<typeof adjustmentSchema>) => {
	const ids = input.items.map((item) => item.productId);
	if (new Set(ids).size !== ids.length) throw inventoryError("INVALID_STOCK_OPERATION", "A product may appear only once per adjustment");
	for (const item of input.items) if (item.action === "REMOVE" && item.unitCost !== undefined) throw inventoryError("INVALID_STOCK_OPERATION", "unitCost is not valid for stock removal");
	const operationId = randomUUID();
	const syncProducts: Array<{ id: string; takealotSync: boolean; takealotProductId: string | null; stockQuantity: number }> = [];
	const sortedItems = [...input.items].sort((left, right) => left.productId.localeCompare(right.productId));
	await prisma.$transaction(async (tx) => {
		const products = new Map<string, any>();
		for (const item of sortedItems) {
			const product = await repository.lockProduct(tx, companyId, item.productId);
			if (!product) throw inventoryError("PRODUCT_NOT_FOUND", "Product not found", 404);
			products.set(item.productId, product);
		}
		for (const item of sortedItems) {
			const product = products.get(item.productId);
			const before = numberValue(product.stockQuantity);
			const currentAverage = numberValue(product.averageCost);
			let after: number;
			let averageCost: number;
			let unitCost: number;
			if (item.action === "REMOVE") {
				if (item.quantity > before) throw inventoryError("INSUFFICIENT_STOCK", "Insufficient stock", 409);
				after = before - item.quantity;
				averageCost = currentAverage;
				unitCost = currentAverage;
			} else {
				after = before + item.quantity;
				unitCost = item.unitCost ?? (currentAverage > 0 ? currentAverage : numberValue(product.purchaseCost));
				averageCost = after === 0 ? unitCost : (before * currentAverage + item.quantity * unitCost) / after;
			}
			await repository.updateInventory(tx, product.id, after, averageCost);
			await repository.createMovement(tx, { companyId, productId: product.id, movementType: InventoryMovementType.ADJUSTMENT, quantityChange: item.action === "ADD" ? item.quantity : -item.quantity, quantityBefore: before, quantityAfter: after, unitCost, operationId, reason: item.reason, note: item.note, createdBy: userId });
			syncProducts.push({ id: product.id, takealotSync: product.takealotSync, takealotProductId: product.takealotProductId, stockQuantity: after });
		}
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "INVENTORY_ADJUSTED", entityType: "InventoryAdjustment", entityId: operationId, metadata: safeAudit({ operationId, itemCount: sortedItems.length }) });
	});
	await queueSync(syncProducts, companyId);
	return { operationId, items: syncProducts.map((product) => ({ productId: product.id, stockQuantity: product.stockQuantity })) };
};