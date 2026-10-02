import { Prisma, type PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const listExpenses = (
	db: Db,
	where: Prisma.ExpenseWhereInput,
	skip: number,
	take: number,
	sortBy: "expenseDate" | "amount" | "createdAt",
	sortOrder: "asc" | "desc",
) => db.expense.findMany({
	where,
	orderBy: { [sortBy]: sortOrder },
	skip,
	take,
	include: { creator: { select: { id: true, fullName: true } } },
});

export const countExpenses = (db: Db, where: Prisma.ExpenseWhereInput) => db.expense.count({ where });

export const findExpense = (db: Db, companyId: string, id: string) =>
	db.expense.findFirst({
		where: { id, companyId, deletedAt: null },
		include: { creator: { select: { id: true, fullName: true } } },
	});

export const createExpense = (db: Db, data: Prisma.ExpenseUncheckedCreateInput) => db.expense.create({
	data,
	include: { creator: { select: { id: true, fullName: true } } },
});

export const updateExpense = (db: Db, id: string, data: Prisma.ExpenseUpdateInput) => db.expense.update({
	where: { id },
	data,
	include: { creator: { select: { id: true, fullName: true } } },
});

export const softDeleteExpense = (db: Db, id: string) =>
	db.expense.update({ where: { id }, data: { deletedAt: new Date() } });

export const expensesInRange = (db: Db, where: Prisma.ExpenseWhereInput) =>
	db.expense.findMany({
		where,
		orderBy: { expenseDate: "asc" },
		select: { expenseDate: true, category: true, otherCategoryName: true, description: true, amount: true, notes: true },
	});
