import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../lib/prisma";
import { AppError, validationError } from "../../utils/errors";
import {
	takealotApi,
	type TakealotOrder,
	type TakealotOrderItem,
	type TakealotOrderRecord,
	type TakealotSale,
	type TakealotSalesFilters,
} from "./takealot-api";

const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
	const date = new Date(`${value}T00:00:00.000Z`);
	return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Dates must be valid YYYY-MM-DD values");
const filterTextSchema = z.string().trim().min(1).max(200)
	.refine((value) => !/[;\r\n]/.test(value), "Filter values cannot contain semicolons or line breaks")
	.optional();
const optionalBooleanSchema = z.enum(["true", "false"]).transform((value) => value === "true").optional();
const optionalIntegerSchema = z.coerce.number().int().positive()
	.refine(Number.isSafeInteger, "Filter identifiers must be safe integers")
	.optional();
const rangeFields = {
	from: dateSchema.optional(),
	to: dateSchema.optional(),
};

const dateRangeIssue = (value: { from?: string; to?: string }, context: z.RefinementCtx, required = false) => {
	if (required && (!value.from || !value.to)) {
		context.addIssue({ code: "custom", message: "Both from and to dates are required" });
		return;
	}
	if ((value.from && !value.to) || (!value.from && value.to)) {
		context.addIssue({ code: "custom", message: "Both from and to dates must be provided together" });
		return;
	}
	if (value.from && value.to && value.from > value.to) {
		context.addIssue({ code: "custom", message: "from must be on or before to" });
	}
};

const filterFields = {
	sku: filterTextSchema,
	productTitle: filterTextSchema,
	tsin: optionalIntegerSchema,
	orderId: optionalIntegerSchema,
	dc: filterTextSchema,
	customerDc: filterTextSchema,
	saleStatus: filterTextSchema,
	promotion: optionalBooleanSchema,
};

export const overviewSchema = z.object(rangeFields).strict().superRefine((value, context) => dateRangeIssue(value, context));
export const salesListSchema = z.object({
	...rangeFields,
	...filterFields,
	page: pageSchema,
	limit: limitSchema,
}).strict().superRefine((value, context) => dateRangeIssue(value, context));
export const trendsSchema = z.object({
	from: dateSchema,
	to: dateSchema,
	interval: z.enum(["day", "week", "month"]).default("day"),
	metric: z.enum(["revenue", "units", "orders"]).default("revenue"),
	sku: filterTextSchema,
	productTitle: filterTextSchema,
	tsin: optionalIntegerSchema,
}).strict().superRefine((value, context) => dateRangeIssue(value, context, true));
export const salesSummarySchema = z.object({
	from: dateSchema,
	to: dateSchema,
	...filterFields,
}).strict().superRefine((value, context) => dateRangeIssue(value, context, true));
export const breakdownSchema = z.object({
	from: dateSchema,
	to: dateSchema,
	groupBy: z.enum(["promotion", "saleStatus", "dc", "customerDc", "stockSourceRegion"]),
}).strict().superRefine((value, context) => dateRangeIssue(value, context, true));
export const productsSchema = z.object({
	from: dateSchema,
	to: dateSchema,
	sortBy: z.enum(["revenue", "units", "orders", "averagePrice"]).default("revenue"),
	order: z.enum(["asc", "desc"]).default("desc"),
	page: pageSchema,
	limit: limitSchema,
	sku: filterTextSchema,
	productTitle: filterTextSchema,
	tsin: optionalIntegerSchema,
}).strict().superRefine((value, context) => dateRangeIssue(value, context, true));
export const ordersSchema = z.object({
	from: dateSchema,
	to: dateSchema,
	sku: filterTextSchema,
	productTitle: filterTextSchema,
	tsin: optionalIntegerSchema,
	orderId: optionalIntegerSchema,
	page: pageSchema,
	limit: limitSchema,
}).strict().superRefine((value, context) => dateRangeIssue(value, context, true));
export const inventorySnapshotsSchema = z.object({
	from: dateSchema,
	to: dateSchema,
	interval: z.enum(["day", "week", "month"]).default("day"),
}).strict().superRefine((value, context) => dateRangeIssue(value, context, true));

