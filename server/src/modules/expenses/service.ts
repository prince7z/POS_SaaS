import { ExpenseCategory, Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../lib/prisma";
import { NotFoundError, validationError } from "../../utils/errors";
import * as repository from "./repository";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD");
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const categories = Object.values(ExpenseCategory) as [ExpenseCategory, ...ExpenseCategory[]];

export const expenseListSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().optional(),
	category: z.enum(categories).optional(),
	from: date.optional(),
	to: date.optional(),
	sortBy: z.enum(["expenseDate", "amount", "createdAt"]).default("expenseDate"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const expenseCreateSchema = z.object({
	expenseDate: date,
	category: z.enum(categories),
	otherCategoryName: optionalText(100),
	description: z.string().trim().min(1).max(500),
	amount: z.coerce.number().positive(),
	notes: optionalText(2000),
});

export const expenseUpdateSchema = expenseCreateSchema.partial();
export const summarySchema = z.object({ from: date.optional(), to: date.optional(), category: z.enum(categories).optional() });

export const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
	const result = schema.safeParse(value);
	if (!result.success) throw validationError(result.error.issues[0]?.message ?? "Invalid expense request");
	return result.data;
};

type DateFilters = { from?: string; to?: string; category?: ExpenseCategory };

const whereFor = (companyId: string, filters: DateFilters & { search?: string }): Prisma.ExpenseWhereInput => {
	if (filters.from && filters.to && filters.from > filters.to) throw validationError("EXPENSE_INVALID_DATE_RANGE");
	return {
		companyId,
		deletedAt: null,
		...(filters.category ? { category: filters.category } : {}),
		...(filters.search ? {
			OR: [
				{ description: { contains: filters.search, mode: "insensitive" } },
				{ notes: { contains: filters.search, mode: "insensitive" } },
				{ otherCategoryName: { contains: filters.search, mode: "insensitive" } },
			],
		} : {}),
		...(filters.from || filters.to ? {
			expenseDate: {
				...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
				...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
			},
		} : {}),
	};
};

const expenseView = (expense: any) => ({
	id: expense.id,
	expenseDate: expense.expenseDate,
	category: expense.category,
	otherCategoryName: expense.otherCategoryName,
	description: expense.description,
	amount: Number(expense.amount),
	notes: expense.notes,
	createdAt: expense.createdAt,
	updatedAt: expense.updatedAt,
	createdBy: expense.creator ? { id: expense.creator.id, name: expense.creator.fullName } : null,
});

const rangeDefaults = (filters: DateFilters) => {
	const to = filters.to ?? new Date().toISOString().slice(0, 10);
	const from = filters.from ?? new Date(new Date(`${to}T00:00:00.000Z`).getTime() - 29 * 86400000).toISOString().slice(0, 10);
	if (from > to) throw validationError("EXPENSE_INVALID_DATE_RANGE");
	return { from, to };
};

export const list = async (companyId: string, filters: z.infer<typeof expenseListSchema>) => {
	const where = whereFor(companyId, filters);
	const [items, total] = await Promise.all([
		repository.listExpenses(prisma, where, (filters.page - 1) * filters.limit, filters.limit, filters.sortBy, filters.sortOrder),
		repository.countExpenses(prisma, where),
	]);
	return { items: items.map(expenseView), pagination: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) } };
};

export const get = async (companyId: string, id: string) => {
	const expense = await repository.findExpense(prisma, companyId, id);
	if (!expense) throw new NotFoundError("Expense not found");
	return expenseView(expense);
};

export const create = async (companyId: string, userId: string, input: z.infer<typeof expenseCreateSchema>) => {
	const expense = await repository.createExpense(prisma, {
		companyId,
		createdBy: userId,
		expenseDate: new Date(`${input.expenseDate}T00:00:00.000Z`),
		category: input.category,
		otherCategoryName: input.category === ExpenseCategory.OTHER ? input.otherCategoryName ?? null : null,
		description: input.description,
		amount: new Prisma.Decimal(input.amount),
		notes: input.notes ?? null,
	});
	return expenseView(expense);
};

