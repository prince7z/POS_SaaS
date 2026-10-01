import { Prisma, type PrismaClient } from "@prisma/client";

type Db = PrismaClient;
type Range = { from: string; to: string };

const completedSales = (range: Range, categoryId?: string, paymentMethod?: string) => Prisma.sql`
	s."companyId" = ${Prisma.raw(`s."companyId"`)} AND s."status" = 'COMPLETED'
	AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date
	AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
	${categoryId ? Prisma.sql`AND EXISTS (
		SELECT 1 FROM "SaleItem" fsi JOIN "Product" fsp ON fsp."id" = fsi."productId"
		WHERE fsi."saleId" = s."id" AND fsp."categoryId" = ${categoryId}
	)` : Prisma.empty}
	${paymentMethod ? Prisma.sql`AND EXISTS (
		SELECT 1 FROM "SalePayment" fspm
		WHERE fspm."saleId" = s."id" AND fspm."paymentMethod" = ${paymentMethod}::"PaymentMethod"
	)` : Prisma.empty}`;

export const getCompany = (db: Db, companyId: string) =>
	db.company.findUnique({ where: { id: companyId }, select: { timezone: true } });

export const salesSummary = (db: Db, companyId: string, range: Range, categoryId?: string, paymentMethod?: string) =>
	db.$queryRaw<Array<{ totalSales: Prisma.Decimal; totalOrders: bigint; totalItems: Prisma.Decimal }>>(Prisma.sql`
		SELECT COALESCE(SUM(s."total"), 0) AS "totalSales",
			COUNT(DISTINCT s."id") AS "totalOrders",
			COALESCE(SUM(si."quantity"), 0) AS "totalItems"
		FROM "Sale" s JOIN "Company" c ON c."id" = s."companyId"
		LEFT JOIN "SaleItem" si ON si."saleId" = s."id"
		WHERE s."companyId" = ${companyId} AND s."status" = 'COMPLETED'
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date
		AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		${categoryId ? Prisma.sql`AND EXISTS (SELECT 1 FROM "SaleItem" fsi JOIN "Product" fsp ON fsp."id"=fsi."productId" WHERE fsi."saleId"=s."id" AND fsp."categoryId"=${categoryId})` : Prisma.empty}
		${paymentMethod ? Prisma.sql`AND EXISTS (SELECT 1 FROM "SalePayment" fspm WHERE fspm."saleId"=s."id" AND fspm."paymentMethod"=${paymentMethod}::"PaymentMethod")` : Prisma.empty}
	`);

export const salesTrend = (db: Db, companyId: string, range: Range, granularity: string) => db.$queryRaw<Array<{ period: string; sales: Prisma.Decimal }>>(Prisma.sql`
		SELECT date_trunc(${granularity.toLowerCase()}, s."soldAt" AT TIME ZONE c."timezone")::date::text AS period,
			SUM(s."total") AS sales
		FROM "Sale" s JOIN "Company" c ON c."id"=s."companyId"
		WHERE s."companyId"=${companyId} AND s."status"='COMPLETED'
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date
		AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY 1 ORDER BY 1
	`);

export const salesByCategory = (db: Db, companyId: string, range: Range) => db.$queryRaw<Array<{ categoryId: string | null; categoryName: string | null; sales: Prisma.Decimal }>>(Prisma.sql`
		SELECT p."categoryId" AS "categoryId", COALESCE(ca."name", 'Uncategorized') AS "categoryName",
			SUM(si."quantity" * si."unitPrice") AS sales
		FROM "SaleItem" si JOIN "Sale" s ON s."id"=si."saleId" JOIN "Company" co ON co."id"=s."companyId"
		LEFT JOIN "Product" p ON p."id"=si."productId" LEFT JOIN "Category" ca ON ca."id"=p."categoryId"
		WHERE s."companyId"=${companyId} AND s."status"='COMPLETED'
		AND (s."soldAt" AT TIME ZONE co."timezone") >= ${range.from}::date
		AND (s."soldAt" AT TIME ZONE co."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY p."categoryId", ca."name" ORDER BY sales DESC
	`);