export const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
	const result = schema.safeParse(value);
	if (!result.success) throw validationError(result.error.issues[0]?.message ?? "Invalid request");
	return result.data;
};

const pageResult = (page: number, limit: number, total: number) => ({
	page,
	limit,
	total,
	totalPages: Math.ceil(total / limit),
	hasMore: page * limit < total,
});

const inFlightSales = new Map<string, Promise<TakealotSale[]>>();

const publicSale = (sale: TakealotSale) => ({
	shipment_id: sale.shipment_id,
	shipment_state_id: sale.shipment_state_id,
	po_number: sale.po_number,
	shipment_name: sale.shipment_name,
	offer_id: sale.offer_id,
	product_title: sale.product_title,
	takealot_url_mobi: sale.takealot_url_mobi,
	sku: sale.sku,
	tsin: sale.tsin,
	order_id: sale.order_id,
	order_item_id: sale.order_item_id,
	quantity: sale.quantity,
	selling_price: sale.selling_price,
	dc: sale.dc,
	customer_dc: sale.customer_dc,
	order_date: sale.order_date,
	sale_status: sale.sale_status,
	promotion: sale.promotion,
	stock_source_region: sale.stock_source_region,
	success_fee: sale.success_fee,
	fulfillment_fee: sale.fulfillment_fee,
	courier_collection_fee: sale.courier_collection_fee,
	total_fee: sale.total_fee,
	stock_transfer_fee: sale.stock_transfer_fee,
});

const publicOrderItem = (item: TakealotOrderItem) => ({
	...(item.order_item_id !== undefined && { order_item_id: item.order_item_id }),
	...(item.merchant_sku !== undefined && { merchant_sku: item.merchant_sku }),
	...(item.title !== undefined && { title: item.title }),
	...(item.tsin_id !== undefined && { tsin_id: item.tsin_id }),
	...(item.takealot_url !== undefined && { takealot_url: item.takealot_url }),
});

const publicOrder = (order: TakealotOrder) => ({
	order_id: order.order_id,
	date_authed: order.date_authed,
	order_items: order.order_items.map(publicOrderItem),
});

const fetchAllSales = async (apiKey: string, filters: TakealotSalesFilters): Promise<TakealotSale[]> => {
	const pageSize = 100;
	const firstPage = await takealotApi.getSales(apiKey, filters, 1, pageSize);
	const total = firstPage.page_summary.total;
	const expectedPages = Math.ceil(total / pageSize);
	if (firstPage.page_summary.page_number !== 1 || firstPage.sales.length > total) {
		throw new AppError("Takealot returned inconsistent sales pagination.", 502, "TAKEALOT_INCOMPLETE_RESPONSE");
	}

	const sales = [...firstPage.sales];
	for (let page = 2; page <= expectedPages; page++) {
		const result = await takealotApi.getSales(apiKey, filters, page, pageSize);
		if (
			result.page_summary.page_number !== page ||
			result.page_summary.total !== total ||
			result.sales.length === 0
		) {
			throw new AppError("Takealot returned incomplete sales pagination.", 502, "TAKEALOT_INCOMPLETE_RESPONSE");
		}
		sales.push(...result.sales);
	}

	if (sales.length !== total) {
		throw new AppError("Takealot returned an incomplete sales result.", 502, "TAKEALOT_INCOMPLETE_RESPONSE");
	}
	return sales;
};

const fetchAllSalesForCompany = (
	companyId: string,
	apiKey: string,
	filters: TakealotSalesFilters,
): Promise<TakealotSale[]> => {
	const key = JSON.stringify({ companyId, filters });
	const pending = inFlightSales.get(key);
	if (pending) return pending;

	const request = fetchAllSales(apiKey, filters).finally(() => {
		inFlightSales.delete(key);
	});
	inFlightSales.set(key, request);
	return request;
};

