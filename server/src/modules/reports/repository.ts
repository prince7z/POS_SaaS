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

export const salesTrend = (db: Db, companyId: string, range: Range, granularity: string) => db.$queryRaw<Array<{ period: string; sales: Prisma.Decimal; orders: bigint; itemsSold: Prisma.Decimal; averageOrderValue: Prisma.Decimal }>>(Prisma.sql`
		SELECT CASE WHEN ${granularity} = 'HOUR'
			THEN to_char(date_trunc('hour', s."soldAt" AT TIME ZONE c."timezone"), 'YYYY-MM-DD"T"HH24:00:00')
			ELSE date_trunc(${granularity.toLowerCase()}, s."soldAt" AT TIME ZONE c."timezone")::date::text
		END AS period,
			SUM(s."total") AS sales, COUNT(DISTINCT s."id") AS orders,
			COALESCE(SUM(si."quantity"), 0) AS "itemsSold",
			SUM(s."total") / NULLIF(COUNT(DISTINCT s."id"), 0) AS "averageOrderValue"
		FROM "Sale" s JOIN "Company" c ON c."id"=s."companyId"
		LEFT JOIN "SaleItem" si ON si."saleId"=s."id"
		WHERE s."companyId"=${companyId} AND s."status"='COMPLETED'
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date
		AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY 1 ORDER BY 1
	`);

export const salesActivity = (db: Db, companyId: string, range: Range) => db.$queryRaw<Array<{ dayOfWeek: string; hour: number; salesAmount: Prisma.Decimal; orderCount: bigint }>>(Prisma.sql`
		SELECT to_char(s."soldAt" AT TIME ZONE c."timezone", 'Dy') AS "dayOfWeek",
			EXTRACT(HOUR FROM s."soldAt" AT TIME ZONE c."timezone")::int AS hour,
			SUM(s."total") AS "salesAmount", COUNT(*)::int AS "orderCount"
		FROM "Sale" s JOIN "Company" c ON c."id"=s."companyId"
		WHERE s."companyId"=${companyId} AND s."status"='COMPLETED'
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date
		AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY 1, 2 ORDER BY MIN(EXTRACT(ISODOW FROM s."soldAt" AT TIME ZONE c."timezone")), 2
	`);

export const productPerformance = (db: Db, companyId: string, range: Range, limit = 50) => db.$queryRaw<Array<{ product: string; unitsSold: Prisma.Decimal; revenue: Prisma.Decimal; cost: Prisma.Decimal; profit: Prisma.Decimal }>>(Prisma.sql`
		SELECT si."productName" AS product, SUM(si."quantity") AS "unitsSold",
			SUM(si."quantity" * si."unitPrice") AS revenue,
			SUM(si."quantity" * si."unitCost") AS cost,
			SUM(si."quantity" * (si."unitPrice" - si."unitCost")) AS profit
		FROM "SaleItem" si JOIN "Sale" s ON s."id"=si."saleId" JOIN "Company" c ON c."id"=s."companyId"
		WHERE s."companyId"=${companyId} AND s."status"='COMPLETED'
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date
		AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY si."productName" ORDER BY revenue DESC LIMIT ${limit}
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
	return db.$queryRaw<Array<{ productId: string; productName: string; sku: string; imageKeys: string[]; quantitySold: Prisma.Decimal; totalSales: Prisma.Decimal }>>(Prisma.sql`
		SELECT si."productId", si."productName", si."sku", p."imageKeys", SUM(si."quantity") AS "quantitySold",
			SUM(si."quantity"*si."unitPrice") AS "totalSales"
		FROM "SaleItem" si JOIN "Sale" s ON s."id"=si."saleId" JOIN "Company" c ON c."id"=s."companyId"
		JOIN "Product" p ON p."id"=si."productId"
		WHERE s."companyId"=${companyId} AND s."status"='COMPLETED'
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date
		AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY si."productId", si."productName", si."sku", p."imageKeys"
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
		COALESCE(SUM(p."stockQuantity") FILTER (WHERE p."isActive" AND p."deletedAt" IS NULL),0) AS "totalUnits",
		COUNT(*) FILTER (WHERE p."isActive" AND p."deletedAt" IS NULL AND p."stockQuantity" > 0 AND p."stockQuantity" <= p."lowStockThreshold")::int AS "lowStock",
		COUNT(*) FILTER (WHERE p."isActive" AND p."deletedAt" IS NULL AND p."stockQuantity" = 0)::int AS "outOfStock",
		COALESCE(SUM(p."stockQuantity"*p."averageCost") FILTER (WHERE p."isActive" AND p."deletedAt" IS NULL),0) AS "stockValue"
		FROM "Product" p WHERE p."companyId"=${companyId}
	`);

export const inventoryValueByCategory = (db: Db, companyId: string) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT COALESCE(ca."name", 'Uncategorized') AS category, COALESCE(SUM(p."stockQuantity"*p."averageCost"),0) AS value
		FROM "Product" p LEFT JOIN "Category" ca ON ca."id"=p."categoryId"
		WHERE p."companyId"=${companyId} AND p."isActive" AND p."deletedAt" IS NULL
		GROUP BY ca."name" ORDER BY value DESC
	`);

