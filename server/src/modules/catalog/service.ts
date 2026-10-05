import { Access, type Prisma } from "@prisma/client";
import { z } from "zod";

import { createMediaDownloadUrl, createMediaUploadUrls, createStagedMediaUploadUrls, deleteMediaObject, toPublicMediaUrl } from "../../integrations/aws/media";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { AppError, validationError } from "../../utils/errors";
import { createMediaUploadUrl } from "../../integrations/aws/media";
import * as repository from "./repository";

const uuid = z.string().uuid();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
const booleanQuery = z.enum(["true", "false"]).transform((value) => value === "true");

export const categoryListSchema = z.object({
	page: pageSchema,
	limit: limitSchema,
	search: z.string().trim().optional(),
	parentId: uuid.optional(),
	includeChildren: booleanQuery.optional().default(false),
});
export const brandListSchema = z.object({ page: pageSchema, limit: limitSchema, search: z.string().trim().optional(), sortBy: z.enum(["name", "createdAt"]).default("name"), sortOrder: z.enum(["asc", "desc"]).default("asc") });
const stagedImageKeySchema = z.string().regex(/^companies\/[A-Za-z0-9_-]+\/(?:pending\/product_image\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)|products\/[A-Za-z0-9-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif))$/i, "Invalid media key");
const stagedLogoKeySchema = z.string().regex(/^companies\/[A-Za-z0-9_-]+\/(?:pending\/(?:brand_logo|category_logo|category_image)\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)|(?:brands|categories)\/[A-Za-z0-9-]{36}\/logo\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif))$/i, "Invalid media key");
export const categorySchema = z.object({ name: z.string().trim().min(1).max(150), description: optionalText(1000), parentId: uuid.nullable().optional(), logoKey: stagedLogoKeySchema.nullable().optional() });
export const categoryUpdateSchema = categorySchema.partial();
export const brandSchema = z.object({ name: z.string().trim().min(1).max(150), description: optionalText(1000), logoKey: stagedLogoKeySchema.nullable().optional() });
export const brandUpdateSchema = brandSchema.partial();
export const productListSchema = z.object({
	page: pageSchema,
	limit: limitSchema,
	search: z.string().trim().optional(),
	categoryId: uuid.optional(),
	brandId: uuid.optional(),
	supplierId: uuid.optional(),
	lowStock: booleanQuery.optional(),
	sortBy: z.enum(["name", "sellingPrice", "stockQuantity", "createdAt"]).default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
	includeInactive: booleanQuery.optional().default(false),
});
const price = z.coerce.number().min(0);
export const productSchema = z.object({
	name: z.string().trim().min(1).max(200),
	sku: z.string().trim().min(1).max(100),
	barcode: optionalText(100),
	description: optionalText(5000),
	categoryId: uuid,
	brandId: uuid.nullable().optional(),
	supplierId: uuid.nullable().optional(),
	rrp: price,
	sellingPrice: price,
	purchaseCost: price,
	stockQuantity: price.optional().default(0),
	lowStockThreshold: price.optional().default(0),
	warrantyMonths: z.coerce.number().int().min(0).max(1200).nullable().optional(),
	productCode: optionalText(100),
	takealotProductId: optionalText(150),
	takealotSync: z.boolean().optional().default(false),
	imageKeys: z.array(stagedImageKeySchema).max(10).default([]),
});
export const productUpdateSchema = productSchema.partial();
const imageContentType = z.enum(["image/jpeg", "image/png", "image/webp"]);
export const uploadImageSchema = z.object({ contentTypes: z.array(imageContentType).min(1).max(10) });
export const imageKeysSchema = z.object({ imageKeys: z.array(z.string().min(1)).min(1).max(10) });
export const imageKeySchema = z.object({ imageKey: z.string().min(1) });
export const contentTypeSchema = z.object({ contentType: imageContentType });
export const logoKeySchema = z.object({ logoKey: z.string().min(1) });
export const stagedUploadSchema = z.object({
	resource: z.enum(["PRODUCT_IMAGE", "BRAND_LOGO", "CATEGORY_LOGO"]),
	contentTypes: z.array(imageContentType).min(1).max(10),
});

