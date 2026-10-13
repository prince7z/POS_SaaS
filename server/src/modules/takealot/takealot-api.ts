import { AppError } from "../../utils/errors";
import { takealotClient } from "../../integrations/takealot/client";

export interface TakealotSale {
	shipment_id?: number;
	shipment_state_id?: number;
	po_number?: number;
	shipment_name?: string;
	offer_id?: number;
	product_title?: string;
	takealot_url_mobi?: string;
	sku?: string;
	tsin?: number;
	order_id: number;
	order_item_id: number;
	quantity: number;
	selling_price: number;
	dc?: string;
	customer_dc?: string;
	order_date: string;
	sale_status: string | boolean;
	promotion?: boolean;
	stock_source_region?: string;
	success_fee?: number;
	fulfillment_fee?: number;
	courier_collection_fee?: number;
	total_fee?: number;
	stock_transfer_fee?: number;
}

export interface TakealotPage<T> {
	page_summary: {
		page_size: number;
		page_number: number;
		total: number;
	};
	sales: T[];
}

export interface TakealotSalesSummary {
	date_range: string;
	total: number;
	quantity: number;
}

export interface TakealotOrderItem {
	order_item_id?: number;
	merchant_sku?: string;
	title?: string;
	tsin_id?: number;
	takealot_url?: string;
}

export interface TakealotOrder {
	order_id: number;
	date_authed: string;
	order_items: TakealotOrderItem[];
}

export type TakealotOrderRecord = TakealotSale | TakealotOrder;

export interface TakealotOrdersPage {
	page_summary: TakealotPage<TakealotSale>["page_summary"];
	orders: TakealotOrderRecord[];
}

