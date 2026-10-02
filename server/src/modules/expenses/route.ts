import { Access } from "@prisma/client";
import { Router } from "express";

import { requireAccess } from "../../middleware/access";
import { requireAuth } from "../../middleware/auth";
import { sendMessage, sendSuccess } from "../../utils/apiResponse";
import { unauthorized } from "../../utils/errors";
import * as service from "./service";

const router = Router();
const access = [requireAuth, requireAccess(Access.EXPENSES)] as const;
const auth = (request: import("express").Request) => {
	if (!request.auth) throw unauthorized();
	return request.auth;
};
const filters = (request: import("express").Request) => service.parse(service.expenseListSchema, request.query);
const summaryFilters = (request: import("express").Request) => service.parse(service.summarySchema, request.query);

router.get("/summary", ...access, async (request, response) => sendSuccess(response, await service.summary(auth(request).companyId, summaryFilters(request))));
router.get("/analytics", ...access, async (request, response) => sendSuccess(response, await service.analytics(auth(request).companyId, summaryFilters(request))));
router.get("/export", ...access, async (request, response) => response.type("text/csv").attachment("expenses.csv").send(await service.csv(auth(request).companyId, filters(request))));
router.get("/", ...access, async (request, response) => sendSuccess(response, await service.list(auth(request).companyId, filters(request))));
router.get("/:id", ...access, async (request, response) => sendSuccess(response, await service.get(auth(request).companyId, service.id(request.params.id))));
router.post("/", ...access, async (request, response) => {
	const context = auth(request);
	return sendSuccess(response, await service.create(context.companyId, context.userId, service.parse(service.expenseCreateSchema, request.body)), 201);
});
router.patch("/:id", ...access, async (request, response) => sendSuccess(response, await service.update(auth(request).companyId, service.id(request.params.id), service.parse(service.expenseUpdateSchema, request.body))));
router.delete("/:id", ...access, async (request, response) => {
	await service.remove(auth(request).companyId, service.id(request.params.id));
	return sendMessage(response, "Expense deleted successfully");
});

export default router;
