import { Router, type Request, type Response } from "express";

import { env } from "../../config/env";
import { requireAuth } from "../../middleware/auth";
import { sendMessage, sendSuccess } from "../../utils/apiResponse";
import { AppError, unauthorized } from "../../utils/errors";
import * as service from "./service";

const router = Router();
const refreshCookieName = "pos_refresh_token";
const refreshCookieOptions = {
	httpOnly: true,
	secure: env.nodeEnv === "production",
	sameSite: env.nodeEnv === "production" ? "none" as const : "lax" as const,
	path: "/auth",
	maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
};

const clearRefreshCookie = (response: Response) => response.clearCookie(refreshCookieName, {
	httpOnly: refreshCookieOptions.httpOnly,
	secure: refreshCookieOptions.secure,
	sameSite: refreshCookieOptions.sameSite,
	path: refreshCookieOptions.path,
});

const getRefreshCookie = (request: Request): string | undefined => {
	const cookie = request.header("cookie")
		?.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${refreshCookieName}=`));
	return cookie?.slice(refreshCookieName.length + 1);
};

const sendAuthSuccess = <T extends { refreshToken?: string }>(response: Response, data: T, statusCode = 200) => {
	if (!data.refreshToken) throw new Error("Authentication response is missing a refresh token");
	response.cookie(refreshCookieName, data.refreshToken, refreshCookieOptions);
	return sendSuccess(response, data, statusCode);
};

router.post("/register", async (request, response) => {
	const input = service.parse(service.registerSchema, request.body);
	return sendAuthSuccess(response, await service.register(input), 201);
});

router.post("/login", async (request, response) => {
	const input = service.parse(service.loginSchema, request.body);
	return sendAuthSuccess(response, await service.login(input));
});

router.post("/refresh", async (request, response) => {
	const refreshToken = getRefreshCookie(request) ??
		(request.body?.refreshToken ? service.parse(service.refreshSchema, request.body).refreshToken : undefined);
	if (!refreshToken) {
		clearRefreshCookie(response);
		throw unauthorized("Refresh token is required");
	}

	try {
		const result = await service.refresh(refreshToken);
		response.cookie(refreshCookieName, result.refreshToken, refreshCookieOptions);
		return sendSuccess(response, result);
	} catch (error) {
		if (error instanceof AppError && error.statusCode === 401) clearRefreshCookie(response);
		throw error;
	}
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
	const refreshToken = getRefreshCookie(request) ??
		(request.body?.refreshToken ? service.parse(service.refreshSchema, request.body).refreshToken : undefined);
	if (refreshToken) await service.logout(refreshToken);
	clearRefreshCookie(response);
	return sendMessage(response, "Logged out successfully");
});

router.get("/me", requireAuth, async (request, response) => {
	if (!request.auth) throw unauthorized();
	return sendSuccess(response, await service.getMe(request.auth.userId, request.auth.companyId));
});

router.post("/switch-company", requireAuth, async (request, response) => {
	if (!request.auth) throw unauthorized();
	const input = service.parse(service.switchCompanySchema, request.body);
	return sendAuthSuccess(response, await service.switchCompany(request.auth.userId, request.auth.companyId, input.companyId));
});

router.patch("/change-password", requireAuth, async (request, response) => {
	if (!request.auth) throw unauthorized();
	const input = service.parse(service.changePasswordSchema, request.body);
	await service.changePassword(request.auth.userId, request.auth.companyId, input.currentPassword, input.newPassword);
	return sendMessage(response, "Password changed successfully");
});

export default router;