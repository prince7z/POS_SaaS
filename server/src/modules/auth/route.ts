import { Router } from "express";

import { requireAuth } from "../../middleware/auth";
import { sendMessage, sendSuccess } from "../../utils/apiResponse";
import { unauthorized } from "../../utils/errors";
import * as service from "./service";

const router = Router();

router.post("/register", async (request, response) => {
	const input = service.parse(service.registerSchema, request.body);
	return sendSuccess(response, await service.register(input), 201);
});

router.post("/login", async (request, response) => {
	const input = service.parse(service.loginSchema, request.body);
	return sendSuccess(response, await service.login(input));
});

router.post("/refresh", async (request, response) => {
	const { refreshToken } = service.parse(service.refreshSchema, request.body);
	return sendSuccess(response, await service.refresh(refreshToken));
});

router.post("/forgot-password", async (request, response) => {
	const input = service.parse(service.forgotPasswordSchema, request.body);
	return sendSuccess(response, await service.forgotPassword(input));
});

router.post("/reset-password", async (request, response) => {
	const input = service.parse(service.resetPasswordSchema, request.body);
	return sendSuccess(response, await service.resetPassword(input));
});

router.post("/logout", requireAuth, async (request, response) => {
	const { refreshToken } = service.parse(service.refreshSchema, request.body);
	await service.logout(refreshToken);
	return sendMessage(response, "Logged out successfully");
});

router.get("/me", requireAuth, async (request, response) => {
	if (!request.auth) throw unauthorized();
	return sendSuccess(response, await service.getMe(request.auth.userId, request.auth.companyId));
});

router.patch("/change-password", requireAuth, async (request, response) => {
	if (!request.auth) throw unauthorized();
	const input = service.parse(service.changePasswordSchema, request.body);
	await service.changePassword(request.auth.userId, request.auth.companyId, input.currentPassword, input.newPassword);
	return sendMessage(response, "Password changed successfully");
});

export default router;