const safeAudit = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const catalogError = (code: string, message: string, statusCode = 400) => new AppError(message, statusCode, code);
const ensureImageContentType = (contentType: string): void => {
	if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) throw catalogError("INVALID_MEDIA_TYPE", "Catalog media must be JPEG, PNG, or WebP");
};

export const createCatalogMediaUploadUrls = async (companyId: string, resource: z.infer<typeof stagedUploadSchema>["resource"], contentTypes: string[]) => {
	contentTypes.forEach(ensureImageContentType);
	return createStagedMediaUploadUrls({ companyId, resource, contentTypes });
};

export const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
	const result = schema.safeParse(input);
	if (!result.success) throw validationError(result.error.issues[0]?.message ?? "Invalid request");
	return result.data;
};

const pagination = (page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });
const activeProductWhere = { deletedAt: null, isActive: true } as const;

const categoryView = (category: any) => ({
	id: category.id,
	name: category.name,
	description: category.description,
	parentId: category.parentId,
	logoKey: category.logoKey,
	logoUrl: category.logoKey ? toPublicMediaUrl(category.logoKey) : null,
	isActive: category.isActive,
	createdAt: category.createdAt,
	updatedAt: category.updatedAt,
	...(category.children !== undefined && { children: category.children.map((child: any) => ({ id: child.id, name: child.name, description: child.description, parentId: child.parentId, logoKey: child.logoKey, logoUrl: child.logoKey ? toPublicMediaUrl(child.logoKey) : null, isActive: child.isActive })) }),
	...(category._count && { productCount: category._count.products }),
});

const brandView = (brand: any) => ({
	id: brand.id,
	name: brand.name,
	description: brand.description,
	logoKey: brand.logoKey,
	logoUrl: brand.logoKey ? toPublicMediaUrl(brand.logoKey) : null,
	isActive: brand.isActive,
	createdAt: brand.createdAt,
	updatedAt: brand.updatedAt,
	...(brand._count && { productCount: brand._count.products }),
});

const numberValue = (value: unknown): number => Number(value);
const productView = (product: any) => ({
	id: product.id,
	name: product.name,
	sku: product.sku,
	barcode: product.barcode,
	description: product.description,
	category: product.category,
	brand: product.brand,
	supplier: product.supplier,
	categoryId: product.categoryId,
	brandId: product.brandId,
	supplierId: product.supplierId,
	rrp: numberValue(product.rrp),
	sellingPrice: numberValue(product.sellingPrice),
	purchaseCost: numberValue(product.purchaseCost),
	stockQuantity: numberValue(product.stockQuantity),
	averageCost: numberValue(product.averageCost),
	lowStockThreshold: numberValue(product.lowStockThreshold),
	isLowStock: numberValue(product.stockQuantity) <= numberValue(product.lowStockThreshold),
	warrantyMonths: product.warrantyMonths,
	productCode: product.productCode,
	imageKeys: product.imageKeys,
	imageUrls: product.imageKeys.map(toPublicMediaUrl),
	takealotProductId: product.takealotProductId,
	takealotSync: product.takealotSync,
	isActive: product.isActive,
	createdAt: product.createdAt,
	updatedAt: product.updatedAt,
});

const validateParent = async (companyId: string, parentId: string | null | undefined, categoryId?: string) => {
	if (!parentId) return;
	if (parentId === categoryId) throw catalogError("INVALID_CATEGORY_PARENT", "A category cannot be its own parent");
	const parent = await repository.findActiveParent(prisma, companyId, parentId);
	if (!parent) throw catalogError("INVALID_CATEGORY_PARENT", "Parent category is invalid");
	let currentId: string | null = parent.id;
	const visited = new Set<string>();
	while (currentId) {
		if (currentId === categoryId) throw catalogError("INVALID_CATEGORY_PARENT", "Circular category hierarchy is not allowed");
		if (visited.has(currentId)) throw catalogError("INVALID_CATEGORY_PARENT", "Circular category hierarchy is not allowed");
		visited.add(currentId);
		const current = await repository.findCategory(prisma, companyId, currentId);
		currentId = current?.parentId ?? null;
	}
};