export const salesByPayment = (db: Db, companyId: string, range: Range) => db.$queryRaw<Array<{ paymentMethod: string; amount: Prisma.Decimal }>>(Prisma.sql`
		SELECT sp."paymentMethod", SUM(sp."amount") AS amount
		FROM "SalePayment" sp JOIN "Sale" s ON s."id"=sp."saleId" JOIN "Company" c ON c."id"=s."companyId"
		WHERE s."companyId"=${companyId} AND s."status"='COMPLETED'
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date
		AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY sp."paymentMethod" ORDER BY amount DESC
	`);

export const topProducts = (db: Db, companyId: string, range: Range, limit: number, sortBy: string, sortOrder: string) => {
	const order = sortBy === "quantitySold" ? "quantitySold" : "totalSales";
	const direction = sortOrder === "asc" ? "ASC" : "DESC";
	return db.$queryRaw<Array<{ productId: string; productName: string; sku: string; quantitySold: Prisma.Decimal; totalSales: Prisma.Decimal }>>(Prisma.sql`
		SELECT si."productId", si."productName", si."sku", SUM(si."quantity") AS "quantitySold",
			SUM(si."quantity"*si."unitPrice") AS "totalSales"
		FROM "SaleItem" si JOIN "Sale" s ON s."id"=si."saleId" JOIN "Company" c ON c."id"=s."companyId"
		WHERE s."companyId"=${companyId} AND s."status"='COMPLETED'
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date
		AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY si."productId", si."productName", si."sku"
		ORDER BY "${Prisma.raw(order)}" ${Prisma.raw(direction)} LIMIT ${limit}
	`);
};

export const recentSales = (db: Db, companyId: string, range: Range, limit: number) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT s."id" AS "saleId", s."invoiceNumber", s."soldAt", s."total", s."paymentStatus",
			cu."id" AS "customerId", cu."name" AS "customerName", COUNT(si."id")::int AS "itemsCount"
		FROM "Sale" s JOIN "Company" c ON c."id"=s."companyId"
		LEFT JOIN "Customer" cu ON cu."id"=s."customerId" LEFT JOIN "SaleItem" si ON si."saleId"=s."id"
		WHERE s."companyId"=${companyId} AND s."status"='COMPLETED'
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date
		AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY s."id", cu."id" ORDER BY s."soldAt" DESC LIMIT ${limit}
	`);

export const transactions = (db: Db, companyId: string, range: Range, page: number, limit: number, search?: string) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT s."id" AS "saleId", s."invoiceNumber", s."soldAt", s."subtotal", s."taxAmount", s."discountAmount",
			s."total", s."paidAmount", s."balanceDue", s."paymentStatus", cu."name" AS "customerName",
			COUNT(si."id")::int AS "itemsCount", COUNT(*) OVER()::int AS "totalCount"
		FROM "Sale" s JOIN "Company" c ON c."id"=s."companyId"
		LEFT JOIN "Customer" cu ON cu."id"=s."customerId" LEFT JOIN "SaleItem" si ON si."saleId"=s."id"
		WHERE s."companyId"=${companyId} AND s."status"='COMPLETED'
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date
		AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		${search ? Prisma.sql`AND (s."invoiceNumber" ILIKE ${`%${search}%`} OR cu."name" ILIKE ${`%${search}%`} OR cu."phone" ILIKE ${`%${search}%`})` : Prisma.empty}
		GROUP BY s."id", cu."name" ORDER BY s."soldAt" DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}
	`);

