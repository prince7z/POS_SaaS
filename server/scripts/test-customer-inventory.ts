import assert from "node:assert/strict";
import http from "node:http";

type Options = { method?: string; headers?: Record<string, string>; body?: string };
type Result = { response: { status: number }; body: Record<string, any> };

const main = async (): Promise<void> => {
	process.env.JWT_SECRET ??= "customer-inventory-test-secret";
	process.env.AWS_S3_BUCKET ??= "customer-inventory-test-bucket";
	process.env.AWS_ACCESS_KEY_ID ??= "customer-inventory-test-access-key";
	process.env.AWS_SECRET_ACCESS_KEY ??= "customer-inventory-test-secret-key";

	const { default: app } = await import("../src/app");
	const { prisma } = await import("../src/lib/prisma");
	const server = app.listen(0);
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Could not start test server");
	const baseUrl = `http://127.0.0.1:${address.port}`;
	let companyId: string | undefined;
	let saleId: string | undefined;

	const request = async (path: string, options: Options = {}): Promise<Result> =>
		new Promise((resolve, reject) => {
			const clientRequest = http.request(`${baseUrl}${path}`, { method: options.method ?? "GET", headers: options.headers }, (response) => {
				let rawBody = "";
				response.setEncoding("utf8");
				response.on("data", (chunk) => { rawBody += chunk; });
				response.on("end", () => resolve({ response: { status: response.statusCode ?? 500 }, body: rawBody ? JSON.parse(rawBody) as Record<string, any> : {} }));
			});
			clientRequest.on("error", reject);
			if (options.body) clientRequest.write(options.body);
			clientRequest.end();
		});

	const json = (value: unknown): Options => {
		const body = JSON.stringify(value);
		return { method: "POST", headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) }, body };
	};
	const auth = (token: string, options: Options = {}): Options => ({ ...options, headers: { ...(options.headers ?? {}), authorization: `Bearer ${token}` } });

	try {
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
		const registered = await request("/api/auth/register", json({ company: { name: `Customer Inventory Test ${suffix}` }, admin: { fullName: "Inventory Admin", email: `inventory-${suffix}@example.test`, password: "StrongPassword123" } }));
		assert.equal(registered.response.status, 201);
		companyId = registered.body.data.company.id;
		const token = registered.body.data.accessToken as string;
		const adminId = registered.body.data.user.id as string;

		const customer = await request("/api/customers", auth(token, { ...json({ name: "Credit Customer", email: `credit-${suffix}@example.test`, creditLimit: 100 }) }));
		assert.equal(customer.response.status, 201);
		const customerId = customer.body.data.id as string;
		const walkIn = await request("/api/customers?isWalkIn=true", auth(token));
		assert.equal(walkIn.response.status, 200);
		const walkInId = walkIn.body.data.items[0].id as string;
		assert.equal((await request(`/api/customers/${walkInId}`, auth(token, { method: "DELETE" }))).response.status, 409);

		const category = await request("/api/catalog/categories", auth(token, { ...json({ name: `Inventory Category ${suffix}` }) }));
		const categoryId = category.body.data.id as string;
		const createProduct = async (name: string, sku: string) => {
			const result = await request("/api/catalog/products", auth(token, { ...json({ name, sku, categoryId, rrp: 200, sellingPrice: 150, purchaseCost: 100, lowStockThreshold: 2 }) }));
			assert.equal(result.response.status, 201);
			return result.body.data.id as string;
		};
		const firstProductId = await createProduct("Stock Product One", `STOCK-ONE-${suffix}`);
		const secondProductId = await createProduct("Stock Product Two", `STOCK-TWO-${suffix}`);

		assert.equal((await request("/api/inventory/opening-stock", auth(token, { ...json({ productId: firstProductId, quantity: 10, unitCost: 100 }) }))).response.status, 201);
		assert.equal((await request("/api/inventory/opening-stock", auth(token, { ...json({ productId: secondProductId, quantity: 5, unitCost: 80 }) }))).response.status, 201);
		const failedAdjustment = await request("/api/inventory/adjust", auth(token, { ...json({ items: [{ productId: firstProductId, action: "ADD", quantity: 2 }, { productId: secondProductId, action: "REMOVE", quantity: 100 }] }) }));
		assert.equal(failedAdjustment.response.status, 409);
		assert.equal((await request(`/api/inventory/${firstProductId}`, auth(token))).body.data.stockQuantity, 10);
		assert.equal((await request(`/api/inventory/${secondProductId}`, auth(token))).body.data.stockQuantity, 5);

		const adjustment = await request("/api/inventory/adjust", auth(token, { ...json({ items: [{ productId: firstProductId, action: "REMOVE", quantity: 2 }, { productId: secondProductId, action: "ADD", quantity: 3, unitCost: 90 }] }) }));
		assert.equal(adjustment.response.status, 201);
		const summary = await request("/api/inventory/summary", auth(token));
		assert.equal(summary.response.status, 200);
		assert.ok(summary.body.data.totalProducts >= 2);
		const movements = await request(`/api/inventory/${firstProductId}/movements`, auth(token));
		assert.equal(movements.response.status, 200);
		assert.ok(movements.body.data.items.length >= 2);

		const profileUpload = await request(`/api/customers/${customerId}/profile/upload-url`, auth(token, { ...json({ contentType: "image/jpeg" }) }));
		assert.equal(profileUpload.response.status, 200);
		const profileKey = profileUpload.body.data.key as string;
		assert.match(profileKey, new RegExp(`^companies/${companyId}/customers/${customerId}/profile/`));
		const profileSaved = await request(`/api/customers/${customerId}/profile`, auth(token, { ...json({ profileImageKey: profileKey }), method: "PATCH" }));
		assert.equal(profileSaved.response.status, 200);
		assert.equal((await request(`/api/customers/${customerId}/profile/url`, auth(token))).response.status, 200);

		await prisma.customer.update({ where: { id: customerId }, data: { creditBalance: 50 } });
		saleId = (await prisma.sale.create({ data: { companyId, invoiceNumber: `TEST-${suffix}`, customerId, cashierId: adminId, source: "POS", status: "COMPLETED", paymentStatus: "PENDING", soldAt: new Date(), subtotal: 50, taxRate: 0, taxAmount: 0, discountAmount: 0, total: 50, paidAmount: 0, balanceDue: 50 } })).id;
		const payment = await request(`/api/customers/${customerId}/payments`, auth(token, { ...json({ invoiceId: saleId, amount: 25, paymentMethod: "CASH" }) }));
		assert.equal(payment.response.status, 201);
		assert.equal(payment.body.data.invoiceBalanceDue, 25);
		assert.equal(payment.body.data.customerCreditBalance, 25);
		const history = await request(`/api/customers/${customerId}/payments`, auth(token));
		assert.equal(history.response.status, 200);
		assert.equal(history.body.data.items.length, 1);
		assert.equal((await request(`/api/customers/${customerId}`, auth(token))).body.data.creditBalance, 25);

		const otherCompany = await request("/api/auth/register", json({ company: { name: `Other Customer Store ${suffix}` }, admin: { fullName: "Other Admin", email: `other-customer-${suffix}@example.test`, password: "StrongPassword123" } }));
		const otherCompanyId = otherCompany.body.data.company.id as string;
		const otherToken = otherCompany.body.data.accessToken as string;
		assert.equal((await request(`/api/customers/${customerId}`, auth(otherToken))).response.status, 404);

		console.log("CUSTOMER_INVENTORY_MODULE_TESTS_PASSED");
		await prisma.auditLog.deleteMany({ where: { companyId: otherCompanyId } });
		await prisma.session.deleteMany({ where: { user: { companyId: otherCompanyId } } });
		await prisma.customer.deleteMany({ where: { companyId: otherCompanyId } });
		await prisma.user.deleteMany({ where: { companyId: otherCompanyId } });
		await prisma.company.delete({ where: { id: otherCompanyId } });
	} finally {
		if (companyId) {
			if (saleId) {
				await prisma.customerPayment.deleteMany({ where: { invoiceId: saleId } });
				await prisma.sale.delete({ where: { id: saleId } });
			}
			await prisma.auditLog.deleteMany({ where: { companyId } });
			await prisma.inventoryMovement.deleteMany({ where: { companyId } });
			await prisma.product.deleteMany({ where: { companyId } });
			await prisma.category.deleteMany({ where: { companyId } });
			await prisma.customer.deleteMany({ where: { companyId } });
			await prisma.session.deleteMany({ where: { user: { companyId } } });
			await prisma.user.deleteMany({ where: { companyId } });
			await prisma.company.delete({ where: { id: companyId } });
		}
		await prisma.$disconnect();
		server.close();
	}
};

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