export const listCategories = async (companyId: string, input: z.infer<typeof categoryListSchema>) => {
	const where: Prisma.CategoryWhereInput = { companyId, deletedAt: null, isActive: true, ...(input.parentId && { parentId: input.parentId }), ...(input.search && { name: { contains: input.search, mode: "insensitive" } }) };
	const [items, total] = await Promise.all([repository.listCategories(prisma, where, (input.page - 1) * input.limit, input.limit, input.includeChildren), repository.countCategories(prisma, where)]);
	return { items: items.map(categoryView), pagination: pagination(input.page, input.limit, total) };
};

export const getCategory = async (companyId: string, id: string) => {
	const category = await repository.getCategory(prisma, companyId, id);
	if (!category) throw catalogError("CATEGORY_NOT_FOUND", "Category not found", 404);
	return categoryView(category);
};

export const createCategory = async (companyId: string, userId: string, input: z.infer<typeof categorySchema>) => {
	await validateParent(companyId, input.parentId);
	if (await repository.findCategoryByName(prisma, companyId, input.name, input.parentId ?? null)) throw catalogError("CATEGORY_ALREADY_EXISTS", "Category name already exists", 409);
	if (input.logoKey) validateLogoKey(input.logoKey, companyId, "categories", "", true);
	const category = await prisma.$transaction(async (tx) => {
		const created = await repository.createCategory(tx, { companyId, name: input.name, description: input.description, parentId: input.parentId, logoKey: input.logoKey });
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "CATEGORY_CREATED", entityType: "Category", entityId: created.id, afterData: safeAudit({ name: created.name, parentId: created.parentId }) });
		return created;
	});
	return categoryView(category);
};

export const updateCategory = async (companyId: string, userId: string, id: string, input: z.infer<typeof categoryUpdateSchema>) => {
	const before = await repository.findCategory(prisma, companyId, id);
	if (!before) throw catalogError("CATEGORY_NOT_FOUND", "Category not found", 404);
	const parentId = input.parentId === undefined ? before.parentId : input.parentId;
	await validateParent(companyId, parentId, id);
	if (input.name && await repository.findCategoryByName(prisma, companyId, input.name, parentId ?? null, id)) throw catalogError("CATEGORY_ALREADY_EXISTS", "Category name already exists", 409);
	if (input.logoKey !== undefined && input.logoKey !== null) validateLogoKey(input.logoKey, companyId, "categories", id, true);
	const updated = await prisma.$transaction(async (tx) => {
		const category = await repository.updateCategory(tx, id, input);
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "CATEGORY_UPDATED", entityType: "Category", entityId: id, beforeData: safeAudit({ name: before.name, parentId: before.parentId, description: before.description }), afterData: safeAudit({ name: category.name, parentId: category.parentId, description: category.description }) });
		return category;
	});
	if (input.logoKey !== undefined && input.logoKey !== before.logoKey && before.logoKey) await deleteOldObject(before.logoKey);
	return categoryView(updated);
};

export const deleteCategory = async (companyId: string, userId: string, id: string) => {
	const category = await repository.findCategory(prisma, companyId, id);
	if (!category) throw catalogError("CATEGORY_NOT_FOUND", "Category not found", 404);
	if ((await repository.findCategoryChildren(prisma, companyId, id)).length) throw catalogError("CATEGORY_HAS_CHILDREN", "Category has active children", 409);
	if (await repository.countCategoryProducts(prisma, companyId, id)) throw catalogError("CATEGORY_HAS_PRODUCTS", "Category has active products", 409);
	await prisma.$transaction(async (tx) => {
		await repository.softDeleteCategory(tx, id);
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "CATEGORY_DELETED", entityType: "Category", entityId: id });
	});
};

export const listBrands = async (companyId: string, input: z.infer<typeof brandListSchema>) => {
	const where: Prisma.BrandWhereInput = { companyId, deletedAt: null, isActive: true, ...(input.search && { name: { contains: input.search, mode: "insensitive" } }) };
	const [items, total] = await Promise.all([repository.listBrands(prisma, where, (input.page - 1) * input.limit, input.limit, input.sortBy, input.sortOrder), repository.countBrands(prisma, where)]);
	return { items: items.map(brandView), pagination: pagination(input.page, input.limit, total) };
};

export const getBrand = async (companyId: string, id: string) => {
	const brand = await repository.getBrand(prisma, companyId, id);
	if (!brand) throw catalogError("BRAND_NOT_FOUND", "Brand not found", 404);
	return brandView(brand);
};