export interface TakealotSalesFilters {
	from?: string;
	to?: string;
	sku?: string;
	productTitle?: string;
	tsin?: number;
	orderId?: number;
	dc?: string;
	customerDc?: string;
	saleStatus?: string;
	promotion?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const invalidResponse = (): never => {
	throw new AppError("Takealot returned an invalid response.", 502, "TAKEALOT_INVALID_RESPONSE");
};

const parsePage = (value: unknown): TakealotPage<TakealotSale> => {
	if (!isRecord(value) || !isRecord(value.page_summary) || !Array.isArray(value.sales)) return invalidResponse();
	const summary = value.page_summary;
	if (
		typeof summary.page_size !== "number" ||
		typeof summary.page_number !== "number" ||
		typeof summary.total !== "number" ||
		!Number.isFinite(summary.page_size) ||
		!Number.isFinite(summary.page_number) ||
		!Number.isFinite(summary.total) ||
		summary.page_size < 0 ||
		summary.page_number < 1 ||
		summary.total < 0 ||
		!value.sales.every(isRecord)
	) return invalidResponse();

	return value as unknown as TakealotPage<TakealotSale>;
};

const parseOrdersPage = (value: unknown): TakealotOrdersPage => {
	if (!isRecord(value) || !isRecord(value.page_summary)) return invalidResponse();
	const summary = value.page_summary;
	if (
		typeof summary.page_size !== "number" ||
		typeof summary.page_number !== "number" ||
		typeof summary.total !== "number" ||
		!Number.isFinite(summary.page_size) ||
		!Number.isFinite(summary.page_number) ||
		!Number.isFinite(summary.total) ||
		summary.page_size < 0 ||
		summary.page_number < 1 ||
		summary.total < 0
	) return invalidResponse();

	if (Array.isArray(value.orders)) {
		const orders: TakealotOrder[] = [];
		for (const order of value.orders) {
			if (
				!isRecord(order) ||
				typeof order.order_id !== "number" ||
				typeof order.date_authed !== "string" ||
				!Array.isArray(order.order_items)
			) return invalidResponse();
			const orderItems: TakealotOrderItem[] = [];
			for (const item of order.order_items) {
				if (!isRecord(item)) return invalidResponse();
				if (
					(item.order_item_id !== undefined && typeof item.order_item_id !== "number") ||
					(item.merchant_sku !== undefined && typeof item.merchant_sku !== "string") ||
					(item.title !== undefined && typeof item.title !== "string") ||
					(item.tsin_id !== undefined && typeof item.tsin_id !== "number") ||
					(item.takealot_url !== undefined && typeof item.takealot_url !== "string")
				) return invalidResponse();
				orderItems.push({
					order_item_id: item.order_item_id as number | undefined,
					merchant_sku: item.merchant_sku as string | undefined,
					title: item.title as string | undefined,
					tsin_id: item.tsin_id as number | undefined,
					takealot_url: item.takealot_url as string | undefined,
				});
			}
			orders.push({ order_id: order.order_id, date_authed: order.date_authed, order_items: orderItems });
		}
		return { page_summary: summary as TakealotOrdersPage["page_summary"], orders };
	}

	if (Array.isArray(value.sales) && value.sales.every(isRecord)) {
		return {
			page_summary: summary as TakealotOrdersPage["page_summary"],
			orders: value.sales as unknown as TakealotSale[],
		};
	}
	return invalidResponse();
};

const parseObject = (value: unknown): Record<string, unknown> => {
	if (!isRecord(value)) return invalidResponse();
	return value;
};

export const takealotApi = {
	async getSales(apiKey: string, filters: TakealotSalesFilters, pageNumber: number, pageSize: number) {
		const apiFilters: string[] = [];
		if (filters.from) apiFilters.push(`start_date:${filters.from}`);
		if (filters.to) apiFilters.push(`end_date:${filters.to}`);
		if (filters.sku) apiFilters.push(`sku:${filters.sku}`);
		if (filters.productTitle) apiFilters.push(`product_title:${filters.productTitle}`);
		if (filters.tsin !== undefined) apiFilters.push(`tsin:${filters.tsin}`);
		if (filters.orderId !== undefined) apiFilters.push(`order_id:${filters.orderId}`);
		if (filters.dc) apiFilters.push(`dc:${filters.dc}`);
		if (filters.customerDc) apiFilters.push(`customer_dc:${filters.customerDc}`);
		if (filters.saleStatus) apiFilters.push(`sale_status:${filters.saleStatus}`);
		if (filters.promotion !== undefined) apiFilters.push(`promotion:${filters.promotion}`);

		const response = await takealotClient.request<unknown>(apiKey, "/v1/sales", {
			filters: apiFilters.length ? apiFilters : undefined,
			page_number: pageNumber,
			page_size: pageSize,
		});
		return parsePage(response);
	},

	async getSalesSummary(apiKey: string): Promise<TakealotSalesSummary[]> {
		const response = await takealotClient.request<unknown>(apiKey, "/v1/sales/summary");
		const summaries = Array.isArray(response)
			? response
			: isRecord(response) && Array.isArray(response.sales_summary)
				? response.sales_summary
				: undefined;
		if (!summaries || !summaries.every((entry: unknown) =>
			isRecord(entry) &&
			typeof entry.date_range === "string" &&
			typeof entry.total === "number" &&
			typeof entry.quantity === "number"
		)) return invalidResponse();
		return summaries as TakealotSalesSummary[];
	},

	async getSalesOrders(
		apiKey: string,
		input: { from: string; to: string; sku?: string; productTitle?: string; tsin?: number; orderId?: number; page: number; limit: number },
	) {
		const response = await takealotClient.request<unknown>(apiKey, "/v1/sales/orders", {
			start_date: input.from,
			end_date: input.to,
			sku: input.sku,
			product_title: input.productTitle,
			tsin: input.tsin,
			order_id: input.orderId,
			page_number: input.page,
			page_size: input.limit,
		});
		return parseOrdersPage(response);
	},

	async getStockCounts(apiKey: string) {
		const response = await takealotClient.request<unknown>(apiKey, "/v1/offers/stock_counts");
		return parseObject(response);
	},

	async getStockHealthStats(apiKey: string) {
		const response = await takealotClient.request<unknown>(apiKey, "/v1/offers/stock_health_stats");
		return parseObject(response);
	},
};
