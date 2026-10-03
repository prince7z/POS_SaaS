import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Access, type Prisma } from "@prisma/client";
import { z } from "zod";

import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { AppError, unauthorized, validationError } from "../../utils/errors";
import { sanitizeCompany, sanitizeUser } from "../../utils/sanitizers";
import * as repository from "./repository";
import { RedisKeys, redisClient } from "../../infrastructure/redis";
import { PASSWORD_RESET_TTL_SECONDS } from "../notification/notification.constants";
import { generateResetToken, hashResetToken, queuePasswordResetEmail, queueWelcomeEmail } from "../notification";
import { logger } from "../../lib/logger";

const email = z.string().trim().email().transform((value) => value.toLowerCase());
const optionalText = (max = 255) => z.string().trim().max(max).optional();

export const registerSchema = z.object({
	company: z.object({
		name: z.string().trim().min(1).max(150),
		phone: optionalText(50),
		email: email.optional(),
		countryCode: z.string().trim().length(2).toUpperCase().optional(),
		currencyCode: z.string().trim().length(3).toUpperCase().optional(),
		timezone: z.string().trim().min(1).max(100).optional(),
	}),
	admin: z.object({
		fullName: z.string().trim().min(1).max(150),
		email,
		password: z.string().min(8).max(128),
	}),
});