export const createBrand = async (companyId: string, userId: string, input: z.infer<typeof brandSchema>) => {
	if (await repository.findBrandByName(prisma, companyId, input.name)) throw catalogError("BRAND_ALREADY_EXISTS", "Brand name already exists", 409);
	if (input.logoKey) validateLogoKey(input.logoKey, companyId, "brands", "", true);
	const brand = await prisma.$transaction(async (tx) => {
		const created = await repository.createBrand(tx, { companyId, name: input.name, description: input.description, logoKey: input.logoKey });
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "BRAND_CREATED", entityType: "Brand", entityId: created.id, afterData: safeAudit({ name: created.name }) });
		return created;
	});
	return brandView(brand);
};

export const updateBrand = async (companyId: string, userId: string, id: string, input: z.infer<typeof brandUpdateSchema>) => {
	const before = await repository.findBrand(prisma, companyId, id);
	if (!before) throw catalogError("BRAND_NOT_FOUND", "Brand not found", 404);
	if (input.name && await repository.findBrandByName(prisma, companyId, input.name, id)) throw catalogError("BRAND_ALREADY_EXISTS", "Brand name already exists", 409);
	if (input.logoKey !== undefined && input.logoKey !== null) validateLogoKey(input.logoKey, companyId, "brands", id, true);
	const brand = await prisma.$transaction(async (tx) => {
		const updated = await repository.updateBrand(tx, id, input);
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "BRAND_UPDATED", entityType: "Brand", entityId: id, beforeData: safeAudit({ name: before.name, description: before.description }), afterData: safeAudit({ name: updated.name, description: updated.description }) });
		return updated;
	});
	if (input.logoKey !== undefined && input.logoKey !== before.logoKey && before.logoKey) await deleteOldObject(before.logoKey);
	return brandView(brand);
};

export const deleteBrand = async (companyId: string, userId: string, id: string) => {
	const brand = await repository.findBrand(prisma, companyId, id);
	if (!brand) throw catalogError("BRAND_NOT_FOUND", "Brand not found", 404);
	if (await repository.countBrandProducts(prisma, companyId, id)) throw catalogError("BRAND_HAS_PRODUCTS", "Brand has active products", 409);
	await prisma.$transaction(async (tx) => {
		await repository.softDeleteBrand(tx, id);
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "BRAND_DELETED", entityType: "Brand", entityId: id });
	});
};

const validateLogoKey = (key: string, companyId: string, resource: "brands" | "categories", id: string, allowStaged = false) => {
	if (allowStaged && key.startsWith(`companies/${companyId}/pending/`)) return;
	const escaped = [companyId, id].map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	if (!new RegExp(`^companies/${escaped[0]}/${resource}/${escaped[1]}/logo/[0-9a-f-]{36}\.(jpg|png|webp)$`).test(key)) throw catalogError("INVALID_IMAGE_KEY", "Invalid logo key");
};

export const createBrandLogoUploadUrl = async (companyId: string, id: string, contentType: string) => {
	ensureImageContentType(contentType);
	if (!await repository.findBrand(prisma, companyId, id)) throw catalogError("BRAND_NOT_FOUND", "Brand not found", 404);
	return createMediaUploadUrl({ companyId, resource: "BRAND_LOGO", resourceId: id, contentType });
};

export const updateBrandLogo = async (companyId: string, userId: string, id: string, logoKey: string) => {
	const brand = await repository.findBrand(prisma, companyId, id);
	if (!brand) throw catalogError("BRAND_NOT_FOUND", "Brand not found", 404);
	validateLogoKey(logoKey, companyId, "brands", id);
	const updated = await repository.updateBrand(prisma, id, { logoKey });
	await repository.createAuditLog(prisma, { companyId, actorUserId: userId, action: "BRAND_LOGO_UPDATED", entityType: "Brand", entityId: id });
	if (brand.logoKey) await deleteOldObject(brand.logoKey);
	return brandView(updated);
};

export const removeBrandLogo = async (companyId: string, userId: string, id: string) => {
	const brand = await repository.findBrand(prisma, companyId, id);
	if (!brand) throw catalogError("BRAND_NOT_FOUND", "Brand not found", 404);
	await repository.updateBrand(prisma, id, { logoKey: null });
	await repository.createAuditLog(prisma, { companyId, actorUserId: userId, action: "BRAND_LOGO_REMOVED", entityType: "Brand", entityId: id });
	if (brand.logoKey) await deleteOldObject(brand.logoKey);
};

