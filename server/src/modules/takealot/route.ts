import { Access } from "@prisma/client";
import { Router, type Request, type Response } from "express";

import { requireTakealotApiKey } from "../../middleware/takealot";
import { requireAccess } from "../../middleware/access";
import { requireAuth } from "../../middleware/auth";
import { sendSuccess } from "../../utils/apiResponse";
import { AppError, unauthorized } from "../../utils/errors";
import * as service from "./service";

const router = Router();
router.use(requireAuth, requireAccess(Access.TAKEALOT));

const authFrom = (request: Request) => {
	if (!request.auth) throw unauthorized();
	return request.auth;
};

const apiKeyFrom = (request: Request) => {
	if (!request.takealotApiKey) {
		throw new AppError("Takealot API key is not configured.", 422, "TAKEALOT_API_NOT_CONFIGURED");
	}
	return request.takealotApiKey;
};

const sendPaginatedSuccess = (response: Response, data: unknown, pagination: unknown) =>
	response.status(200).json({ success: true, data, pagination });

router.get("/overview", requireTakealotApiKey, async (request, response) => {
	const input = service.parse(service.overviewSchema, request.query);
	return sendSuccess(response, await service.overview(apiKeyFrom(request), input));
});

router.get("/sales", requireTakealotApiKey, async (request, response) => {
	const result = await service.listSales(
		apiKeyFrom(request),
		service.parse(service.salesListSchema, request.query),
	);
	return sendPaginatedSuccess(response, { sales: result.sales }, result.pagination);
});

router.get("/sales/trends", requireTakealotApiKey, async (request, response) => {
	const companyId = authFrom(request).companyId;
	return sendSuccess(response, await service.salesTrends(
		companyId,
		apiKeyFrom(request),
		service.parse(service.trendsSchema, request.query),
	));
});

router.get("/sales/breakdown", requireTakealotApiKey, async (request, response) => {
	const companyId = authFrom(request).companyId;
	return sendSuccess(response, await service.salesBreakdown(
		companyId,
		apiKeyFrom(request),
		service.parse(service.breakdownSchema, request.query),
	));
});

router.get("/products/performance", requireTakealotApiKey, async (request, response) => {
	const companyId = authFrom(request).companyId;
	const result = await service.productPerformance(
		companyId,
		apiKeyFrom(request),
		service.parse(service.productsSchema, request.query),
	);
	const { pagination, ...data } = result;
	return sendPaginatedSuccess(response, data, pagination);
});

router.get("/orders", requireTakealotApiKey, async (request, response) => {
	const result = await service.listOrders(
		apiKeyFrom(request),
		service.parse(service.ordersSchema, request.query),
	);
	return sendPaginatedSuccess(response, { orders: result.orders }, result.pagination);
});

router.get("/inventory/summary", requireTakealotApiKey, async (request, response) => {
	return sendSuccess(response, await service.inventorySummary(authFrom(request).companyId, apiKeyFrom(request)));
});

router.get("/inventory/snapshots", async (request, response) => {
	return sendSuccess(response, await service.inventorySnapshots(
		authFrom(request).companyId,
		service.parse(service.inventorySnapshotsSchema, request.query),
	));
});

export default router;
