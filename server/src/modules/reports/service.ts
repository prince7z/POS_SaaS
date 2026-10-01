import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../lib/prisma";
import { validationError } from "../../utils/errors";
import * as repository from "./repository";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const dashboardSchema = z.object({
	from: date.optional(), to: date.optional(), categoryId: z.string().uuid().optional(),
	paymentMethod: z.enum(["CASH", "CARD", "STORE_CREDIT"]).optional(),
	customerType: z.string().trim().min(1).optional(), granularity: z.enum(["HOUR", "DAY", "WEEK", "MONTH"]).default("DAY"),
});
export const pageSchema = dashboardSchema.extend({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50), search: z.string().trim().optional() });
export const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
	const result = schema.safeParse(value);
	if (!result.success) throw validationError(result.error.issues[0]?.message ?? "Invalid report filters");
	return result.data;
};
type Filters = z.infer<typeof dashboardSchema>;
const range = (filters: Filters): { from: string; to: string } => {
	const now = new Date();
	const to = filters.to ?? now.toISOString().slice(0, 10);
	const from = filters.from ?? new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
	if (from > to) throw validationError("REPORT_INVALID_DATE_RANGE");
	return { from, to };
};
const number = (value: unknown) => Number(value ?? 0);
const metric = (value: number, previousValue = 0) => ({ value, previousValue, changePercent: previousValue === 0 ? null : Number((((value - previousValue) / previousValue) * 100).toFixed(2)), direction: value > previousValue ? "up" : value < previousValue ? "down" : "flat" });
const previousRange = (r: { from: string; to: string }) => {
	const from = new Date(`${r.from}T00:00:00Z`);
	const to = new Date(`${r.to}T00:00:00Z`);
	const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
	return { from: new Date(from.getTime() - days * 86400000).toISOString().slice(0, 10), to: new Date(from.getTime() - 86400000).toISOString().slice(0, 10) };
};

export const salesDashboard = async (companyId: string, filters: Filters) => {
	const r = range(filters); const previous = previousRange(r);
	const [current, prior, trend, categories, payments, products, recent] = await Promise.all([
		repository.salesSummary(prisma, companyId, r, filters.categoryId, filters.paymentMethod),
		repository.salesSummary(prisma, companyId, previous, filters.categoryId, filters.paymentMethod),
		repository.salesTrend(prisma, companyId, r, filters.granularity),
		repository.salesByCategory(prisma, companyId, r), repository.salesByPayment(prisma, companyId, r),
		repository.topProducts(prisma, companyId, r, 5, "totalSales", "desc"), repository.recentSales(prisma, companyId, r, 5),
	]);
	const sales = number(current[0]?.totalSales); const orders = number(current[0]?.totalOrders); const priorSales = number(prior[0]?.totalSales); const priorOrders = number(prior[0]?.totalOrders);
	return { filters: r, kpis: { totalSales: metric(sales, priorSales), totalOrders: metric(orders, priorOrders), totalItemsSold: number(current[0]?.totalItems), averageOrderValue: metric(orders ? sales / orders : 0, priorOrders ? priorSales / priorOrders : 0) }, trend: trend.map((x) => ({ period: x.period, sales: number(x.sales) })), byCategory: categories.map((x) => ({ ...x, sales: number(x.sales), percentage: sales ? Number((number(x.sales) / sales * 100).toFixed(2)) : 0 })), byPaymentMethod: payments.map((x) => ({ ...x, amount: number(x.amount), percentage: sales ? Number((number(x.amount) / sales * 100).toFixed(2)) : 0 })), topProducts: products.map((x) => ({ ...x, quantitySold: number(x.quantitySold), totalSales: number(x.totalSales) })), recentSales: recent };
};

export const salesTransactions = async (companyId: string, filters: z.infer<typeof pageSchema>) => {
	const r = range(filters); const rows = await repository.transactions(prisma, companyId, r, filters.page, filters.limit, filters.search);
	const total = number(rows[0]?.totalCount);
	return { items: rows.map(({ totalCount, ...row }) => row), pagination: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) } };
};

export const inventoryDashboard = async (companyId: string, filters: Filters) => {
	const rows = await repository.inventorySummary(prisma, companyId); const row = rows[0] ?? {};
	const total = number(row.totalProducts); const low = number(row.lowStock); const out = number(row.outOfStock);
	return { kpis: { totalProducts: total, lowStockItems: low, outOfStock: out, totalStockValue: number(row.stockValue) }, stockStatus: { inStock: total - low - out, lowStock: low, outOfStock: out } };
};
export const lowStockItems = async (companyId: string, filters: z.infer<typeof pageSchema>) => {
	const rows = await repository.lowStock(prisma, companyId, filters.page, filters.limit, filters.search); const total = number(rows[0]?.totalCount);
	return { items: rows.map(({ totalCount, ...row }) => row), pagination: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) } };
};
export const topCustomers = async (companyId: string, filters: Filters) => (await repository.topCustomers(prisma, companyId, range(filters), 5)).map((x) => ({ ...x, totalSpent: number(x.totalSpent) }));
export const recentCustomers = async (companyId: string, filters: Filters) => (await repository.recentCustomers(prisma, companyId, range(filters), 5)).map((x) => ({ ...x, totalPurchases: number(x.totalPurchases) }));

export const pnlDashboard = async (companyId: string, filters: Filters) => {
	const r = range(filters); const row = (await repository.pnlSummary(prisma, companyId, r, filters.categoryId))[0] ?? {};
	const breakdown = await repository.expenseBreakdown(prisma, companyId, r);
	const revenue = number(row.revenue); const cost = number(row.cost); const expenses = number(row.expenses); const profit = revenue - cost - expenses;
	return { kpis: { revenue: metric(revenue), cost: metric(cost), expenses: metric(expenses), netProfit: metric(profit) }, trend: [], expenseBreakdown: breakdown.map((x) => ({ ...x, amount: number(x.amount) })) };
};
export const profitableProducts = async (companyId: string, filters: Filters) => (await repository.profitableProducts(prisma, companyId, range(filters), 5)).map((x) => ({ ...x, quantitySold: number(x.quantitySold), revenue: number(x.revenue), cost: number(x.cost), profit: number(x.profit) }));
export const recentExpenses = async (companyId: string, filters: Filters) => (await repository.recentExpenses(prisma, companyId, range(filters))).map((x) => ({ ...x, amount: number(x.amount) }));

export const csv = (rows: Array<Record<string, unknown>>) => {
	if (!rows.length) return "";
	const keys = Object.keys(rows[0]);
	const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
	return [keys.join(","), ...rows.map((row) => keys.map((key) => escape(row[key])).join(","))].join("\n");
};