const addDateFilters = (input: { from?: string; to?: string }): Pick<TakealotSalesFilters, "from" | "to"> => ({
	from: input.from,
	to: input.to,
});

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const assertSaleMetrics = (sale: TakealotSale) => {
	if (
		!Number.isFinite(sale.selling_price) ||
		!Number.isFinite(sale.quantity) ||
		!Number.isFinite(sale.order_id) ||
		(sale.total_fee !== undefined && !Number.isFinite(sale.total_fee)) ||
		[sale.success_fee, sale.fulfillment_fee, sale.courier_collection_fee, sale.stock_transfer_fee]
			.some((fee) => fee !== undefined && !Number.isFinite(fee))
	) {
		throw new AppError("Takealot returned sales without valid price, quantity, fee, or order identifiers.", 502, "TAKEALOT_INVALID_RESPONSE");
	}
};

const catalogUnitCosts = async (companyId: string, sales: TakealotSale[]) => {
	const skus = [...new Set(sales.flatMap((sale) => sale.sku ? [sale.sku] : []))];
	const products: Array<{ sku: string; averageCost: Prisma.Decimal }> = [];
	for (let offset = 0; offset < skus.length; offset += 500) {
		products.push(...await prisma.product.findMany({
			where: { companyId, deletedAt: null, sku: { in: skus.slice(offset, offset + 500) } },
			select: { sku: true, averageCost: true },
		}));
	}
	const costs = new Map<string, number>();
	for (const product of products) {
		const averageCost = Number(product.averageCost);
		if (Number.isFinite(averageCost) && averageCost > 0) costs.set(product.sku, averageCost);
	}
	// The SKU-encoded cost (e.g. R35-... or C35-...) takes precedence over the catalog.
	for (const sku of skus) {
		const match = /[CR](\d+)(?!\d)/i.exec(sku.trim());
		if (match) costs.set(sku, Number(match[1]));
	}
	return costs;
};

const summarizeProductSales = (sales: TakealotSale[], unitCosts: Map<string, number>, allowPartialCost = false) => {
	let revenue = 0;
	let units = 0;
	let totalFee = 0;
	let totalCost = 0;
	let feesAvailable = true;
	let costedUnits = 0;
	let uncostedUnits = 0;
	const feeComponents = {
		successFee: { value: 0, rows: 0 },
		fulfillmentFee: { value: 0, rows: 0 },
		courierCollectionFee: { value: 0, rows: 0 },
		stockTransferFee: { value: 0, rows: 0 },
	};
	const orderIds = new Set<number>();

	for (const sale of sales) {
		assertSaleMetrics(sale);
		revenue += sale.selling_price;
		units += sale.quantity;
		orderIds.add(sale.order_id);

		if (sale.total_fee === undefined) {
			feesAvailable = false;
		} else {
			totalFee += sale.total_fee;
		}

		if (sale.success_fee !== undefined) {
			feeComponents.successFee.value += sale.success_fee;
			feeComponents.successFee.rows++;
		}
		if (sale.fulfillment_fee !== undefined) {
			feeComponents.fulfillmentFee.value += sale.fulfillment_fee;
			feeComponents.fulfillmentFee.rows++;
		}
		if (sale.courier_collection_fee !== undefined) {
			feeComponents.courierCollectionFee.value += sale.courier_collection_fee;
			feeComponents.courierCollectionFee.rows++;
		}
		if (sale.stock_transfer_fee !== undefined) {
			feeComponents.stockTransferFee.value += sale.stock_transfer_fee;
			feeComponents.stockTransferFee.rows++;
		}
		const unitCost = sale.sku ? unitCosts.get(sale.sku) : undefined;
		if (unitCost === undefined) {
			uncostedUnits += sale.quantity;
		} else {
			totalCost += unitCost * sale.quantity;
			costedUnits += sale.quantity;
		}
	}

	const roundedRevenue = roundMoney(revenue);
	const roundedTotalFee = feesAvailable && sales.length > 0 ? roundMoney(totalFee) : null;
	// Partial totals are returned with uncostedUnits so the UI can flag incomplete coverage.
	const roundedTotalCost = sales.length > 0 && (allowPartialCost || uncostedUnits === 0) ? roundMoney(totalCost) : null;
	const profit = roundedTotalFee === null || roundedTotalCost === null
		? null
		: roundMoney(roundedRevenue - roundedTotalCost - roundedTotalFee);
	const feeComponentSummary = Object.fromEntries(
		Object.entries(feeComponents).map(([name, component]) => [
			name,
			{
				total: sales.length > 0 && component.rows === sales.length ? roundMoney(component.value) : null,
				rowsWithValue: component.rows,
			},
		]),
	);

	return {
		revenue: roundedRevenue,
		averagePrice: units === 0 ? 0 : roundMoney(revenue / units),
		units,
		orders: orderIds.size,
		totalFee: roundedTotalFee,
		feePerUnit: roundedTotalFee === null || units === 0 ? null : roundMoney(roundedTotalFee / units),
		feeRowsWithTotal: sales.filter((sale) => sale.total_fee !== undefined).length,
		feeRowsMissingTotal: sales.filter((sale) => sale.total_fee === undefined).length,
		feeComponents: feeComponentSummary,
		totalCost: roundedTotalCost,
		costedUnits,
		uncostedUnits,
		costCoverage: units === 0 ? 0 : roundMoney(costedUnits / units),
		profit,
		profitPerUnit: profit === null || units === 0 ? null : roundMoney(profit / units),
		unitsPerOrder: orderIds.size === 0 ? 0 : roundMoney(units / orderIds.size),
	};
};