export const inventorySummary = (db: Db, companyId: string) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT COUNT(*) FILTER (WHERE p."isActive" AND p."deletedAt" IS NULL)::int AS "totalProducts",
		COUNT(*) FILTER (WHERE p."isActive" AND p."deletedAt" IS NULL AND p."stockQuantity" > 0 AND p."stockQuantity" <= p."lowStockThreshold")::int AS "lowStock",
		COUNT(*) FILTER (WHERE p."isActive" AND p."deletedAt" IS NULL AND p."stockQuantity" = 0)::int AS "outOfStock",
		COALESCE(SUM(p."stockQuantity"*p."averageCost") FILTER (WHERE p."isActive" AND p."deletedAt" IS NULL),0) AS "stockValue"
		FROM "Product" p WHERE p."companyId"=${companyId}
	`);

export const lowStock = (db: Db, companyId: string, page: number, limit: number, search?: string) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT p."id" AS "productId", p."name" AS "productName", p."sku", p."stockQuantity", p."lowStockThreshold",
			CASE WHEN p."stockQuantity"=0 THEN 'OUT_OF_STOCK' ELSE 'LOW_STOCK' END AS status, COUNT(*) OVER()::int AS "totalCount"
		FROM "Product" p WHERE p."companyId"=${companyId} AND p."isActive" AND p."deletedAt" IS NULL
		AND p."stockQuantity" <= p."lowStockThreshold"
		${search ? Prisma.sql`AND (p."name" ILIKE ${`%${search}%`} OR p."sku" ILIKE ${`%${search}%`})` : Prisma.empty}
		ORDER BY p."stockQuantity" ASC, p."name" ASC LIMIT ${limit} OFFSET ${(page-1)*limit}
	`);

