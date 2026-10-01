import { Router } from "express";
import { Access } from "@prisma/client";

import { requireAccess } from "../../middleware/access";
import { requireAuth } from "../../middleware/auth";
import { sendSuccess } from "../../utils/apiResponse";
import { unauthorized, validationError } from "../../utils/errors";
import * as service from "./service";

const router = Router();

const authContext = (request: import("express").Request) => {
	if (!request.auth) throw unauthorized();
	return request.auth;
};

const productIdFrom = (request: import("express").Request): string => {
	const productId = request.params.productId;
	if (typeof productId !== "string" || !/^[0-9a-f-]{36}$/i.test(productId)) throw validationError("Invalid product id");
	return productId;
};

const inventoryAccess = [requireAuth, requireAccess(Access.INVENTORY)] as const;

router.get("/", ...inventoryAccess, async (request, response) => {
	return sendSuccess(response, await service.listInventory(authContext(request).companyId, service.parse(service.listSchema, request.query)));
});
router.get("/summary", ...inventoryAccess, async (request, response) => {
	return sendSuccess(response, await service.getSummary(authContext(request).companyId));
});
router.get("/:productId/movements", ...inventoryAccess, async (request, response) => {
	return sendSuccess(response, await service.listMovements(authContext(request).companyId, productIdFrom(request), service.parse(service.movementListSchema, request.query)));
});
router.get("/:productId", ...inventoryAccess, async (request, response) => {
	return sendSuccess(response, await service.getProductInventory(authContext(request).companyId, productIdFrom(request)));
});
router.post("/opening-stock", ...inventoryAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.setOpeningStock(auth.companyId, auth.userId, service.parse(service.openingSchema, request.body)), 201);
});
router.post("/adjust", ...inventoryAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.adjustStock(auth.companyId, auth.userId, service.parse(service.adjustmentSchema, request.body)), 201);
});

export default router;