export const createCategoryLogoUploadUrl = async (companyId: string, id: string, contentType: string) => {
	ensureImageContentType(contentType);
	if (!await repository.findCategory(prisma, companyId, id)) throw catalogError("CATEGORY_NOT_FOUND", "Category not found", 404);
	return createMediaUploadUrl({ companyId, resource: "CATEGORY_LOGO", resourceId: id, contentType });
};

export const updateCategoryLogo = async (companyId: string, userId: string, id: string, logoKey: string) => {
	const category = await repository.findCategory(prisma, companyId, id);
	if (!category) throw catalogError("CATEGORY_NOT_FOUND", "Category not found", 404);
	validateLogoKey(logoKey, companyId, "categories", id);
	const updated = await repository.updateCategory(prisma, id, { logoKey });
	await repository.createAuditLog(prisma, { companyId, actorUserId: userId, action: "CATEGORY_LOGO_UPDATED", entityType: "Category", entityId: id });
	if (category.logoKey) await deleteOldObject(category.logoKey);
	return categoryView(updated);
};

export const removeCategoryLogo = async (companyId: string, userId: string, id: string) => {
	const category = await repository.findCategory(prisma, companyId, id);
	if (!category) throw catalogError("CATEGORY_NOT_FOUND", "Category not found", 404);
	await repository.updateCategory(prisma, id, { logoKey: null });
	await repository.createAuditLog(prisma, { companyId, actorUserId: userId, action: "CATEGORY_LOGO_REMOVED", entityType: "Category", entityId: id });
	if (category.logoKey) await deleteOldObject(category.logoKey);
};

const deleteOldObject = async (key: string) => {
	try { await deleteMediaObject(key); } catch (error) { logger.error("Failed to delete replaced catalog media", error); }
};

const productWhere = (companyId: string, input: z.infer<typeof productListSchema>): Prisma.ProductWhereInput => ({
	companyId,
	...(input.includeInactive ? {} : activeProductWhere),
	...(input.categoryId && { categoryId: input.categoryId }),
	...(input.brandId && { brandId: input.brandId }),
	...(input.supplierId && { supplierId: input.supplierId }),
	...(input.search && { OR: [{ name: { contains: input.search, mode: "insensitive" } }, { sku: { contains: input.search, mode: "insensitive" } }, { barcode: { contains: input.search, mode: "insensitive" } }, { productCode: { contains: input.search, mode: "insensitive" } }] }),
});

export const listProducts = async (companyId: string, input: z.infer<typeof productListSchema>) => {
	const where = productWhere(companyId, input);
	if (input.lowStock === undefined) {
		const [items, total] = await Promise.all([repository.listProducts(prisma, where, (input.page - 1) * input.limit, input.limit, input.sortBy, input.sortOrder), repository.countProducts(prisma, where)]);
		return { items: items.map(productView), pagination: pagination(input.page, input.limit, total) };
	}
	const all = await repository.listProducts(prisma, where, undefined, undefined, input.sortBy, input.sortOrder);
	const filtered = all.filter((product) => (numberValue(product.stockQuantity) <= numberValue(product.lowStockThreshold)) === input.lowStock);
	const start = (input.page - 1) * input.limit;
	return { items: filtered.slice(start, start + input.limit).map(productView), pagination: pagination(input.page, input.limit, filtered.length) };
};

export const getProduct = async (companyId: string, id: string) => {
	const product = await repository.findProduct(prisma, companyId, id);
	if (!product) throw catalogError("PRODUCT_NOT_FOUND", "Product not found", 404);
	return productView(product);
};

const validateProductRelations = async (companyId: string, input: { categoryId: string; brandId?: string | null; supplierId?: string | null }) => {
	if (!await repository.findActiveRelatedCategory(prisma, companyId, input.categoryId)) throw catalogError("INVALID_PRODUCT_CATEGORY", "Category is invalid");
	if (input.brandId && !await repository.findActiveRelatedBrand(prisma, companyId, input.brandId)) throw catalogError("INVALID_PRODUCT_BRAND", "Brand is invalid");
	if (input.supplierId && !await repository.findActiveRelatedSupplier(prisma, companyId, input.supplierId)) throw catalogError("INVALID_PRODUCT_SUPPLIER", "Supplier is invalid");
};