export const topCustomers = (db: Db, companyId: string, range: Range, limit: number) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT cu."id" AS "customerId", cu."name", COUNT(DISTINCT s."id")::int AS orders,
			SUM(s."total") AS "totalSpent", MAX(s."soldAt") AS "lastPurchaseAt"
		FROM "Customer" cu JOIN "Sale" s ON s."customerId"=cu."id"
		JOIN "Company" c ON c."id"=s."companyId"
		WHERE cu."companyId"=${companyId} AND cu."isWalkIn"=false AND cu."deletedAt" IS NULL AND s."status"='COMPLETED'
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY cu."id" ORDER BY "totalSpent" DESC LIMIT ${limit}
	`);

	export const recentCustomers = (db: Db, companyId: string, range: Range, limit: number) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT cu."id" AS "customerId", cu."name", cu."phone", MAX(s."soldAt") AS "lastPurchaseAt",
			SUM(s."total") AS "totalPurchases", cu."isActive"
		FROM "Customer" cu JOIN "Sale" s ON s."customerId"=cu."id"
		JOIN "Company" c ON c."id"=s."companyId"
		WHERE cu."companyId"=${companyId} AND cu."isWalkIn"=false AND cu."deletedAt" IS NULL AND s."status"='COMPLETED'
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date
		AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY cu."id" ORDER BY "lastPurchaseAt" DESC LIMIT ${limit}
	`);

	export const profitableProducts = (db: Db, companyId: string, range: Range, limit: number) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		WITH sold AS (
			SELECT si."productId", si."productName", SUM(si."quantity") quantitySold,
				SUM(si."quantity"*si."unitPrice") revenue, SUM(si."quantity"*si."unitCost") cost
			FROM "SaleItem" si JOIN "Sale" s ON s."id"=si."saleId" JOIN "Company" c ON c."id"=s."companyId"
			WHERE s."companyId"=${companyId} AND s."status"='COMPLETED'
			AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date
			AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
			GROUP BY si."productId", si."productName"
		), returned AS (
			SELECT ri."productId", SUM(ri."quantity") quantity, SUM(ri."refundAmount") revenue,
				SUM(ri."quantity"*si."unitCost") cost
			FROM "ReturnItem" ri JOIN "Return" r ON r."id"=ri."returnId" JOIN "SaleItem" si ON si."id"=ri."saleItemId" JOIN "Company" c ON c."id"=r."companyId"
			WHERE r."companyId"=${companyId} AND r."status"='COMPLETED'
			AND (r."processedAt" AT TIME ZONE c."timezone") >= ${range.from}::date
			AND (r."processedAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
			GROUP BY ri."productId"
		) SELECT sold."productId", sold."productName", (sold.quantitySold-COALESCE(returned.quantity,0)) AS "quantitySold",
			(sold.revenue-COALESCE(returned.revenue,0)) AS revenue, (sold.cost-COALESCE(returned.cost,0)) AS cost,
			(sold.revenue-sold.cost-COALESCE(returned.revenue,0)+COALESCE(returned.cost,0)) AS profit
		FROM sold LEFT JOIN returned ON returned."productId"=sold."productId"
		ORDER BY profit DESC LIMIT ${limit}
	`);

export const pnlSummary = (db: Db, companyId: string, range: Range, categoryId?: string) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		WITH sale_totals AS (
			SELECT COALESCE(SUM(si."quantity"*si."unitPrice"),0) revenue, COALESCE(SUM(si."quantity"*si."unitCost"),0) cost
			FROM "SaleItem" si JOIN "Sale" s ON s."id"=si."saleId" JOIN "Company" c ON c."id"=s."companyId"
			WHERE s."companyId"=${companyId} AND s."status"='COMPLETED'
			AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
			${categoryId ? Prisma.sql`AND EXISTS (SELECT 1 FROM "Product" p WHERE p."id"=si."productId" AND p."categoryId"=${categoryId})` : Prisma.empty}
		), returns AS (
			SELECT COALESCE(SUM(ri."refundAmount"),0) revenue, COALESCE(SUM(ri."quantity"*si."unitCost"),0) cost
			FROM "ReturnItem" ri JOIN "Return" r ON r."id"=ri."returnId" JOIN "SaleItem" si ON si."id"=ri."saleItemId" JOIN "Company" c ON c."id"=r."companyId"
			WHERE r."companyId"=${companyId} AND r."status"='COMPLETED'
			AND (r."processedAt" AT TIME ZONE c."timezone") >= ${range.from}::date AND (r."processedAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
			${categoryId ? Prisma.sql`AND EXISTS (SELECT 1 FROM "Product" p WHERE p."id"=ri."productId" AND p."categoryId"=${categoryId})` : Prisma.empty}
		), expenses AS (
			SELECT COALESCE(SUM(e."amount"),0) amount FROM "Expense" e JOIN "Company" c ON c."id"=e."companyId"
			WHERE e."companyId"=${companyId} AND e."deletedAt" IS NULL AND (e."expenseDate" AT TIME ZONE c."timezone") >= ${range.from}::date AND (e."expenseDate" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		) SELECT (sale_totals.revenue-returns.revenue) AS revenue, (sale_totals.cost-returns.cost) AS cost, expenses.amount AS expenses
		FROM sale_totals, returns, expenses
	`);

export const expenseBreakdown = (db: Db, companyId: string, range: Range, limit = 100) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT e."category", COALESCE(e."otherCategoryName", e."category"::text) AS name, SUM(e."amount") amount
		FROM "Expense" e JOIN "Company" c ON c."id"=e."companyId"
		WHERE e."companyId"=${companyId} AND e."deletedAt" IS NULL AND (e."expenseDate" AT TIME ZONE c."timezone") >= ${range.from}::date AND (e."expenseDate" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY e."category", e."otherCategoryName" ORDER BY amount DESC LIMIT ${limit}
	`);

export const recentExpenses = (db: Db, companyId: string, range: Range, limit = 5) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT e."id", e."expenseDate" AS date, e."category", e."otherCategoryName", e."description", e."amount"
		FROM "Expense" e JOIN "Company" c ON c."id"=e."companyId"
		WHERE e."companyId"=${companyId} AND e."deletedAt" IS NULL AND (e."expenseDate" AT TIME ZONE c."timezone") >= ${range.from}::date AND (e."expenseDate" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		ORDER BY e."expenseDate" DESC, e."createdAt" DESC LIMIT ${limit}
	`);