export const customerSummary = (db: Db, companyId: string, range: Range) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT COUNT(*) FILTER (WHERE cu."isWalkIn"=false AND cu."deletedAt" IS NULL)::int AS "totalCustomers",
			COUNT(*) FILTER (WHERE cu."isWalkIn"=false AND cu."deletedAt" IS NULL AND cu."createdAt" >= ${range.from}::date AND cu."createdAt" < (${range.to}::date + INTERVAL '1 day'))::int AS "newCustomers",
			COUNT(*) FILTER (WHERE cu."isWalkIn"=false AND cu."deletedAt" IS NULL AND cu."isActive")::int AS "activeCustomers",
			COALESCE(SUM(s."total") FILTER (WHERE s."status"='COMPLETED' AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')),0) AS "totalPurchases"
		FROM "Customer" cu LEFT JOIN "Sale" s ON s."customerId"=cu."id" LEFT JOIN "Company" c ON c."id"=s."companyId"
		WHERE cu."companyId"=${companyId}
	`);

export const newVsReturning = (db: Db, companyId: string, range: Range, granularity: string) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT date_trunc(${granularity.toLowerCase()}, s."soldAt" AT TIME ZONE c."timezone")::date::text AS period,
			COUNT(DISTINCT s."customerId") FILTER (WHERE cu."createdAt" >= ${range.from}::date AND cu."createdAt" < (${range.to}::date + INTERVAL '1 day'))::int AS "newCustomers",
			COUNT(DISTINCT s."customerId") FILTER (WHERE cu."createdAt" < ${range.from}::date)::int AS "returningCustomers"
		FROM "Sale" s JOIN "Company" c ON c."id"=s."companyId" JOIN "Customer" cu ON cu."id"=s."customerId"
		WHERE s."companyId"=${companyId} AND s."status"='COMPLETED' AND s."customerId" IS NOT NULL
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY 1 ORDER BY 1
	`);

export const customerTypeDistribution = (db: Db, companyId: string, range: Range) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT COALESCE(NULLIF(cu."customerType", ''), 'Unspecified') AS type, COUNT(DISTINCT cu."id")::int AS customers
		FROM "Customer" cu JOIN "Sale" s ON s."customerId"=cu."id" JOIN "Company" c ON c."id"=s."companyId"
		WHERE cu."companyId"=${companyId} AND cu."isWalkIn"=false AND cu."deletedAt" IS NULL AND s."status"='COMPLETED'
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY 1 ORDER BY customers DESC
	`);

export const customerPerformance = (db: Db, companyId: string, range: Range, limit = 50) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT cu."id" AS "customerId", cu."name", COUNT(DISTINCT s."id")::int AS orders,
			SUM(s."total") AS "purchaseValue", SUM(s."total")/NULLIF(COUNT(DISTINCT s."id"),0) AS "averageOrderValue"
		FROM "Customer" cu JOIN "Sale" s ON s."customerId"=cu."id" JOIN "Company" c ON c."id"=s."companyId"
		WHERE cu."companyId"=${companyId} AND cu."isWalkIn"=false AND cu."deletedAt" IS NULL AND s."status"='COMPLETED'
		AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY cu."id" ORDER BY "purchaseValue" DESC LIMIT ${limit}
	`);

