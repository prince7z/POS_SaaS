import { Router } from "express";
import { Access } from "@prisma/client";

import { requireAccess } from "../../middleware/access";
import { requireAuth } from "../../middleware/auth";
import { sendMessage, sendSuccess } from "../../utils/apiResponse";
import { unauthorized, validationError } from "../../utils/errors";
import * as service from "./service";

const router = Router();

const authContext = (request: import("express").Request) => {
	if (!request.auth) throw unauthorized();
	return request.auth;
};

const idFrom = (request: import("express").Request): string => {
	const id = request.params.id;
	if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw validationError("Invalid catalog id");
	return id;
};

const imageIndexFrom = (request: import("express").Request): number => {
	const value = request.params.imageIndex;
	const index = Number(value);
	if (!Number.isInteger(index) || index < 0) throw validationError("Invalid image index");
	return index;
};

const categoryAccess = [requireAuth, requireAccess(Access.CATEGORIES)] as const;
const brandAccess = [requireAuth, requireAccess(Access.BRANDS)] as const;
const productAccess = [requireAuth, requireAccess(Access.PRODUCTS)] as const;

router.get("/categories", ...categoryAccess, async (request, response) => {
	return sendSuccess(response, await service.listCategories(authContext(request).companyId, service.parse(service.categoryListSchema, request.query)));
});
router.get("/categories/:id", ...categoryAccess, async (request, response) => {
	return sendSuccess(response, await service.getCategory(authContext(request).companyId, idFrom(request)));
});
router.post("/categories", ...categoryAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.createCategory(auth.companyId, auth.userId, service.parse(service.categorySchema, request.body)), 201);
});
router.patch("/categories/:id", ...categoryAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.updateCategory(auth.companyId, auth.userId, idFrom(request), service.parse(service.categoryUpdateSchema, request.body)));
});
router.delete("/categories/:id", ...categoryAccess, async (request, response) => {
	const auth = authContext(request);
	await service.deleteCategory(auth.companyId, auth.userId, idFrom(request));
	return sendMessage(response, "Category deleted successfully");
});
router.post("/categories/:id/logo/upload-url", ...categoryAccess, async (request, response) => {
	return sendSuccess(response, await service.createCategoryLogoUploadUrl(authContext(request).companyId, idFrom(request), service.parse(service.contentTypeSchema, request.body).contentType));
});
router.patch("/categories/:id/logo", ...categoryAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.updateCategoryLogo(auth.companyId, auth.userId, idFrom(request), service.parse(service.logoKeySchema, request.body).logoKey));
});
router.delete("/categories/:id/logo", ...categoryAccess, async (request, response) => {
	const auth = authContext(request);
	await service.removeCategoryLogo(auth.companyId, auth.userId, idFrom(request));
	return sendMessage(response, "Category logo removed successfully");
});

router.get("/brands", ...brandAccess, async (request, response) => {
	return sendSuccess(response, await service.listBrands(authContext(request).companyId, service.parse(service.brandListSchema, request.query)));
});
router.get("/brands/:id", ...brandAccess, async (request, response) => {
	return sendSuccess(response, await service.getBrand(authContext(request).companyId, idFrom(request)));
});
router.post("/brands", ...brandAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.createBrand(auth.companyId, auth.userId, service.parse(service.brandSchema, request.body)), 201);
});
router.patch("/brands/:id", ...brandAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.updateBrand(auth.companyId, auth.userId, idFrom(request), service.parse(service.brandUpdateSchema, request.body)));
});
router.delete("/brands/:id", ...brandAccess, async (request, response) => {
	const auth = authContext(request);
	await service.deleteBrand(auth.companyId, auth.userId, idFrom(request));
	return sendMessage(response, "Brand deleted successfully");
});
router.post("/brands/:id/logo/upload-url", ...brandAccess, async (request, response) => {
	return sendSuccess(response, await service.createBrandLogoUploadUrl(authContext(request).companyId, idFrom(request), service.parse(service.contentTypeSchema, request.body).contentType));
});
router.patch("/brands/:id/logo", ...brandAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.updateBrandLogo(auth.companyId, auth.userId, idFrom(request), service.parse(service.logoKeySchema, request.body).logoKey));
});
router.delete("/brands/:id/logo", ...brandAccess, async (request, response) => {
	const auth = authContext(request);
	await service.removeBrandLogo(auth.companyId, auth.userId, idFrom(request));
	return sendMessage(response, "Brand logo removed successfully");
});

router.get("/products", ...productAccess, async (request, response) => {
	return sendSuccess(response, await service.listProducts(authContext(request).companyId, service.parse(service.productListSchema, request.query)));
});
router.get("/products/:id", ...productAccess, async (request, response) => {
	return sendSuccess(response, await service.getProduct(authContext(request).companyId, idFrom(request)));
});
router.post("/products", ...productAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.createProduct(auth.companyId, auth.userId, service.parse(service.productSchema, request.body)), 201);
});
router.patch("/products/:id", ...productAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.updateProduct(auth.companyId, auth.userId, idFrom(request), service.parse(service.productUpdateSchema, request.body)));
});
router.delete("/products/:id", ...productAccess, async (request, response) => {
	const auth = authContext(request);
	await service.deleteProduct(auth.companyId, auth.userId, idFrom(request));
	return sendMessage(response, "Product deleted successfully");
});
router.post("/products/:id/images/upload-urls", ...productAccess, async (request, response) => {
	const auth = authContext(request);
	const uploads = await service.createProductImageUploadUrls(auth.companyId, idFrom(request), service.parse(service.uploadImageSchema, request.body).contentTypes);
	return sendSuccess(response, { uploads });
});
router.post("/products/:id/images", ...productAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.addProductImages(auth.companyId, auth.userId, idFrom(request), service.parse(service.imageKeysSchema, request.body).imageKeys));
});
router.patch("/products/:id/images", ...productAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.reorderProductImages(auth.companyId, auth.userId, idFrom(request), service.parse(service.imageKeysSchema, request.body).imageKeys));
});
router.delete("/products/:id/images", ...productAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.removeProductImage(auth.companyId, auth.userId, idFrom(request), service.parse(service.imageKeySchema, request.body).imageKey));
});
router.get("/products/:id/images/:imageIndex/url", ...productAccess, async (request, response) => {
	return sendSuccess(response, await service.createProductImageDownloadUrl(authContext(request).companyId, idFrom(request), imageIndexFrom(request)));
});

export default router;