const aggregateTotalFees = (sales: TakealotSale[]): number | null => {
	let total = 0;
	for (const sale of sales) {
		if (sale.total_fee === undefined) return null;
		total += sale.total_fee;
	}
	return roundMoney(total);
};

const invalidOrderDate = (): never => {
	throw new AppError("Takealot returned an invalid order date.", 502, "TAKEALOT_INVALID_RESPONSE");
};

const bucketDate = (orderDate: string, interval: "day" | "week" | "month"): string => {
	const takealotDate = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/.exec(orderDate);
	let date: Date;
	if (takealotDate) {
		const [, dayText, monthText, yearText, hourText = "00", minuteText = "00", secondText = "00"] = takealotDate;
		const months: Record<string, string> = {
			jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
			jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
		};
		const month = months[monthText.toLowerCase()];
		if (!month) invalidOrderDate();
		const isoDate = `${yearText}-${month}-${dayText.padStart(2, "0")}T${hourText}:${minuteText}:${secondText}.000Z`;
		date = new Date(isoDate);
		if (
			!Number.isFinite(date.getTime()) ||
			date.toISOString() !== isoDate
		) {
			invalidOrderDate();
		}
	} else {
		const dateValue = orderDate.includes("T") ? orderDate : orderDate.replace(" ", "T");
		const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateValue);
		const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
			? `${dateValue}T00:00:00.000Z`
			: hasTimezone ? dateValue : `${dateValue}Z`;
		date = new Date(normalizedDate);
		if (!Number.isFinite(date.getTime())) {
			invalidOrderDate();
		}
	}
	const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	if (interval === "month") {
		return `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
	}
	if (interval === "week") {
		const daysSinceMonday = (utcDate.getUTCDay() + 6) % 7;
		utcDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);
	}
	return utcDate.toISOString().slice(0, 10);
};

const aggregateSales = (sales: TakealotSale[]) => {
	let salesValue = 0;
	let units = 0;
	const orders = new Set<number>();
	for (const sale of sales) {
		assertSaleMetrics(sale);
		salesValue += sale.selling_price;
		units += sale.quantity;
		orders.add(sale.order_id);
	}
	return { revenue: roundMoney(salesValue), units, orders: orders.size };
};

const revenueDefinition = "Gross sales value is the sum of Takealot selling_price values per sales row; quantity is summed separately. All returned sale_status values are included because the API documentation does not define their business meaning; this is not net revenue or profit.";
const profitDefinition = "Estimated merchandise profit is gross sales value minus Takealot total_fee and the known product cost (unit cost multiplied by quantity). Unit cost uses a C/R amount encoded in the SKU first, then the current averageCost of an exact-SKU match in this company's product catalog. If some units have no cost, totalCost and profit include only costed units; uncostedUnits and costCoverage show the incomplete coverage, so these partial estimates overstate profit. Profit is unavailable if any sales row lacks total_fee. This is not historical-cost accounting profit and excludes other expenses, taxes, and unreported fees.";

export const overview = async (apiKey: string, input: z.infer<typeof overviewSchema>) => {
	const [salesSummary, stockCounts, stockHealth] = await Promise.all([
		takealotApi.getSalesSummary(apiKey),
		takealotApi.getStockCounts(apiKey),
		takealotApi.getStockHealthStats(apiKey),
	]);
	return {
		salesSummary: {
			periods: salesSummary,
			requestedRange: input.from && input.to ? { from: input.from, to: input.to } : null,
			requestedRangeApplied: false,
			limitation: "Takealot's documented sales summary endpoint has no date-filter parameters; its periods cannot be matched reliably to an arbitrary requested date range.",
		},
		inventory: { stockCounts, stockHealth },
	};
};

export const listSales = async (apiKey: string, input: z.infer<typeof salesListSchema>) => {
	const page = await takealotApi.getSales(apiKey, {
		...addDateFilters(input),
		sku: input.sku,
		productTitle: input.productTitle,
		tsin: input.tsin,
		orderId: input.orderId,
		dc: input.dc,
		customerDc: input.customerDc,
		saleStatus: input.saleStatus,
		promotion: input.promotion,
	}, input.page, input.limit);

	if (page.page_summary.page_number !== input.page) {
		throw new AppError("Takealot returned a different page than requested.", 502, "TAKEALOT_INCOMPLETE_RESPONSE");
	}
	return {
		sales: page.sales.map(publicSale),
		pagination: pageResult(input.page, input.limit, page.page_summary.total),
	};
};

export const salesTrends = async (companyId: string, apiKey: string, input: z.infer<typeof trendsSchema>) => {
	const sales = await fetchAllSalesForCompany(companyId, apiKey, {
		from: input.from,
		to: input.to,
		sku: input.sku,
		productTitle: input.productTitle,
		tsin: input.tsin,
	});
	const buckets = new Map<string, TakealotSale[]>();
	for (const sale of sales) {
		const date = bucketDate(sale.order_date, input.interval);
		const bucket = buckets.get(date) ?? [];
		bucket.push(sale);
		buckets.set(date, bucket);
	}
	const series = [...buckets.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([date, rows]) => ({ date, ...aggregateSales(rows), totalFee: aggregateTotalFees(rows) }));
	return { interval: input.interval, metric: input.metric, series, revenueDefinition };
};

export const salesSummary = async (companyId: string, apiKey: string, input: z.infer<typeof salesSummarySchema>) => {
	const sales = await fetchAllSalesForCompany(companyId, apiKey, {
		from: input.from,
		to: input.to,
		sku: input.sku,
		productTitle: input.productTitle,
		tsin: input.tsin,
		orderId: input.orderId,
		dc: input.dc,
		customerDc: input.customerDc,
		saleStatus: input.saleStatus,
		promotion: input.promotion,
	});
	const costs = await catalogUnitCosts(companyId, sales);
	return {
		range: { from: input.from, to: input.to },
		salesRows: sales.length,
		...summarizeProductSales(sales, costs, true),
		revenueDefinition,
		profitDefinition,
	};
};

const breakdownValue = (sale: TakealotSale, groupBy: z.infer<typeof breakdownSchema>["groupBy"]): string => {
	const value = {
		promotion: sale.promotion,
		saleStatus: sale.sale_status,
		dc: sale.dc,
		customerDc: sale.customer_dc,
		stockSourceRegion: sale.stock_source_region,
	}[groupBy];
	return value === null || value === undefined || value === "" ? "Unknown" : String(value);
};

export const salesBreakdown = async (companyId: string, apiKey: string, input: z.infer<typeof breakdownSchema>) => {
	const sales = await fetchAllSalesForCompany(companyId, apiKey, { from: input.from, to: input.to });
	const groups = new Map<string, TakealotSale[]>();
	for (const sale of sales) {
		const key = breakdownValue(sale, input.groupBy);
		const group = groups.get(key) ?? [];
		group.push(sale);
		groups.set(key, group);
	}
	const breakdown = [...groups.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, rows]) => ({ key, ...aggregateSales(rows) }));
	return { groupBy: input.groupBy, breakdown, revenueDefinition };
};

const productIdentifier = (sale: TakealotSale, index: number): string => {
	if (Number.isFinite(sale.offer_id)) return `offer:${sale.offer_id}`;
	if (sale.sku && Number.isFinite(sale.tsin)) return `sku:${sale.sku}|tsin:${sale.tsin}`;
	if (sale.sku) return `sku:${sale.sku}`;
	if (Number.isFinite(sale.tsin)) return `tsin:${sale.tsin}`;
	if (Number.isFinite(sale.order_item_id)) return `order-item:${sale.order_item_id}`;
	return `unidentified:${index}`;
};

export const productPerformance = async (companyId: string, apiKey: string, input: z.infer<typeof productsSchema>) => {
	const sales = await fetchAllSalesForCompany(companyId, apiKey, {
		from: input.from,
		to: input.to,
		sku: input.sku,
		productTitle: input.productTitle,
		tsin: input.tsin,
	});
	const unitCosts = await catalogUnitCosts(companyId, sales);
	const products = new Map<string, {
		stableId: string;
		sku?: string;
		tsin?: number;
		title?: string;
		salesValue: number;
		totalFee: number;
		feesAvailable: boolean;
		totalCost: number;
		costedUnits: number;
		uncostedUnits: number;
		units: number;
		orderIds: Set<number>;
	}>();
	sales.forEach((sale, index) => {
		assertSaleMetrics(sale);
		const stableId = productIdentifier(sale, index);
		const product = products.get(stableId) ?? {
			stableId,
			sku: sale.sku,
			tsin: sale.tsin,
			title: sale.product_title,
			salesValue: 0,
			totalFee: 0,
			feesAvailable: true,
			totalCost: 0,
			costedUnits: 0,
			uncostedUnits: 0,
			units: 0,
			orderIds: new Set<number>(),
		};
		product.salesValue += sale.selling_price;
		if (sale.total_fee === undefined) {
			product.feesAvailable = false;
		} else {
			product.totalFee += sale.total_fee;
		}
		const saleUnitCost = sale.sku ? unitCosts.get(sale.sku) : undefined;
		if (saleUnitCost === undefined) {
			product.uncostedUnits += sale.quantity;
		} else {
			product.totalCost += saleUnitCost * sale.quantity;
			product.costedUnits += sale.quantity;
		}
		product.units += sale.quantity;
		product.orderIds.add(sale.order_id);
		products.set(stableId, product);
	});

	const ranked = [...products.values()].map((product) => {
		const unitCost = product.sku ? unitCosts.get(product.sku) : undefined;
		const revenue = roundMoney(product.salesValue);
		const averagePrice = product.units === 0 ? 0 : roundMoney(product.salesValue / product.units);
		const totalFee = product.feesAvailable ? roundMoney(product.totalFee) : null;
		const feePerUnit = totalFee === null || product.units === 0
			? null
			: roundMoney(totalFee / product.units);
		const totalCost = product.uncostedUnits > 0 ? null : roundMoney(product.totalCost);
		const profit = totalFee === null || totalCost === null
			? null
			: roundMoney(revenue - totalCost - totalFee);
		const profitPerUnit = profit === null || product.units === 0
			? null
			: roundMoney(profit / product.units);
		return {
			sku: product.sku,
			tsin: product.tsin,
			title: product.title,
			unitCost: unitCost ?? null,
			totalCost,
			costedUnits: product.costedUnits,
			uncostedUnits: product.uncostedUnits,
			totalFee,
			feePerUnit,
			profit,
			profitPerUnit,
			revenue,
			units: product.units,
			orders: product.orderIds.size,
			averagePrice,
			stableId: product.stableId,
		};
	});
	const direction = input.order === "asc" ? 1 : -1;
	ranked.sort((left, right) => {
		const comparison = left[input.sortBy] - right[input.sortBy];
		return comparison === 0 ? left.stableId.localeCompare(right.stableId) : comparison * direction;
	});
	const start = (input.page - 1) * input.limit;
	return {
		products: ranked.slice(start, start + input.limit).map(({ stableId: _stableId, ...product }) => product),
		pagination: pageResult(input.page, input.limit, ranked.length),
		summary: summarizeProductSales(sales, unitCosts, true),
		revenueDefinition,
		profitDefinition,
	};
};

export const listOrders = async (apiKey: string, input: z.infer<typeof ordersSchema>) => {
	const page = await takealotApi.getSalesOrders(apiKey, input);
	if (page.page_summary.page_number !== input.page) {
		throw new AppError("Takealot returned a different page than requested.", 502, "TAKEALOT_INCOMPLETE_RESPONSE");
	}
	return {
		orders: page.orders.map((order: TakealotOrderRecord) =>
			"order_items" in order ? publicOrder(order) : publicSale(order),
		),
		pagination: pageResult(input.page, input.limit, page.page_summary.total),
	};
};

export const inventorySummary = async (companyId: string, apiKey: string) => {
	const [stockCounts, stockHealth] = await Promise.all([
		takealotApi.getStockCounts(apiKey),
		takealotApi.getStockHealthStats(apiKey),
	]);
	const capturedAt = new Date();
	await prisma.takealotInventorySnapshot.create({
		data: {
			companyId,
			capturedAt,
			stockCounts: JSON.parse(JSON.stringify(stockCounts)) as Prisma.InputJsonValue,
			stockHealth: JSON.parse(JSON.stringify(stockHealth)) as Prisma.InputJsonValue,
		},
	});
	return { stockCounts, stockHealth, capturedAt };
};

const snapshotBucket = (date: Date, interval: "day" | "week" | "month"): string => {
	const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	if (interval === "month") {
		return `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
	}
	if (interval === "week") {
		utcDate.setUTCDate(utcDate.getUTCDate() - ((utcDate.getUTCDay() + 6) % 7));
	}
	return utcDate.toISOString().slice(0, 10);
};

export const inventorySnapshots = async (companyId: string, input: z.infer<typeof inventorySnapshotsSchema>) => {
	const from = new Date(`${input.from}T00:00:00.000Z`);
	const to = new Date(`${input.to}T23:59:59.999Z`);
	const snapshots = await prisma.takealotInventorySnapshot.findMany({
		where: { companyId, capturedAt: { gte: from, lte: to } },
		orderBy: { capturedAt: "asc" },
		select: { capturedAt: true, stockCounts: true, stockHealth: true },
	});
	const latestByBucket = new Map<string, (typeof snapshots)[number]>();
	for (const snapshot of snapshots) {
		latestByBucket.set(snapshotBucket(snapshot.capturedAt, input.interval), snapshot);
	}
	return {
		interval: input.interval,
		series: [...latestByBucket.entries()].map(([date, snapshot]) => ({
			date,
			capturedAt: snapshot.capturedAt,
			stockCounts: snapshot.stockCounts,
			stockHealth: snapshot.stockHealth,
		})),
	};
};
