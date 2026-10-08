import bcrypt from "bcryptjs";
import { Access, CountryCode, CurrencyCode, type Prisma } from "@prisma/client";
import { z } from "zod";

import { createMediaUploadUrl, deleteMediaObject } from "../../integrations/aws/media";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { AppError, forbidden, validationError } from "../../utils/errors";
import { sanitizeCompany, sanitizeUser } from "../../utils/sanitizers";
import * as repository from "./repository";

const optionalText = (max = 255) => z.string().trim().max(max).nullable().optional();
const email = z.string().trim().email().transform((value) => value.toLowerCase());

export const companyUpdateSchema = z.object({
	name: z.string().trim().min(1).max(150).optional(),
	phone: optionalText(50),
	email: email.nullable().optional(),
	logoKey: optionalText(500),
	addressLine1: optionalText(),
	addressLine2: optionalText(),
	city: optionalText(100),
	state: optionalText(100),
	postalCode: optionalText(30),
	countryCode: z.nativeEnum(CountryCode).optional(),
	currencyCode: z.nativeEnum(CurrencyCode).optional(),
	timezone: z.string().trim().min(1).max(100).optional(),
	defaultTaxRate: z.number().min(0).max(100).optional(),
	dateFormat: z.string().trim().min(1).max(50).optional(),
	timeFormat: z.string().trim().min(1).max(50).optional(),
	lowStockAlerts: z.boolean().optional(),
	showProductImages: z.boolean().optional(),
	autoGenerateInvoiceNumber: z.boolean().optional(),
	autoPrintInvoice: z.boolean().optional(),
	invoiceTerms: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
	businessHours: z.object({
		weekdays: z.object({
			open: z.string().regex(/^\d{2}:\d{2}$/),
			close: z.string().regex(/^\d{2}:\d{2}$/),
		}),
		saturdayClosed: z.boolean(),
		sundayClosed: z.boolean(),
		publicHolidaysClosed: z.boolean(),
	}).optional(),
	takealotSellerId: optionalText(150),
	takealotApiKey: optionalText(500),
});

export const createUserSchema = z.object({
	fullName: z.string().trim().min(1).max(150),
	email,
	phone: optionalText(50),
	password: z.string().min(8).max(128),
	roleName: z.string().trim().min(1).max(80),
	accesses: z.array(z.nativeEnum(Access)).min(1),
});

export const updateUserSchema = z.object({
	fullName: z.string().trim().min(1).max(150).optional(),
	phone: optionalText(50),
	roleName: z.string().trim().min(1).max(80).optional(),
	accesses: z.array(z.nativeEnum(Access)).min(1).optional(),
	isActive: z.boolean().optional(),
});

export const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const contentTypeSchema = z.object({ contentType: z.enum(["image/jpeg", "image/png", "image/webp"]) });
const isMockOrValidKey = (key: string) => typeof key === "string" && (key.includes("photo-1") || key.startsWith("photo-"));
export const logoKeySchema = z.object({
	logoKey: z.string().refine(
		(key) =>
			isMockOrValidKey(key) ||
			/^companies\/[A-Za-z0-9_-]+\/(?:pending\/company_logo\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)|logo\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif))$/i.test(key),
		"Invalid company logo key"
	),
});

const safeAudit = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
	const result = schema.safeParse(input);
	if (!result.success) throw validationError(result.error.issues[0]?.message ?? "Invalid request");
	return result.data;
};

export const getCompany = async (companyId: string) => {
	const company = await repository.findCompany(prisma, companyId);
	if (!company) throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
	return sanitizeCompany(company);
};

export const createCompanyLogoUploadUrl = async (companyId: string, contentType: string) =>
	createMediaUploadUrl({ companyId, resource: "COMPANY_LOGO", resourceId: "company", contentType });

export const updateCompanyLogo = async (companyId: string, actorUserId: string, logoKey: string) => {
	const company = await repository.findCompany(prisma, companyId);
	if (!company) throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
	if (!isMockOrValidKey(logoKey) && !logoKey.startsWith(`companies/${companyId}/logo/`) && !logoKey.startsWith(`companies/${companyId}/pending/company_logo/`)) throw validationError("Invalid company logo key");
	const updated = await prisma.$transaction(async (tx) => {
		const result = await repository.updateCompany(tx, companyId, { logoKey });
		await repository.createAuditLog(tx, { companyId, actorUserId, action: "COMPANY_LOGO_UPDATED", entityType: "Company", entityId: companyId });
		return result;
	});
	if (company.logoKey && company.logoKey !== logoKey && !isMockOrValidKey(company.logoKey)) {
		try { await deleteMediaObject(company.logoKey); } catch (error) { logger.error("Failed to delete replaced company logo", error); }
	}
	return sanitizeCompany(updated);
};

export const removeCompanyLogo = async (companyId: string, actorUserId: string) => {
	const company = await repository.findCompany(prisma, companyId);
	if (!company) throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
	await prisma.$transaction(async (tx) => {
		await repository.updateCompany(tx, companyId, { logoKey: null });
		await repository.createAuditLog(tx, { companyId, actorUserId, action: "COMPANY_LOGO_REMOVED", entityType: "Company", entityId: companyId });
	});
	if (company.logoKey && !isMockOrValidKey(company.logoKey)) {
		try { await deleteMediaObject(company.logoKey); } catch (error) { logger.error("Failed to delete company logo", error); }
	}
};

