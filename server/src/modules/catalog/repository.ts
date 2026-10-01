import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

const activeCategoryWhere = { deletedAt: null, isActive: true } as const;
const activeBrandWhere = { deletedAt: null, isActive: true } as const;
const activeProductWhere = { deletedAt: null, isActive: true } as const;

export const findCategory = (db: Db, companyId: string, id: string) =>
	db.category.findFirst({ where: { id, companyId, deletedAt: null } });

export const findCategoryByName = (db: Db, companyId: string, name: string, parentId: string | null, excludeId?: string) =>
	db.category.findFirst({ where: { companyId, name, parentId, ...(excludeId && { id: { not: excludeId } }), deletedAt: null } });

export const findActiveParent = (db: Db, companyId: string, parentId: string) =>
	db.category.findFirst({ where: { id: parentId, companyId, ...activeCategoryWhere } });

export const findCategoryChildren = (db: Db, companyId: string, parentId: string) =>
	db.category.findMany({ where: { companyId, parentId, ...activeCategoryWhere }, orderBy: { name: "asc" } });

export const countCategoryProducts = (db: Db, companyId: string, categoryId: string) =>
	db.product.count({ where: { companyId, categoryId, ...activeProductWhere } });

export const countCategories = (db: Db, where: Prisma.CategoryWhereInput) => db.category.count({ where });

export const listCategories = (db: Db, where: Prisma.CategoryWhereInput, skip: number, take: number, includeChildren: boolean) =>
	db.category.findMany({
		where,
		orderBy: { name: "asc" },
		skip,
		take,
		include: includeChildren ? { children: { where: activeCategoryWhere, orderBy: { name: "asc" } } } : undefined,
	});

export const getCategory = (db: Db, companyId: string, id: string) =>
	db.category.findFirst({
		where: { id, companyId, deletedAt: null },
		include: { children: { where: activeCategoryWhere, orderBy: { name: "asc" } }, _count: { select: { products: { where: activeProductWhere } } } },
	});

export const createCategory = (db: Db, data: Prisma.CategoryUncheckedCreateInput) => db.category.create({ data });
export const updateCategory = (db: Db, id: string, data: Prisma.CategoryUpdateInput) => db.category.update({ where: { id }, data });
export const softDeleteCategory = (db: Db, id: string) => db.category.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });

export const findBrand = (db: Db, companyId: string, id: string) => db.brand.findFirst({ where: { id, companyId, deletedAt: null } });
export const findBrandByName = (db: Db, companyId: string, name: string, excludeId?: string) => db.brand.findFirst({ where: { companyId, name, ...(excludeId && { id: { not: excludeId } }), deletedAt: null } });
export const countBrandProducts = (db: Db, companyId: string, brandId: string) => db.product.count({ where: { companyId, brandId, ...activeProductWhere } });
export const countBrands = (db: Db, where: Prisma.BrandWhereInput) => db.brand.count({ where });
export const listBrands = (db: Db, where: Prisma.BrandWhereInput, skip: number, take: number, sortBy: "name" | "createdAt", sortOrder: "asc" | "desc") =>
	db.brand.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip, take, include: { _count: { select: { products: { where: activeProductWhere } } } } });
export const getBrand = (db: Db, companyId: string, id: string) => db.brand.findFirst({ where: { id, companyId, deletedAt: null }, include: { _count: { select: { products: { where: activeProductWhere } } } } });
export const createBrand = (db: Db, data: Prisma.BrandUncheckedCreateInput) => db.brand.create({ data });
export const updateBrand = (db: Db, id: string, data: Prisma.BrandUpdateInput) => db.brand.update({ where: { id }, data });
export const softDeleteBrand = (db: Db, id: string) => db.brand.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });

const productRelations = {
	category: { select: { id: true, name: true, parentId: true } },
	brand: { select: { id: true, name: true } },
	supplier: { select: { id: true, name: true } },
} as const;

export const findProduct = (db: Db, companyId: string, id: string) => db.product.findFirst({ where: { id, companyId, deletedAt: null }, include: productRelations });
export const findProductBySku = (db: Db, companyId: string, sku: string, excludeId?: string) => db.product.findFirst({ where: { companyId, sku, ...(excludeId && { id: { not: excludeId } }) } });
export const findProductByBarcode = (db: Db, companyId: string, barcode: string, excludeId?: string) => db.product.findFirst({ where: { companyId, barcode, ...(excludeId && { id: { not: excludeId } }) } });
export const countProducts = (db: Db, where: Prisma.ProductWhereInput) => db.product.count({ where });
export const listProducts = (db: Db, where: Prisma.ProductWhereInput, skip: number | undefined, take: number | undefined, sortBy: "name" | "sellingPrice" | "stockQuantity" | "createdAt", sortOrder: "asc" | "desc") =>
	db.product.findMany({ where, orderBy: { [sortBy]: sortOrder }, ...(skip !== undefined && { skip }), ...(take !== undefined && { take }), include: productRelations });
export const createProduct = (db: Db, data: Prisma.ProductUncheckedCreateInput) => db.product.create({ data, include: productRelations });
export const updateProduct = (db: Db, id: string, data: Prisma.ProductUpdateInput) => db.product.update({ where: { id }, data, include: productRelations });
export const softDeleteProduct = (db: Db, id: string) => db.product.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
export const updateProductImages = (db: Db, id: string, imageKeys: string[]) => db.product.update({ where: { id }, data: { imageKeys } });

export const findActiveRelatedCategory = (db: Db, companyId: string, id: string) => db.category.findFirst({ where: { id, companyId, ...activeCategoryWhere } });
export const findActiveRelatedBrand = (db: Db, companyId: string, id: string) => db.brand.findFirst({ where: { id, companyId, ...activeBrandWhere } });
export const findActiveRelatedSupplier = (db: Db, companyId: string, id: string) => db.supplier.findFirst({ where: { id, companyId, isActive: true } });

export const productHasHistory = async (db: Db, productId: string) => {
	const [sales, purchases, movements, returns] = await Promise.all([
		db.saleItem.count({ where: { productId } }),
		db.purchaseOrderItem.count({ where: { productId } }),
		db.inventoryMovement.count({ where: { productId } }),
		db.returnItem.count({ where: { productId } }),
	]);
	return sales + purchases + movements + returns > 0;
};

export const createAuditLog = (db: Db, data: Prisma.AuditLogUncheckedCreateInput) => db.auditLog.create({ data });