export const lowStock = (db: Db, companyId: string, page: number, limit: number, search?: string) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT p."id" AS "productId", p."name" AS "productName", p."sku", p."imageKeys", p."stockQuantity", p."lowStockThreshold",
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
		) SELECT sold."productId", sold."productName", p."imageKeys", (sold.quantitySold-COALESCE(returned.quantity,0)) AS "quantitySold",
			(sold.revenue-COALESCE(returned.revenue,0)) AS revenue, (sold.cost-COALESCE(returned.cost,0)) AS cost,
			(sold.revenue-sold.cost-COALESCE(returned.revenue,0)+COALESCE(returned.cost,0)) AS profit
		FROM sold
		JOIN "Product" p ON p."id"=sold."productId"
		LEFT JOIN returned ON returned."productId"=sold."productId"
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

export const pnlTrend = (db: Db, companyId: string, range: Range, granularity: string) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		WITH periods AS (
			SELECT generate_series(date_trunc(${granularity.toLowerCase()}, ${range.from}::date), date_trunc(${granularity.toLowerCase()}, ${range.to}::date), ('1 ' || ${granularity.toLowerCase()})::interval) AS period
		), sales AS (
			SELECT date_trunc(${granularity.toLowerCase()}, s."soldAt" AT TIME ZONE c."timezone") AS period,
				SUM(si."quantity" * si."unitPrice") AS revenue, SUM(si."quantity" * si."unitCost") AS cost
			FROM "Sale" s JOIN "SaleItem" si ON si."saleId"=s."id" JOIN "Company" c ON c."id"=s."companyId"
			WHERE s."companyId"=${companyId} AND s."status"='COMPLETED'
				AND (s."soldAt" AT TIME ZONE c."timezone") >= ${range.from}::date
				AND (s."soldAt" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
			GROUP BY 1
		), expenses AS (
			SELECT date_trunc(${granularity.toLowerCase()}, e."expenseDate" AT TIME ZONE c."timezone") AS period, SUM(e."amount") AS expenses
			FROM "Expense" e JOIN "Company" c ON c."id"=e."companyId"
			WHERE e."companyId"=${companyId} AND e."deletedAt" IS NULL
				AND (e."expenseDate" AT TIME ZONE c."timezone") >= ${range.from}::date
				AND (e."expenseDate" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
			GROUP BY 1
		)
		SELECT periods.period::text, COALESCE(sales.revenue,0) revenue, COALESCE(sales.cost,0) cost,
			COALESCE(expenses.expenses,0) expenses,
			COALESCE(sales.revenue,0)-COALESCE(sales.cost,0)-COALESCE(expenses.expenses,0) AS "netProfit"
		FROM periods LEFT JOIN sales USING (period) LEFT JOIN expenses USING (period) ORDER BY periods.period
	`);

export const expenseTrend = (db: Db, companyId: string, range: Range, granularity: string) => db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
		SELECT date_trunc(${granularity.toLowerCase()}, e."expenseDate" AT TIME ZONE c."timezone")::text AS period,
			COALESCE(e."otherCategoryName", e."category"::text) AS category, SUM(e."amount") AS amount
		FROM "Expense" e JOIN "Company" c ON c."id"=e."companyId"
		WHERE e."companyId"=${companyId} AND e."deletedAt" IS NULL
			AND (e."expenseDate" AT TIME ZONE c."timezone") >= ${range.from}::date
			AND (e."expenseDate" AT TIME ZONE c."timezone") < (${range.to}::date + INTERVAL '1 day')
		GROUP BY 1, 2 ORDER BY 1, 2
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