export const createProduct = async (companyId: string, userId: string, input: z.infer<typeof productSchema>) => {
	if (input.takealotSync && !input.takealotProductId) throw catalogError("INVALID_TAKEALOT_CONFIGURATION", "Takealot product ID is required when sync is enabled");
	await validateProductRelations(companyId, input);
	if (await repository.findProductBySku(prisma, companyId, input.sku)) throw catalogError("PRODUCT_SKU_EXISTS", "SKU already exists", 409);
	if (input.barcode && await repository.findProductByBarcode(prisma, companyId, input.barcode)) throw catalogError("PRODUCT_BARCODE_EXISTS", "Barcode already exists", 409);
	const product = await prisma.$transaction(async (tx) => {
		input.imageKeys.forEach((key) => validateProductImageKey(key, companyId, "pending"));
		const created = await repository.createProduct(tx, { ...input, companyId, stockQuantity: input.stockQuantity, averageCost: input.purchaseCost, imageKeys: input.imageKeys, takealotProductId: input.takealotProductId, takealotSync: input.takealotSync });
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "PRODUCT_CREATED", entityType: "Product", entityId: created.id, afterData: safeAudit({ name: created.name, sku: created.sku, sellingPrice: created.sellingPrice }) });
		return created;
	});
	return productView(product);
};

export const updateProduct = async (companyId: string, userId: string, id: string, input: z.infer<typeof productUpdateSchema>) => {
	const before = await repository.findProduct(prisma, companyId, id);
	if (!before) throw catalogError("PRODUCT_NOT_FOUND", "Product not found", 404);
	if (input.categoryId || input.brandId !== undefined || input.supplierId !== undefined) await validateProductRelations(companyId, { categoryId: input.categoryId ?? before.categoryId, brandId: input.brandId === undefined ? before.brandId : input.brandId, supplierId: input.supplierId === undefined ? before.supplierId : input.supplierId });
	if (input.sku && await repository.findProductBySku(prisma, companyId, input.sku, id)) throw catalogError("PRODUCT_SKU_EXISTS", "SKU already exists", 409);
	if (input.barcode && await repository.findProductByBarcode(prisma, companyId, input.barcode, id)) throw catalogError("PRODUCT_BARCODE_EXISTS", "Barcode already exists", 409);
	if (input.imageKeys) input.imageKeys.forEach((key) => validateProductImageKey(key, companyId, id));
	const resultingTakealotId = input.takealotProductId === undefined ? before.takealotProductId : input.takealotProductId;
	const resultingSync = input.takealotProductId === null ? false : input.takealotSync === undefined ? before.takealotSync : input.takealotSync;
	if (resultingSync && !resultingTakealotId) throw catalogError("INVALID_TAKEALOT_CONFIGURATION", "Takealot product ID is required when sync is enabled");
	const product = await prisma.$transaction(async (tx) => {
		const updated = await repository.updateProduct(tx, id, { ...input, takealotProductId: resultingTakealotId, takealotSync: resultingSync });
		const priceChanged = ["rrp", "sellingPrice", "purchaseCost"].some((field) => (input as Record<string, unknown>)[field] !== undefined);
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "PRODUCT_UPDATED", entityType: "Product", entityId: id, beforeData: safeAudit({ name: before.name, sku: before.sku, rrp: before.rrp, sellingPrice: before.sellingPrice, purchaseCost: before.purchaseCost }), afterData: safeAudit({ name: updated.name, sku: updated.sku, rrp: updated.rrp, sellingPrice: updated.sellingPrice, purchaseCost: updated.purchaseCost }), metadata: safeAudit({ priceChanged }) });
		return updated;
	});
	return productView(product);
};

export const deleteProduct = async (companyId: string, userId: string, id: string) => {
	const product = await repository.findProduct(prisma, companyId, id);
	if (!product) throw catalogError("PRODUCT_NOT_FOUND", "Product not found", 404);
	await prisma.$transaction(async (tx) => {
		await repository.softDeleteProduct(tx, id);
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "PRODUCT_DELETED", entityType: "Product", entityId: id });
	});
};

