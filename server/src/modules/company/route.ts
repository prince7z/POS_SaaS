import { Router, type Request } from "express";
import { Access } from "@prisma/client";

import { requireAccess } from "../../middleware/access";
import { requireAuth } from "../../middleware/auth";
import { sendMessage, sendSuccess } from "../../utils/apiResponse";
import { unauthorized, validationError } from "../../utils/errors";
import * as service from "./service";

const router = Router();

const currentAuth = (request: Request) => {
	if (!request.auth) throw unauthorized();
	return request.auth;
};

const userIdFrom = (request: Request): string => {
	const userId = request.params.userId;
	if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) throw validationError("Invalid user id");
	return userId;
};

router.get("/", requireAuth, requireAccess(Access.SETTINGS), async (request, response) => {
	return sendSuccess(response, await service.getCompany(currentAuth(request).companyId));
});

router.patch("/", requireAuth, requireAccess(Access.SETTINGS), async (request, response) => {
	const auth = currentAuth(request);
	const input = service.parse(service.companyUpdateSchema, request.body);
	return sendSuccess(response, await service.updateCompany(auth.companyId, auth.userId, input));
});

router.post("/logo/upload-url", requireAuth, requireAccess(Access.SETTINGS), async (request, response) => {
	return sendSuccess(response, await service.createCompanyLogoUploadUrl(currentAuth(request).companyId, service.parse(service.contentTypeSchema, request.body).contentType));
});

router.patch("/logo", requireAuth, requireAccess(Access.SETTINGS), async (request, response) => {
	const auth = currentAuth(request);
	return sendSuccess(response, await service.updateCompanyLogo(auth.companyId, auth.userId, service.parse(service.logoKeySchema, request.body).logoKey));
});

router.delete("/logo", requireAuth, requireAccess(Access.SETTINGS), async (request, response) => {
	const auth = currentAuth(request);
	await service.removeCompanyLogo(auth.companyId, auth.userId);
	return sendMessage(response, "Company logo removed successfully");
});

router.get("/users", requireAuth, requireAccess(Access.USERS_ROLES), async (request, response) => {
	const auth = currentAuth(request);
	const { page, limit } = service.parse(service.paginationSchema, request.query);
	return sendSuccess(response, await service.getUsers(auth.companyId, page, limit));
});

router.post("/users", requireAuth, requireAccess(Access.USERS_ROLES), async (request, response) => {
	const auth = currentAuth(request);
	const input = service.parse(service.createUserSchema, request.body);
	return sendSuccess(response, await service.createUser(auth.companyId, auth.userId, input), 201);
});

router.patch("/users/:userId", requireAuth, requireAccess(Access.USERS_ROLES), async (request, response) => {
	const auth = currentAuth(request);
	const input = service.parse(service.updateUserSchema, request.body);
	return sendSuccess(response, await service.updateUser(auth.companyId, auth.userId, userIdFrom(request), input));
});

router.delete("/users/:userId", requireAuth, requireAccess(Access.USERS_ROLES), async (request, response) => {
	const auth = currentAuth(request);
	await service.deactivateUser(auth.companyId, auth.userId, userIdFrom(request));
	return sendMessage(response, "User deactivated successfully");
});

router.get("/accesses", requireAuth, requireAccess(Access.USERS_ROLES), async (_request, response) => {
	return sendSuccess(response, service.getAccesses());
});

export default router;