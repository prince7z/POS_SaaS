import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const findCompany = (db: Db, companyId: string) =>
	db.company.findFirst({ where: { id: companyId, deletedAt: null } });

export const updateCompany = (db: Db, companyId: string, data: Prisma.CompanyUpdateInput) =>
	db.company.update({ where: { id: companyId }, data });

export const listCompanyUsers = (db: Db, companyId: string, skip: number, take: number) =>
	db.companyUser.findMany({
		where: { companyId, deletedAt: null },
		include: { user: true },
		orderBy: { createdAt: "desc" },
		skip,
		take,
	});

export const countCompanyUsers = (db: Db, companyId: string) =>
	db.companyUser.count({ where: { companyId, deletedAt: null } });

export const findCompanyUser = (db: Db, companyId: string, userId: string) =>
	db.companyUser.findFirst({
		where: { companyId, userId, deletedAt: null },
		include: { user: true },
	});

export const findCompanyUserByEmail = (db: Db, companyId: string, email: string) =>
	db.companyUser.findFirst({
		where: { companyId, deletedAt: null, user: { email, deletedAt: null } },
		include: { user: true },
	});

export const findGlobalUserByEmail = (db: Db, email: string) =>
	db.user.findUnique({ where: { email } });

export const createGlobalUser = (db: Db, data: Prisma.UserCreateInput | Prisma.UserUncheckedCreateInput) =>
	db.user.create({ data });

export const createCompanyUser = (db: Db, data: Prisma.CompanyUserUncheckedCreateInput) =>
	db.companyUser.create({ data });

export const updateGlobalUser = (db: Db, userId: string, data: Prisma.UserUpdateInput) =>
	db.user.update({ where: { id: userId }, data });

export const updateCompanyUser = (
	db: Db,
	companyId: string,
	userId: string,
	data: Prisma.CompanyUserUpdateInput,
) =>
	db.companyUser.update({
		where: { companyId_userId: { companyId, userId } },
		data,
	});

export const countActiveAdmins = (db: Db, companyId: string) =>
	db.companyUser.count({ where: { companyId, roleName: "Admin", isActive: true, deletedAt: null } });

export const createAuditLog = (db: Db, data: Prisma.AuditLogUncheckedCreateInput) => db.auditLog.create({ data });