const validateProductImageKey = (key: string, companyId: string, productId: string) => {
	if (key.startsWith(`companies/${companyId}/pending/product_image/`) && /\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(key)) return;
	const escaped = [companyId, productId].map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	if (!new RegExp(`^companies/${escaped[0]}/products/${escaped[1]}/[0-9a-f-]{36}\.(jpg|png|webp)$`).test(key)) throw catalogError("INVALID_IMAGE_KEY", "Invalid product image key");
};

export const createProductImageUploadUrls = async (companyId: string, id: string, contentTypes: string[]) => {
	contentTypes.forEach(ensureImageContentType);
	if (!await repository.findProduct(prisma, companyId, id)) throw catalogError("PRODUCT_NOT_FOUND", "Product not found", 404);
	return createMediaUploadUrls({ companyId, resource: "PRODUCT_IMAGE", resourceId: id, contentTypes });
};

export const addProductImages = async (companyId: string, userId: string, id: string, imageKeys: string[]) => {
	const product = await repository.findProduct(prisma, companyId, id);
	if (!product) throw catalogError("PRODUCT_NOT_FOUND", "Product not found", 404);
	imageKeys.forEach((key) => validateProductImageKey(key, companyId, id));
	if (new Set(imageKeys).size !== imageKeys.length || imageKeys.some((key) => product.imageKeys.includes(key))) throw catalogError("INVALID_IMAGE_KEY", "Duplicate product image key");
	if (product.imageKeys.length + imageKeys.length > 10) throw catalogError("IMAGE_LIMIT_EXCEEDED", "A product may have at most 10 images", 409);
	const updated = await repository.updateProductImages(prisma, id, [...product.imageKeys, ...imageKeys]);
	await repository.createAuditLog(prisma, { companyId, actorUserId: userId, action: "PRODUCT_IMAGES_UPDATED", entityType: "Product", entityId: id });
	return { imageKeys: updated.imageKeys };
};

export const reorderProductImages = async (companyId: string, userId: string, id: string, imageKeys: string[]) => {
	const product = await repository.findProduct(prisma, companyId, id);
	if (!product) throw catalogError("PRODUCT_NOT_FOUND", "Product not found", 404);
	if (new Set(imageKeys).size !== imageKeys.length || imageKeys.length !== product.imageKeys.length || imageKeys.some((key) => !product.imageKeys.includes(key))) throw catalogError("INVALID_IMAGE_KEY", "Image order must contain the existing image keys exactly");
	const updated = await repository.updateProductImages(prisma, id, imageKeys);
	await repository.createAuditLog(prisma, { companyId, actorUserId: userId, action: "PRODUCT_IMAGES_UPDATED", entityType: "Product", entityId: id });
	return { imageKeys: updated.imageKeys };
};

export const removeProductImage = async (companyId: string, userId: string, id: string, imageKey: string) => {
	const product = await repository.findProduct(prisma, companyId, id);
	if (!product) throw catalogError("PRODUCT_NOT_FOUND", "Product not found", 404);
	validateProductImageKey(imageKey, companyId, id);
	if (!product.imageKeys.includes(imageKey)) throw catalogError("IMAGE_NOT_FOUND", "Product image not found", 404);
	const updated = await repository.updateProductImages(prisma, id, product.imageKeys.filter((key) => key !== imageKey));
	await repository.createAuditLog(prisma, { companyId, actorUserId: userId, action: "PRODUCT_IMAGE_REMOVED", entityType: "Product", entityId: id });
	await deleteOldObject(imageKey);
	return { imageKeys: updated.imageKeys };
};

export const createProductImageDownloadUrl = async (companyId: string, id: string, imageIndex: number) => {
	const product = await repository.findProduct(prisma, companyId, id);
	if (!product) throw catalogError("PRODUCT_NOT_FOUND", "Product not found", 404);
	const key = product.imageKeys[imageIndex];
	if (!key) throw catalogError("IMAGE_NOT_FOUND", "Product image not found", 404);
	return createMediaDownloadUrl({ key });
};

export const catalogAccess = { products: Access.PRODUCTS, brands: Access.BRANDS, categories: Access.CATEGORIES } as const;