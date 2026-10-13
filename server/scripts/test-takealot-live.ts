import assert from "node:assert/strict";

const describeShape = (value: unknown, depth = 0): string => {
	if (depth > 4) return "…";
	if (Array.isArray(value)) {
		return `array(length=${value.length}, item=${value.length ? describeShape(value[0], depth + 1) : "empty"})`;
	}
	if (typeof value === "object" && value !== null) {
		return Object.entries(value).map(([key, child]) => {
			if (Array.isArray(child) || (depth < 4 && typeof child === "object" && child !== null)) {
				return `${key}:${describeShape(child, depth + 1)}`;
			}
			return `${key}:${typeof child}`;
		}).join("; ");
	}
	return typeof value;
};

const main = async (): Promise<void> => {
	const companyId = process.env.TAKEALOT_COMPANY_ID?.trim();
	if (!companyId) throw new Error("Set TAKEALOT_COMPANY_ID to the seller company to verify.");

	const { prisma } = await import("../src/lib/prisma");
	const { takealotApi } = await import("../src/modules/takealot/takealot-api");
	const { takealotClient } = await import("../src/integrations/takealot/client");

	try {
		const company = await prisma.company.findFirst({
			where: { id: companyId, deletedAt: null },
			select: { takealotApiKey: true },
		});
		if (!company?.takealotApiKey) {
			throw new Error("The selected company does not have a configured Takealot API key.");
		}

		const apiKey = company.takealotApiKey;
		const today = new Date().toISOString().slice(0, 10);
		console.log(`\nLive Takealot API smoke test (company ${companyId})`);

		let summary;
		try {
			summary = await takealotApi.getSalesSummary(apiKey);
		} catch (error) {
			const rawSummary = await takealotClient.request<unknown>(apiKey, "/v1/sales/summary");
			console.error(`  Observed redacted summary response shape: ${describeShape(rawSummary)}`);
			throw error;
		}
		console.log(`  PASS  GET /v1/sales/summary — ${summary.length} summary periods`);

		const stockCounts = await takealotApi.getStockCounts(apiKey);
		assert.ok(Object.keys(stockCounts).length > 0, "Stock-count response must contain upstream fields");
		console.log(`  PASS  GET /v1/offers/stock_counts — fields: ${Object.keys(stockCounts).join(", ")}`);

		const stockHealth = await takealotApi.getStockHealthStats(apiKey);
		assert.ok(Object.keys(stockHealth).length > 0, "Stock-health response must contain upstream fields");
		console.log(`  PASS  GET /v1/offers/stock_health_stats — fields: ${Object.keys(stockHealth).join(", ")}`);

		const sales = await takealotApi.getSales(apiKey, {}, 1, 1);
		console.log(`  PASS  GET /v1/sales — ${sales.sales.length} record on first page; total ${sales.page_summary.total}`);
		if (sales.sales[0]) {
			console.log(`         Sample record field types (values redacted): ${describeShape(sales.sales[0])}`);
		}

		const sampleSku = sales.sales[0]?.sku;
		assert.ok(sampleSku, "A sales record is required to exercise the documented SKU filter");
		const filteredSales = await takealotApi.getSales(apiKey, { sku: sampleSku }, 1, 1);
		console.log(`  PASS  GET /v1/sales with a documented SKU filter — total ${filteredSales.page_summary.total}`);

		const dateFilteredSales = await takealotApi.getSales(apiKey, { from: today, to: today }, 1, 1);
		console.log(`  PASS  GET /v1/sales with documented date filters — total ${dateFilteredSales.page_summary.total}`);

		let orders;
		try {
			orders = await takealotApi.getSalesOrders(apiKey, {
				from: today,
				to: today,
				page: 1,
				limit: 1,
			});
		} catch (error) {
			const rawOrders = await takealotClient.request<unknown>(apiKey, "/v1/sales/orders", {
				start_date: today,
				end_date: today,
				page_number: 1,
				page_size: 1,
			});
			console.error(`  Observed redacted orders response shape: ${describeShape(rawOrders)}`);
			throw error;
		}
		console.log(`  PASS  GET /v1/sales/orders — ${orders.orders.length} order on first page; total ${orders.page_summary.total}`);
		console.log("\nAll live Takealot API smoke tests passed.");
	} finally {
		await prisma.$disconnect();
	}
};

main().catch((error: unknown) => {
	console.error("\nLive Takealot API smoke test failed.");
	console.error(error);
	process.exitCode = 1;
});