export const loginSchema = z.object({ companyId: z.string().uuid(), email, password: z.string().min(1) });
export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) });
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({
	token: z.string().min(1),
	newPassword: z.string().min(8).max(128),
	confirmPassword: z.string().min(8).max(128),
}).refine((input) => input.newPassword === input.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

const hashToken = (token: string): string => crypto.createHash("sha256").update(token).digest("hex");

const createTokens = (userId: string, companyId: string) => {
	const refreshToken = crypto.randomBytes(48).toString("hex");
	const accessToken = jwt.sign({ companyId }, env.jwtSecret, {
		subject: userId,
		expiresIn: env.accessTokenTtl as jwt.SignOptions["expiresIn"],
	});
	return {
		accessToken,
		refreshToken,
		refreshTokenHash: hashToken(refreshToken),
		expiresAt: new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
	};
};

const authResponse = (user: { company: Parameters<typeof sanitizeCompany>[0] } & Parameters<typeof sanitizeUser>[0], tokens?: ReturnType<typeof createTokens>) => ({
	user: sanitizeUser(user),
	company: sanitizeCompany(user.company),
	...(tokens && { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
});

export const register = async (input: z.infer<typeof registerSchema>) => {
	const passwordHash = await bcrypt.hash(input.admin.password, 12);
	const result = await prisma.$transaction(async (tx) => {
		const company = await repository.createCompany(tx, {
			name: input.company.name,
			phone: input.company.phone,
			email: input.company.email,
			countryCode: input.company.countryCode,
			currencyCode: input.company.currencyCode,
			timezone: input.company.timezone,
		});
		const user = await repository.createUser(tx, {
			companyId: company.id,
			email: input.admin.email,
			passwordHash,
			fullName: input.admin.fullName,
			roleName: "Admin",
			accesses: Object.values(Access),
		});
		await repository.createWalkInCustomer(tx, company.id);
		const tokens = createTokens(user.id, company.id);
		await repository.createSession(tx, { userId: user.id, refreshTokenHash: tokens.refreshTokenHash, expiresAt: tokens.expiresAt });
		await repository.createAuditLog(tx, { companyId: company.id, actorUserId: user.id, action: "USER_CREATED", entityType: "User", entityId: user.id });
		return { user: { ...user, company }, tokens };
	});
	await queueWelcomeEmail({ companyId: result.user.company.id, userId: result.user.id, email: result.user.email, name: result.user.fullName });
	return authResponse(result.user, result.tokens);
};

export const forgotPassword = async (input: z.infer<typeof forgotPasswordSchema>) => {
	const user = await repository.findActiveUserByEmail(prisma, input.email);
	if (!user) {
		throw new AppError("No account found with that email address", 404, "USER_NOT_FOUND");
	}
	const token = generateResetToken();
	await redisClient.set(RedisKeys.passwordReset(hashResetToken(token)), user.id, "EX", PASSWORD_RESET_TTL_SECONDS);
	logger.info("Password reset requested", JSON.stringify({ userId: user.id }));
	try {
		await queuePasswordResetEmail({ userId: user.id, email: user.email, name: user.fullName, resetToken: token });
	} catch (error) {
		logger.error("Password reset email could not be queued", error);
	}
	return { message: "Password reset link has been sent to your email." };
};

export const resetPassword = async (input: z.infer<typeof resetPasswordSchema>) => {
	const key = RedisKeys.passwordReset(hashResetToken(input.token));
	const userId = await redisClient.get(key);
	if (!userId) throw new AppError("Invalid or expired reset token", 400, "INVALID_RESET_TOKEN");
	const passwordHash = await bcrypt.hash(input.newPassword, 12);
	await prisma.$transaction(async (tx) => {
		const user = await tx.user.findFirst({ where: { id: userId, isActive: true, deletedAt: null }, select: { id: true, companyId: true } });
		if (!user) throw new AppError("Invalid or expired reset token", 400, "INVALID_RESET_TOKEN");
		await repository.updatePassword(tx, user.id, passwordHash);
		await repository.revokeUserSessions(tx, user.id);
		await repository.createAuditLog(tx, { companyId: user.companyId, actorUserId: user.id, action: "PASSWORD_RESET", entityType: "User", entityId: user.id });
	});
	await redisClient.del(key);
	logger.info("Password reset succeeded", JSON.stringify({ userId }));
	return { message: "Password reset successfully. Please log in with your new password." };
};

export const login = async (input: z.infer<typeof loginSchema>) => {
	const user = await repository.findUserForLogin(prisma, input.companyId, input.email);
	if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
		if (user) await repository.createAuditLog(prisma, { companyId: user.companyId, action: "LOGIN_FAILED", entityType: "User", entityId: user.id });
		throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
	}
	if (!user.isActive || user.deletedAt || user.company.deletedAt) throw new AppError("User is inactive", 401, "USER_INACTIVE");
	const tokens = createTokens(user.id, user.companyId);
	await repository.createSession(prisma, { userId: user.id, refreshTokenHash: tokens.refreshTokenHash, expiresAt: tokens.expiresAt });
	await repository.createAuditLog(prisma, { companyId: user.companyId, actorUserId: user.id, action: "LOGIN_SUCCESS", entityType: "User", entityId: user.id });
	return authResponse(user, tokens);
};

export const refresh = async (refreshToken: string) => {
	const session = await repository.findSessionByHash(prisma, hashToken(refreshToken));
	if (!session) throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
	if (session.revokedAt) throw new AppError("Session has been revoked", 401, "SESSION_REVOKED");
	if (session.expiresAt <= new Date()) throw new AppError("Session has expired", 401, "SESSION_EXPIRED");
	if (!session.user.isActive || session.user.deletedAt || session.user.company.deletedAt) throw new AppError("User is inactive", 401, "USER_INACTIVE");
	const tokens = createTokens(session.user.id, session.user.companyId);
	await prisma.$transaction(async (tx) => {
		await repository.revokeSession(tx, session.id);
		await repository.createSession(tx, { userId: session.user.id, refreshTokenHash: tokens.refreshTokenHash, expiresAt: tokens.expiresAt });
	});
	return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
};

export const logout = async (refreshToken: string) => {
	const session = await repository.findSessionByHash(prisma, hashToken(refreshToken));
	if (session && !session.revokedAt) await repository.revokeSession(prisma, session.id);
};

export const getMe = async (userId: string, companyId: string) => {
	const user = await repository.findUserById(prisma, userId, companyId);
	if (!user || !user.isActive) throw unauthorized("User is inactive or no longer exists");
	return { user: sanitizeUser(user), company: sanitizeCompany(user.company) };
};

export const changePassword = async (userId: string, companyId: string, currentPassword: string, newPassword: string) => {
	const user = await repository.findUserById(prisma, userId, companyId);
	if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AppError("Current password is incorrect", 400, "PASSWORD_MISMATCH");
	const passwordHash = await bcrypt.hash(newPassword, 12);
	await prisma.$transaction(async (tx) => {
		await repository.updatePassword(tx, userId, passwordHash);
		await repository.revokeUserSessions(tx, userId);
		await repository.createAuditLog(tx, { companyId, actorUserId: userId, action: "PASSWORD_CHANGED", entityType: "User", entityId: userId });
	});
};

export const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
	const result = schema.safeParse(input);
	if (!result.success) throw validationError(result.error.issues[0]?.message ?? "Invalid request");
	return result.data;
};