export const update = async (companyId: string, id: string, input: z.infer<typeof expenseUpdateSchema>) => {
	const existing = await repository.findExpense(prisma, companyId, id);
	if (!existing) throw new NotFoundError("Expense not found");
	const data: Prisma.ExpenseUpdateInput = {
		...(input.expenseDate ? { expenseDate: new Date(`${input.expenseDate}T00:00:00.000Z`) } : {}),
		...(input.category ? { category: input.category, otherCategoryName: input.category === ExpenseCategory.OTHER ? input.otherCategoryName ?? null : null } : {}),
		...(input.otherCategoryName !== undefined && !input.category ? { otherCategoryName: input.otherCategoryName } : {}),
		...(input.description !== undefined ? { description: input.description } : {}),
		...(input.amount !== undefined ? { amount: new Prisma.Decimal(input.amount) } : {}),
		...(input.notes !== undefined ? { notes: input.notes } : {}),
	};
	return expenseView(await repository.updateExpense(prisma, id, data));
};

export const remove = async (companyId: string, id: string) => {
	const existing = await repository.findExpense(prisma, companyId, id);
	if (!existing) throw new NotFoundError("Expense not found");
	await repository.softDeleteExpense(prisma, id);
};

export const summary = async (companyId: string, filters: z.infer<typeof summarySchema>) => {
	const rows = await repository.expensesInRange(prisma, whereFor(companyId, filters));
	const amounts = rows.map((row) => Number(row.amount));
	const totalExpenses = amounts.reduce((sum, amount) => sum + amount, 0);
	return {
		totalExpenses,
		expenseCount: rows.length,
		averageExpense: rows.length ? totalExpenses / rows.length : 0,
		largestExpense: amounts.length ? Math.max(...amounts) : 0,
	};
};

export const analytics = async (companyId: string, filters: z.infer<typeof summarySchema>) => {
	const range = rangeDefaults(filters);
	const rows = await repository.expensesInRange(prisma, whereFor(companyId, range));
	const categoryName = (row: typeof rows[number]) => row.category === ExpenseCategory.OTHER && row.otherCategoryName ? row.otherCategoryName : row.category;
	const byCategory = new Map<string, number>();
	const byPeriod = new Map<string, number>();
	const byPeriodCategory = new Map<string, number>();
	for (const row of rows) {
		const amount = Number(row.amount);
		const period = row.expenseDate.toISOString().slice(0, 10);
		const category = categoryName(row);
		byCategory.set(category, (byCategory.get(category) ?? 0) + amount);
		byPeriod.set(period, (byPeriod.get(period) ?? 0) + amount);
		const key = `${period}\u0000${category}`;
		byPeriodCategory.set(key, (byPeriodCategory.get(key) ?? 0) + amount);
	}
	const total = [...byCategory.values()].reduce((sum, amount) => sum + amount, 0);
	return {
		trend: [...byPeriod.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, amount]) => ({ period, amount })),
		categoryBreakdown: [...byCategory.entries()].sort(([, a], [, b]) => b - a).map(([category, amount]) => ({ category, amount, percentage: total ? Number((amount / total * 100).toFixed(2)) : 0 })),
		largestExpenses: rows.map((row) => ({ ...expenseView({ ...row, id: undefined, createdAt: undefined, updatedAt: undefined, notes: undefined, creator: undefined }), category: categoryName(row) })).sort((a, b) => b.amount - a.amount).slice(0, 10),
		trendByCategory: [...byPeriodCategory.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, amount]) => { const [period, category] = key.split("\u0000"); return { period, category, amount }; }),
		filters: range,
	};
};

export const csv = async (companyId: string, filters: z.infer<typeof expenseListSchema>) => {
	const rows = await repository.expensesInRange(prisma, whereFor(companyId, filters));
	const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
	return [
		["Date", "Category", "Description", "Amount", "Notes"].map(escape).join(","),
		...rows.map((row) => [row.expenseDate.toISOString().slice(0, 10), row.category === ExpenseCategory.OTHER ? row.otherCategoryName ?? row.category : row.category, row.description, Number(row.amount).toFixed(2), row.notes ?? ""].map(escape).join(",")),
	].join("\n");
};

export const id = (value: unknown) => {
	const result = uuid.safeParse(value);
	if (!result.success) throw validationError("Invalid expense id");
	return result.data;
};
