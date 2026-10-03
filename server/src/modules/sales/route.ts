import { Access } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

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

const idFrom = (request: import("express").Request) => {
	const id = request.params.id;
	if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw validationError("Invalid sale id");
	return id;
};

const saleAccess = [requireAuth, requireAccess(Access.POS)] as const;
const salesReadAccess = [requireAuth, requireAccess(Access.POS), requireAccess(Access.INVOICES)] as const;
const returnsAccess = [requireAuth, requireAccess(Access.RETURNS)] as const;

router.get("/public/invoices/:id", async (request, response) => {
	const id = request.params.id;
	if (typeof id !== "string" || id.trim().length === 0 || id.length > 100) throw validationError("Invalid invoice id");
	return sendSuccess(response, await service.getPublicInvoice(id));
});

router.post("/drafts", ...saleAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.createSaleDraft(auth.companyId, auth.userId, service.parse(service.saleDraftSchema, request.body)), 201);
});

router.patch("/:id/draft", ...saleAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.updateSaleDraft(auth.companyId, auth.userId, idFrom(request), service.parse(service.saleDraftUpdateSchema, request.body)));
});

router.get("/returns", ...returnsAccess, async (request, response) => {
	return sendSuccess(response, await service.listReturns(authContext(request).companyId, service.parse(service.returnListSchema, request.query)));
});
router.get("/returns/summary", ...returnsAccess, async (request, response) => {
	const input = service.parse(service.returnListSchema, request.query);
	return sendSuccess(response, await service.returnSummary(authContext(request).companyId, input));
});

router.get("/", ...salesReadAccess, async (request, response) => {
	return sendSuccess(response, await service.listSales(authContext(request).companyId, service.parse(service.saleListSchema, request.query)));
});

router.get("/:id/returnable-items", ...returnsAccess, async (request, response) => {
	return sendSuccess(response, await service.getReturnableItems(authContext(request).companyId, idFrom(request)));
});

router.post("/:id/returns", ...returnsAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.createReturn(auth.companyId, auth.userId, idFrom(request), service.parse(service.returnCreateSchema, request.body)), 201);
});

router.get("/:id/returns", ...returnsAccess, async (request, response) => {
	return sendSuccess(response, await service.listReturnsForSale(authContext(request).companyId, idFrom(request)));
});

router.get("/:id", ...salesReadAccess, async (request, response) => {
	return sendSuccess(response, await service.getSale(authContext(request).companyId, idFrom(request)));
});

router.post("/:id/complete", ...saleAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.completeSale(auth.companyId, auth.userId, idFrom(request), service.parse(service.saleCompleteSchema, request.body)));
});

router.post("/:id/send", ...salesReadAccess, async (request, response) => {
	const auth = authContext(request);
	const body = request.body as { email?: unknown };
	const email = typeof body.email === "string" && body.email.trim() ? service.parse(z.object({ email: z.string().email() }), { email: body.email }).email : undefined;
	return sendSuccess(response, await service.sendInvoice(auth.companyId, auth.userId, idFrom(request), email), 202);
});

router.post("/:id/cancel", ...saleAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.cancelSale(auth.companyId, auth.userId, idFrom(request)));
});

export default router;
