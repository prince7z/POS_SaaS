import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const createCompany = (db: Db, data: Prisma.CompanyCreateInput) => db.company.create({ data });

export const createUser = (db: Db, data: Prisma.UserUncheckedCreateInput) => db.user.create({ data });

export const createWalkInCustomer = (db: Db, companyId: string) =>
	db.customer.create({
		data: {
			companyId,
			name: "Walk-in Customer",
			phone: "",
			email: `walk-in-${companyId}@internal.invalid`,
			customerType: "WALK_IN",
			creditLimit: 0,
			creditBalance: 0,
			storeCreditBalance: 0,
			isWalkIn: true,
		},
	});

export const findUserForLogin = (db: Db, companyId: string, email: string) =>
	db.user.findFirst({ where: { companyId, email, deletedAt: null }, include: { company: true } });

export const findActiveUserByEmail = (db: Db, email: string) =>
	db.user.findFirst({ where: { email, isActive: true, deletedAt: null }, select: { id: true, email: true, fullName: true } });

export const findUserById = (db: Db, userId: string, companyId: string) =>
	db.user.findFirst({ where: { id: userId, companyId, deletedAt: null }, include: { company: true } });

export const createSession = (db: Db, data: Prisma.SessionUncheckedCreateInput) => db.session.create({ data });

export const findSessionByHash = (db: Db, refreshTokenHash: string) =>
	db.session.findFirst({ where: { refreshTokenHash }, include: { user: { include: { company: true } } } });

export const revokeSession = (db: Db, sessionId: string) =>
	db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });

export const updatePassword = (db: Db, userId: string, passwordHash: string) =>
	db.user.update({ where: { id: userId }, data: { passwordHash } });

export const revokeUserSessions = (db: Db, userId: string) =>
	db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });

export const createAuditLog = (db: Db, data: Prisma.AuditLogUncheckedCreateInput) => db.auditLog.create({ data });