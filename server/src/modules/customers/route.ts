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
	if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw validationError("Invalid customer id");
	return id;
};

const customerAccess = [requireAuth, requireAccess(Access.CUSTOMERS)] as const;

router.get("/", ...customerAccess, async (request, response) => {
	return sendSuccess(response, await service.listCustomers(authContext(request).companyId, service.parse(service.listSchema, request.query)));
});
router.get("/summary", ...customerAccess, async (request, response) => {
	const query = request.query as { from?: string; to?: string };
	return sendSuccess(response, await service.getSummary(authContext(request).companyId, query.from, query.to));
});
router.get("/:id/summary", ...customerAccess, async (request, response) => {
	return sendSuccess(response, await service.getCustomerSummary(authContext(request).companyId, idFrom(request)));
});
router.get("/:id", ...customerAccess, async (request, response) => {
	return sendSuccess(response, await service.getCustomer(authContext(request).companyId, idFrom(request)));
});
router.post("/", ...customerAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.createCustomer(auth.companyId, auth.userId, service.parse(service.createSchema, request.body)), 201);
});
router.patch("/:id", ...customerAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.updateCustomer(auth.companyId, auth.userId, idFrom(request), service.parse(service.updateSchema, request.body)));
});
router.delete("/:id", ...customerAccess, async (request, response) => {
	const auth = authContext(request);
	await service.deleteCustomer(auth.companyId, auth.userId, idFrom(request));
	return sendMessage(response, "Customer deleted successfully");
});

router.post("/:id/profile/upload-url", ...customerAccess, async (request, response) => {
	return sendSuccess(response, await service.createProfileUploadUrl(authContext(request).companyId, idFrom(request), service.parse(service.contentTypeSchema, request.body).contentType));
});
router.patch("/:id/profile", ...customerAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.updateProfile(auth.companyId, auth.userId, idFrom(request), service.parse(service.profileKeySchema, request.body).profileImageKey));
});
router.delete("/:id/profile", ...customerAccess, async (request, response) => {
	const auth = authContext(request);
	await service.removeProfile(auth.companyId, auth.userId, idFrom(request));
	return sendMessage(response, "Profile image removed successfully");
});
router.get("/:id/profile/url", ...customerAccess, async (request, response) => {
	return sendSuccess(response, await service.profileUrl(authContext(request).companyId, idFrom(request)));
});

router.post("/:id/payments", ...customerAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.recordPayment(auth.companyId, auth.userId, idFrom(request), service.parse(service.paymentSchema, request.body)), 201);
});
router.get("/:id/payments", ...customerAccess, async (request, response) => {
	return sendSuccess(response, await service.listPayments(authContext(request).companyId, idFrom(request), service.parse(service.paymentListSchema, request.query)));
});

export default router;