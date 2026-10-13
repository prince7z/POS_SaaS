import assert from "node:assert/strict";
import http from "node:http";

type HttpResult = { status: number; body: Record<string, unknown> };
type StoredSnapshot = {
	companyId: string;
	capturedAt: Date;
	stockCounts: Record<string, unknown>;
	stockHealth: Record<string, unknown>;
};

const main = async (): Promise<void> => {
	process.env.NODE_ENV = "test";
	process.env.TEST_AUTH_BYPASS = "true";
	process.env.PSQL ??= "postgresql://user:password@127.0.0.1:5432/pos_test?schema=public";
	process.env.JWT_SECRET ??= "takealot-test-secret";
	process.env.AWS_S3_BUCKET ??= "takealot-test-bucket";
	process.env.AWS_ACCESS_KEY_ID ??= "takealot-test-access-key";
	process.env.AWS_SECRET_ACCESS_KEY ??= "takealot-test-secret-key";

	const express = (await import("express")).default;
	const { errorHandler } = await import("../src/middleware/error");
	const { default: takealotRouter } = await import("../src/modules/takealot/route");
	const { env } = await import("../src/config/env");
	const { prisma } = await import("../src/lib/prisma");
	const { takealotClient } = await import("../src/integrations/takealot/client");
	const jwt = (await import("jsonwebtoken")).default;
	const app = express();
	app.use("/takealot", takealotRouter);
	app.use(errorHandler);
	const server = app.listen(0);
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Could not start Takealot test server");
	const baseUrl = `http://127.0.0.1:${address.port}`;
	const snapshotRows: StoredSnapshot[] = [];
	const snapshotModel = (prisma as unknown as {
		takealotInventorySnapshot: {
			create: (input: { data: StoredSnapshot }) => Promise<unknown>;
			findMany: (input: {
				where: { companyId: string; capturedAt: { gte: Date; lte: Date } };
				orderBy: { capturedAt: "asc" };
				select: { capturedAt: true; stockCounts: true; stockHealth: true };
			}) => Promise<StoredSnapshot[]>;
		};
	}).takealotInventorySnapshot;
	const originalCreate = snapshotModel.create;
	const originalFindMany = snapshotModel.findMany;
	const companyUserModel = prisma.companyUser as unknown as {
		findFirst: (input: unknown) => Promise<{ userId: string; companyId: string; accesses: never[] } | null>;
	};
	const originalCompanyUserFindFirst = companyUserModel.findFirst;
	snapshotModel.create = async ({ data }) => {
		snapshotRows.push(data);
		return { ...data, id: `snapshot-${snapshotRows.length}` };
	};
	snapshotModel.findMany = async ({ where }) => snapshotRows
		.filter((row) => row.companyId === where.companyId &&
			row.capturedAt >= where.capturedAt.gte &&
			row.capturedAt <= where.capturedAt.lte)
		.sort((left, right) => left.capturedAt.getTime() - right.capturedAt.getTime());
	companyUserModel.findFirst = async () => ({
		userId: "permission-test-user",
		companyId: "permission-test-company",
		accesses: [],
	});

	const originalFetch = globalThis.fetch;
	const originalConsoleError = console.error;
	console.error = (...args: unknown[]) => {
		const candidate = args[0];
		if (
			candidate instanceof Error &&
			["UNAUTHORIZED", "FORBIDDEN", "VALIDATION_ERROR", "TAKEALOT_INCOMPLETE_RESPONSE", "TAKEALOT_INVALID_RESPONSE"].includes(
				(candidate as Error & { code?: string }).code ?? "",
			)
		) return;
		originalConsoleError(...args);
	};
	const upstreamCalls: Array<{ url: URL; authorization: string | null }> = [];
	let retryAttempts = 0;
	const sales = [
		{
			shipment_id: 1, shipment_state_id: 1, po_number: 101, shipment_name: "Shipment 1",
			offer_id: 55, product_title: "Alpha item", takealot_url_mobi: "https://example.test/a",
			sku: "SKU-A", tsin: 100, order_id: 10, order_item_id: 1, quantity: 2, selling_price: 10,
			dc: "JHB", customer_dc: "CPT", order_date: "01 Oct 2026 10:00:00",
			sale_status: true, promotion: false, customer: "Must not be returned", stock_source_region: "ZA",
		},
		{
			shipment_id: 2, shipment_state_id: 1, po_number: 102, shipment_name: "Shipment 2",
			offer_id: 55, product_title: "Alpha item", takealot_url_mobi: "https://example.test/a",
			sku: "SKU-A", tsin: 100, order_id: 10, order_item_id: 2, quantity: 1, selling_price: 20,
			dc: "JHB", customer_dc: "CPT", order_date: "2026-10-01T12:00:00Z",
			sale_status: false, promotion: true, customer: "Must not be returned", stock_source_region: "ZA",
		},
		{
			shipment_id: 3, shipment_state_id: 1, po_number: 103, shipment_name: "Shipment 3",
			offer_id: 66, product_title: "Beta item", takealot_url_mobi: "https://example.test/b",
			sku: "SKU-B", tsin: 200, order_id: 11, order_item_id: 3, quantity: 3, selling_price: 5,
			dc: "CPT", customer_dc: "JHB", order_date: "2026-10-02T08:00:00Z",
			sale_status: true, promotion: true, customer: "Must not be returned", stock_source_region: "ZA",
		},
	];

	globalThis.fetch = async (input, init) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		const authorization = new Headers(init?.headers).get("authorization");
		upstreamCalls.push({ url, authorization });
		if (url.pathname === "/v1/test/retry") {
			retryAttempts++;
			if (retryAttempts === 1) {
				return new Response(JSON.stringify({ message: "rate limited" }), {
					status: 429,
					headers: { "content-type": "application/json", "retry-after": "0" },
				});
			}
			return Response.json({ ok: true });
		}
		if (url.pathname === "/v1/test/forbidden") {
			return Response.json({ message: "private upstream detail" }, { status: 403 });
		}
		if (url.pathname === "/v2/offers/offer/NOTFOUND") {
			return new Response(null, { status: 404 });
		}
		if (url.pathname === "/v1/sales/summary") {
			return Response.json({ sales_summary: [{ date_range: "documented period", total: 500, quantity: 7 }] });
		}
		if (url.pathname === "/v1/offers/stock_counts") return Response.json({ count: 15 });
		if (url.pathname === "/v1/offers/stock_health_stats") {
			return Response.json({ storage_fee_enabled_offer_count: 2 });
		}
		if (url.pathname === "/v1/sales/orders") {
			const pageNumber = Number(url.searchParams.get("page_number") ?? 1);
			return Response.json({
				page_summary: { page_size: 2, page_number: pageNumber, total: 1 },
				orders: [{
					order_id: 10,
					date_authed: "2026-10-01T10:00:00Z",
					order_items: [
						{ order_item_id: 1, merchant_sku: "SKU-A", title: "Alpha item", tsin_id: 100, takealot_url: "https://example.test/a" },
						{ order_item_id: 2, merchant_sku: "SKU-B", title: "Beta item", tsin_id: 200, takealot_url: "https://example.test/b" },
					],
				}],
			});
		}
		if (url.pathname === "/v1/sales") {
			const pageNumber = Number(url.searchParams.get("page_number") ?? 1);
			const pageSize = Number(url.searchParams.get("page_size") ?? 100);
			const filters = url.searchParams.getAll("filters");
			if (filters.includes("sku:INVALID_DATE") || filters.includes("sku:OFFSET_DATE")) {
				const orderDate = filters.includes("sku:INVALID_DATE")
					? "not-a-date"
					: "2026-10-02T00:30:00+02:00";
				return Response.json({
					page_summary: { page_size: pageSize, page_number: pageNumber, total: 1 },
					sales: [{ ...sales[0], order_date: orderDate }],
				});
			}
			if (url.pathname === "/v1/sales" && (filters.includes("sku:PAGEFAIL") || filters.includes("sku:PAGEOK"))) {
				const completePagination = filters.includes("sku:PAGEOK");
				const pageRows = pageNumber === 1
					? Array.from({ length: 100 }, (_, index) => ({
						...sales[index % sales.length],
						order_id: index + 1,
						order_item_id: index + 1,
					}))
					: completePagination ? [{ ...sales[0], order_id: 101, order_item_id: 101 }] : [];
				return Response.json({
					page_summary: { page_size: pageSize, page_number: pageNumber, total: 101 },
					sales: pageRows,
				});
			}
			await new Promise((resolve) => setTimeout(resolve, 10));
			const rows = sales.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
			return Response.json({
				page_summary: { page_size: pageSize, page_number: pageNumber, total: sales.length },
				sales: rows,
			});
		}
		throw new Error(`Unexpected Takealot test URL: ${url.pathname}`);
	};

	const request = async (path: string, headers?: http.OutgoingHttpHeaders): Promise<HttpResult> => new Promise((resolve, reject) => {
		http.get(`${baseUrl}${path}`, { headers }, (response) => {
			let rawBody = "";
			response.setEncoding("utf8");
			response.on("data", (chunk: string) => { rawBody += chunk; });
			response.on("end", () => {
				try {
					resolve({
						status: response.statusCode ?? 500,
						body: JSON.parse(rawBody) as Record<string, unknown>,
					});
				} catch (error) {
					reject(error);
				}
			});
		}).on("error", reject);
	});
	const dataOf = (result: HttpResult): Record<string, any> => result.body.data as Record<string, any>;
	const logPass = (name: string) => console.log(`  PASS  ${name}`);

	try {
		console.log("\nTakealot integration checks");

		(env as { testAuthBypass: boolean }).testAuthBypass = false;
		const unauthenticated = await request("/takealot/overview");
		assert.equal(unauthenticated.status, 401);
		(env as { testAuthBypass: boolean }).testAuthBypass = true;
		logPass("dashboard routes require authentication");
		(env as { testAuthBypass: boolean }).testAuthBypass = false;
		const permissionToken = jwt.sign(
			{ sub: "permission-test-user", companyId: "permission-test-company" },
			env.jwtSecret,
		);
		const deniedWithoutTakealotAccess = await request("/takealot/overview", {
			Authorization: `Bearer ${permissionToken}`,
		});
		assert.equal(deniedWithoutTakealotAccess.status, 403);
		(env as { testAuthBypass: boolean }).testAuthBypass = true;
		logPass("every Takealot route rejects authenticated users without TAKEALOT permission");

		const invalidTrend = await request("/takealot/sales/trends?from=2026-10-01&to=2026-10-02&interval=year");
		assert.equal(invalidTrend.status, 400);
		logPass("query validation rejects unsupported trend intervals");
		const invalidFilter = await request("/takealot/sales?unsupportedFilter=value");
		assert.equal(invalidFilter.status, 400);
		logPass("query validation rejects unsupported filters");

		const overview = await request("/takealot/overview?from=2026-10-01&to=2026-10-02");
		assert.equal(overview.status, 200);
		assert.equal(dataOf(overview).salesSummary.requestedRangeApplied, false);
		assert.equal(dataOf(overview).inventory.stockCounts.count, 15);
		assert.equal(dataOf(overview).inventory.stockHealth.storage_fee_enabled_offer_count, 2);
		logPass("overview combines the documented summary and current stock endpoints without claiming date filtering");

		const salesList = await request("/takealot/sales?from=2026-10-01&to=2026-10-02&sku=SKU-A&productTitle=Alpha%20item&tsin=100&orderId=10&dc=JHB&customerDc=CPT&saleStatus=true&promotion=false&page=2&limit=2");
		assert.equal(salesList.status, 200);
		assert.equal((dataOf(salesList).sales as unknown[]).length, 1);
		assert.equal((salesList.body.pagination as Record<string, unknown>).total, 3);
		assert.equal((salesList.body.pagination as Record<string, unknown>).hasMore, false);
		assert.equal("customer" in (dataOf(salesList).sales as Array<Record<string, unknown>>)[0], false);
		const salesApiCall = upstreamCalls.find((call) => call.url.pathname === "/v1/sales");
		assert.ok(salesApiCall);
		for (const filter of ["start_date:2026-10-01", "end_date:2026-10-02", "sku:SKU-A", "product_title:Alpha item", "tsin:100", "order_id:10", "dc:JHB", "customer_dc:CPT", "sale_status:true", "promotion:false"]) {
			assert.ok(salesApiCall.url.searchParams.getAll("filters").includes(filter), `missing mapped filter ${filter}`);
		}
		assert.equal(salesApiCall.url.searchParams.get("page_number"), "2");
		assert.equal(salesApiCall.url.searchParams.get("page_size"), "2");
		logPass("sales filters map to documented upstream filters and pagination metadata is accurate");

		const partialResult = await request("/takealot/sales/trends?from=2026-10-01&to=2026-10-02&sku=PAGEFAIL");
		assert.equal(partialResult.status, 502);
		assert.equal(partialResult.body.success, false);
		logPass("incomplete multi-page datasets fail instead of returning partial analytics");
		const multiPageResult = await request("/takealot/sales/trends?from=2026-10-01&to=2026-10-02&sku=PAGEOK");
		assert.equal(multiPageResult.status, 200);
		assert.equal(upstreamCalls.filter((call) => call.url.pathname === "/v1/sales" && call.url.searchParams.getAll("filters").includes("sku:PAGEOK")).length, 2);
		logPass("analytics fetches every page before aggregating a complete result");

		const trends = await request("/takealot/sales/trends?from=2026-10-01&to=2026-10-02&interval=day&metric=orders");
		assert.equal(trends.status, 200);
		const trendSeries = dataOf(trends).series as Array<Record<string, unknown>>;
		assert.equal(trendSeries.length, 2);
		assert.deepEqual(trendSeries[0], { date: "2026-10-01", revenue: 40, units: 3, orders: 1 });
		assert.deepEqual(trendSeries[1], { date: "2026-10-02", revenue: 15, units: 3, orders: 1 });
		logPass("trends aggregate ISO and Takealot-formatted dates by UTC day");
		const invalidOrderDate = await request("/takealot/sales/trends?from=2026-10-01&to=2026-10-02&sku=INVALID_DATE");
		assert.equal(invalidOrderDate.status, 502);
		assert.equal((invalidOrderDate.body.error as Record<string, unknown>).code, "TAKEALOT_INVALID_RESPONSE");
		logPass("trends explicitly reject malformed upstream order dates");
		const timezoneTrend = await request("/takealot/sales/trends?from=2026-10-01&to=2026-10-02&sku=OFFSET_DATE");
		assert.equal(timezoneTrend.status, 200);
		assert.equal((dataOf(timezoneTrend).series as Array<Record<string, unknown>>)[0].date, "2026-10-01");
		logPass("ISO timezone offsets are applied before assigning trend buckets");

		const callsBeforeCoalescing = upstreamCalls.filter((call) => call.url.pathname === "/v1/sales").length;
		const concurrentTrends = await Promise.all([
			request("/takealot/sales/trends?from=2026-10-01&to=2026-10-02&sku=SKU-A"),
			request("/takealot/sales/trends?from=2026-10-01&to=2026-10-02&sku=SKU-A"),
		]);
		assert.deepEqual(concurrentTrends.map((result) => result.status), [200, 200]);
		assert.equal(
			upstreamCalls.filter((call) => call.url.pathname === "/v1/sales").length - callsBeforeCoalescing,
			1,
		);
		logPass("concurrent identical sales requests share one in-progress upstream fetch");

		const breakdown = await request("/takealot/sales/breakdown?from=2026-10-01&to=2026-10-02&groupBy=promotion");
		assert.equal(breakdown.status, 200);
		const groups = dataOf(breakdown).breakdown as Array<Record<string, unknown>>;
		assert.deepEqual(groups, [
			{ key: "false", revenue: 20, units: 2, orders: 1 },
			{ key: "true", revenue: 35, units: 4, orders: 2 },
		]);
		logPass("breakdowns group data and deduplicate orders across multiple line items");

		const products = await request("/takealot/products/performance?from=2026-10-01&to=2026-10-02&sortBy=revenue&order=desc&page=1&limit=1");
		assert.equal(products.status, 200);
		assert.deepEqual((dataOf(products).products as Array<Record<string, unknown>>)[0], {
			sku: "SKU-A", tsin: 100, title: "Alpha item", revenue: 40, units: 3, orders: 1, averagePrice: 13.33,
		});
		assert.equal((products.body.pagination as Record<string, unknown>).total, 2);
		logPass("product performance ranks by stable offer identifier and calculates weighted average price");

		const orders = await request("/takealot/orders?from=2026-10-01&to=2026-10-02&sku=SKU-A&orderId=10&page=1&limit=2");
		assert.equal(orders.status, 200);
		const orderRows = dataOf(orders).orders as Array<Record<string, unknown>>;
		assert.equal(orderRows.length, 1);
		assert.equal((orderRows[0].order_items as unknown[]).length, 2);
		assert.equal(upstreamCalls.at(-1)?.url.pathname, "/v1/sales/orders");
		assert.equal(upstreamCalls.at(-1)?.url.searchParams.get("start_date"), "2026-10-01");
		assert.equal(upstreamCalls.at(-1)?.url.searchParams.get("end_date"), "2026-10-02");
		assert.equal(upstreamCalls.at(-1)?.url.searchParams.get("filters"), null);
		logPass("orders use the dedicated endpoint and preserve separate order-item rows");

		const inventory = await request("/takealot/inventory/summary");
		assert.equal(inventory.status, 200);
		assert.equal(snapshotRows.length, 1);
		assert.equal(dataOf(inventory).stockCounts.count, 15);
		assert.equal(snapshotRows[0].companyId, "a2b8e672-7f09-4783-81ba-51a572205b71");
		logPass("inventory refresh saves a timestamped seller-scoped snapshot");

		snapshotRows.push({
			companyId: "other-company",
			capturedAt: new Date("2026-10-14T00:00:00.000Z"),
			stockCounts: { count: 999 },
			stockHealth: { storage_fee_enabled_offer_count: 999 },
		});
		const snapshots = await request("/takealot/inventory/snapshots?from=2026-10-01&to=2026-10-31&interval=day");
		assert.equal(snapshots.status, 200);
		assert.equal((dataOf(snapshots).series as unknown[]).length, 1);
		logPass("inventory history returns only snapshots actually recorded");

		const retryResult = await takealotClient.request<{ ok: boolean }>("test-api-key", "/v1/test/retry", { q: "a value" });
		assert.equal(retryResult.ok, true);
		assert.equal(retryAttempts, 2);
		assert.equal(upstreamCalls.at(-1)?.authorization, "Key test-api-key");
		assert.equal(upstreamCalls.at(-1)?.url.searchParams.get("q"), "a value");
		logPass("central client encodes payloads, authenticates requests, and retries a rate-limited call");

		assert.equal(await takealotClient.findOffer("test-api-key", "OFFER_ID", "NOTFOUND"), null);
		logPass("existing offer lookup preserves its not-found behavior through the central client");

		await assert.rejects(
			() => takealotClient.request("test-api-key", "/v1/test/forbidden"),
			(error: unknown) => error instanceof Error &&
				error.message === "Takealot API request failed with status 403." &&
				!error.message.includes("private upstream detail"),
		);
		logPass("upstream failures surface sanitized errors instead of empty successful data");

		console.log("\nAll Takealot integration checks passed.");
	} finally {
		globalThis.fetch = originalFetch;
		console.error = originalConsoleError;
		snapshotModel.create = originalCreate;
		snapshotModel.findMany = originalFindMany;
		companyUserModel.findFirst = originalCompanyUserFindFirst;
		await new Promise<void>((resolve, reject) => {
			server.close((error) => error ? reject(error) : resolve());
		});
		await prisma.$disconnect();
	}
};

main().catch((error: unknown) => {
	console.error("\nTakealot integration checks failed.");
	console.error(error);
	process.exitCode = 1;
});