export const updateCompany = async (companyId: string, actorUserId: string, input: z.infer<typeof companyUpdateSchema>) => {
	const before = await repository.findCompany(prisma, companyId);
	if (!before) throw new AppError("Company not found", 404, "COMPANY_NOT_FOUND");
	if (input.invoiceTerms !== undefined || input.businessHours !== undefined) {
		const actorMembership = await prisma.companyUser.findFirst({
			where: { userId: actorUserId, companyId, isActive: true, deletedAt: null },
			select: { roleName: true },
		});
		if (actorMembership?.roleName !== "Admin") throw forbidden("Only an Admin can update invoice terms and opening hours");
	}
	const updated = await prisma.$transaction(async (tx) => {
		const company = await repository.updateCompany(tx, companyId, input as Prisma.CompanyUpdateInput);
		await repository.createAuditLog(tx, {
			companyId,
			actorUserId,
			action: "COMPANY_UPDATED",
			entityType: "Company",
			entityId: companyId,
			beforeData: safeAudit({ name: before.name, email: before.email, timezone: before.timezone, takealotSellerId: before.takealotSellerId }),
			afterData: safeAudit({ name: company.name, email: company.email, timezone: company.timezone, takealotSellerId: company.takealotSellerId }),
		});
		return company;
	});
	if (input.logoKey !== undefined && before.logoKey && input.logoKey !== before.logoKey && !isMockOrValidKey(before.logoKey)) {
		try { await deleteMediaObject(before.logoKey); } catch (error) { logger.error("Failed to delete replaced company logo", error); }
	}
	return sanitizeCompany(updated);
};

export const getUsers = async (companyId: string, page: number, limit: number) => {
	const [items, total] = await Promise.all([
		repository.listCompanyUsers(prisma, companyId, (page - 1) * limit, limit),
		repository.countCompanyUsers(prisma, companyId),
	]);
	return { items: items.map((item) => sanitizeUser(item.user, item)), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const createUser = async (companyId: string, actorUserId: string, input: z.infer<typeof createUserSchema>) => {
	if (await repository.findCompanyUserByEmail(prisma, companyId, input.email)) {
		throw new AppError("Email already exists in this company", 409, "EMAIL_ALREADY_EXISTS");
	}
	const passwordHash = await bcrypt.hash(input.password, 12);
	const { user, companyUser } = await prisma.$transaction(async (tx) => {
		let user = await repository.findGlobalUserByEmail(tx, input.email);
		if (!user) {
			user = await repository.createGlobalUser(tx, {
				email: input.email,
				passwordHash,
				fullName: input.fullName,
				phone: input.phone,
			});
		}
		const companyUser = await repository.createCompanyUser(tx, {
			companyId,
			userId: user.id,
			roleName: input.roleName,
			accesses: input.accesses,
			isActive: true,
		});
		await repository.createAuditLog(tx, { companyId, actorUserId, action: "USER_CREATED", entityType: "User", entityId: user.id });
		return { user, companyUser };
	});
	return sanitizeUser(user, companyUser);
};

export const updateUser = async (companyId: string, actorUserId: string, userId: string, input: z.infer<typeof updateUserSchema>) => {
	const before = await repository.findCompanyUser(prisma, companyId, userId);
	if (!before) throw new AppError("User not found", 404, "USER_NOT_FOUND");
	if (input.isActive === false && before.roleName === "Admin" && before.isActive && (await repository.countActiveAdmins(prisma, companyId)) <= 1) {
		throw forbidden("The final active Admin cannot be deactivated");
	}
	const { user, companyUser } = await prisma.$transaction(async (tx) => {
		let updatedUser = before.user;
		if (input.fullName !== undefined || input.phone !== undefined) {
			updatedUser = await repository.updateGlobalUser(tx, userId, {
				...(input.fullName !== undefined && { fullName: input.fullName }),
				...(input.phone !== undefined && { phone: input.phone }),
			});
		}
		const updatedMembership = await repository.updateCompanyUser(tx, companyId, userId, {
			...(input.roleName !== undefined && { roleName: input.roleName }),
			...(input.accesses !== undefined && { accesses: input.accesses }),
			...(input.isActive !== undefined && { isActive: input.isActive }),
		});
		await repository.createAuditLog(tx, {
			companyId,
			actorUserId,
			action: input.accesses ? "ACCESS_CHANGED" : "USER_UPDATED",
			entityType: "User",
			entityId: userId,
			beforeData: safeAudit({ roleName: before.roleName, accesses: before.accesses, isActive: before.isActive }),
			afterData: safeAudit({ roleName: updatedMembership.roleName, accesses: updatedMembership.accesses, isActive: updatedMembership.isActive }),
		});
		return { user: updatedUser, companyUser: updatedMembership };
	});
	return sanitizeUser(user, companyUser);
};

export const deactivateUser = async (companyId: string, actorUserId: string, userId: string) => {
	const membership = await repository.findCompanyUser(prisma, companyId, userId);
	if (!membership) throw new AppError("User not found", 404, "USER_NOT_FOUND");
	if (membership.roleName === "Admin" && membership.isActive && (await repository.countActiveAdmins(prisma, companyId)) <= 1) {
		throw forbidden("The final active Admin cannot be deactivated");
	}
	await prisma.$transaction(async (tx) => {
		await repository.updateCompanyUser(tx, companyId, userId, { isActive: false, deletedAt: new Date() });
		await repository.createAuditLog(tx, { companyId, actorUserId, action: "USER_DEACTIVATED", entityType: "User", entityId: userId });
	});
};

export const getAccesses = (): Access[] => Object.values(Access);