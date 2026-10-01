import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const findCompany = (db: Db, companyId: string) =>
	db.company.findFirst({ where: { id: companyId, deletedAt: null } });

export const updateCompany = (db: Db, companyId: string, data: Prisma.CompanyUpdateInput) =>
	db.company.update({ where: { id: companyId }, data });

export const listUsers = (db: Db, companyId: string, skip: number, take: number) =>
	db.user.findMany({ where: { companyId, deletedAt: null }, orderBy: { createdAt: "desc" }, skip, take });

export const countUsers = (db: Db, companyId: string) =>
	db.user.count({ where: { companyId, deletedAt: null } });

export const findUser = (db: Db, companyId: string, userId: string) =>
	db.user.findFirst({ where: { id: userId, companyId, deletedAt: null } });

export const findUserByEmail = (db: Db, companyId: string, email: string) =>
	db.user.findFirst({ where: { companyId, email, deletedAt: null } });

export const createUser = (db: Db, data: Prisma.UserUncheckedCreateInput) => db.user.create({ data });

export const updateUser = (db: Db, userId: string, data: Prisma.UserUpdateInput) =>
	db.user.update({ where: { id: userId }, data });

export const countActiveAdmins = (db: Db, companyId: string) =>
	db.user.count({ where: { companyId, roleName: "Admin", isActive: true, deletedAt: null } });

export const createAuditLog = (db: Db, data: Prisma.AuditLogUncheckedCreateInput) => db.auditLog.create({ data });