import assert from "node:assert/strict";
import http from "node:http";

type Options = { method?: string; headers?: Record<string, string>; body?: string };
type Result = { status: number; body: Record<string, any> };

const main = async (): Promise<void> => {
	process.env.JWT_SECRET ??= "sales-purchases-test-secret";
	process.env.AWS_S3_BUCKET ??= "sales-purchases-test-bucket";
	process.env.AWS_ACCESS_KEY_ID ??= "sales-purchases-test-access-key";
	process.env.AWS_SECRET_ACCESS_KEY ??= "sales-purchases-test-secret-key";

	const { default: app } = await import("../src/app");
	const { prisma } = await import("../src/lib/prisma");
	const server = app.listen(0);
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Could not start test server");
	const baseUrl = `http://127.0.0.1:${address.port}`;
	let companyId: string | undefined;

	const request = async (path: string, options: Options = {}): Promise<Result> =>
		new Promise((resolve, reject) => {
			const clientRequest = http.request(`${baseUrl}${path}`, {
				method: options.method ?? "GET",
				headers: options.headers,
			}, (response) => {
				let rawBody = "";
				response.setEncoding("utf8");
				response.on("data", (chunk) => { rawBody += chunk; });
				response.on("end", () => {
					let body: Record<string, any> = {};
					if (rawBody) {
						try {
							body = JSON.parse(rawBody) as Record<string, any>;
						} catch {
							body = { rawBody };
						}
					}
					resolve({ status: response.statusCode ?? 500, body });
				});
			});
			clientRequest.on("error", reject);
			if (options.body) clientRequest.write(options.body);
			clientRequest.end();
		});

	const json = (value: unknown, method = "POST"): Options => {
		const body = JSON.stringify(value);
		return {
			method,
			headers: {
				"content-type": "application/json",
				"content-length": String(Buffer.byteLength(body)),
			},
			body,
		};
	};

	const authenticated = (token: string, options: Options = {}): Options => ({
		...options,
		headers: {
			...(options.headers ?? {}),
			authorization: `Bearer ${token}`,
		},
	});

	try {
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
		const registration = await request("/api/auth/register", json({
			company: { name: `Sales Purchases Test ${suffix}` },
			admin: {
				fullName: "Sales Purchases Admin",
				email: `sales-purchases-${suffix}@example.test`,
				password: "StrongPassword123",
			},
		}));
		assert.equal(registration.status, 201);
		companyId = registration.body.data.company.id as string;
		const token = registration.body.data.accessToken as string;

		const unauthenticatedSales = await request("/api/sales");
		assert.equal(unauthenticatedSales.status, 401);
		const unauthenticatedPurchases = await request("/api/purchases");
		assert.equal(unauthenticatedPurchases.status, 401);

		const category = await request("/api/catalog/categories", authenticated(token, json({ name: `Test Category ${suffix}` })));
		assert.equal(category.status, 201);
		const categoryId = category.body.data.id as string;

		const product = await request("/api/catalog/products", authenticated(token, json({
			name: `Test Product ${suffix}`,
			sku: `TEST-${suffix}`,
			categoryId,
			rrp: 150,
			sellingPrice: 100,
			purchaseCost: 60,
			lowStockThreshold: 1,
		})));
		assert.equal(product.status, 201);
		const productId = product.body.data.id as string;

		const supplier = await request("/api/purchases/suppliers", authenticated(token, json({
			name: `Test Supplier ${suffix}`,
			email: `supplier-${suffix}@example.test`,
			paymentTermsDays: 30,
		})));
		assert.equal(supplier.status, 201);
		const supplierId = supplier.body.data.id as string;

		const duplicateSupplier = await request("/api/purchases/suppliers", authenticated(token, json({
			name: `Test Supplier ${suffix}`,
		})));
		assert.equal(duplicateSupplier.status, 409);

		const purchase = await request("/api/purchases", authenticated(token, json({
			supplierId,
			taxRate: 15,
			items: [{ productId, quantity: 5, unitCost: 60 }],
			notes: "Integration test purchase",
		})));
		if (purchase.status !== 201) console.error("PURCHASE_CREATE_RESPONSE", purchase);
		assert.equal(purchase.status, 201);
		assert.equal(purchase.body.data.status, "DRAFT");
		assert.equal(purchase.body.data.total, 345);
		const purchaseId = purchase.body.data.id as string;
		const purchaseItemId = purchase.body.data.items[0].id as string;

		const purchaseReadBack = await request(`/api/purchases/${purchaseId}`, authenticated(token));
		assert.equal(purchaseReadBack.status, 200);
		assert.equal(purchaseReadBack.body.data.items[0].orderedQuantity, 5);

		const received = await request(`/api/purchases/${purchaseId}/receive`, authenticated(token, json({
			items: [{ purchaseOrderItemId: purchaseItemId, quantityReceived: 5 }],
		})));
		assert.equal(received.status, 200);
		assert.equal(received.body.data.status, "RECEIVED");
		assert.equal(received.body.data.items[0].receivedQuantity, 5);

		const inventoryAfterReceipt = await request(`/api/inventory/${productId}`, authenticated(token));
		assert.equal(inventoryAfterReceipt.status, 200);
		assert.equal(inventoryAfterReceipt.body.data.stockQuantity, 5);

		const supplierPayment = await request(`/api/purchases/${purchaseId}/payments`, authenticated(token, json({
			amount: 100,
			paymentMethod: "BANK_TRANSFER",
			reference: `PAY-${suffix}`,
		})));
		assert.equal(supplierPayment.status, 201);
		assert.equal(supplierPayment.body.data.paidAmount, 100);
		assert.equal(supplierPayment.body.data.balanceDue, 245);

		const purchasePayments = await request(`/api/purchases/${purchaseId}/payments`, authenticated(token));
		assert.equal(purchasePayments.status, 200);
		assert.equal(purchasePayments.body.data.items.length, 1);
		assert.equal(purchasePayments.body.data.items[0].paymentMethod, "BANK_TRANSFER");

		const saleDraft = await request("/api/sales/drafts", authenticated(token, json({
			items: [{ productId, quantity: 2 }],
		})));
		assert.equal(saleDraft.status, 201);
		assert.equal(saleDraft.body.data.status, "DRAFT");
		assert.equal(saleDraft.body.data.total, 200);
		const saleId = saleDraft.body.data.id as string;

		const completedSale = await request(`/api/sales/${saleId}/complete`, authenticated(token, json({
			payments: [{ paymentMethod: "CASH", amount: 200, reference: `SALE-${suffix}` }],
		})));
		assert.equal(completedSale.status, 200);
		assert.equal(completedSale.body.data.status, "COMPLETED");
		assert.equal(completedSale.body.data.paymentStatus, "PAID");
		assert.equal(completedSale.body.data.paidAmount, 200);
		assert.equal(completedSale.body.data.balanceDue, 0);

		const saleReadBack = await request(`/api/sales/${saleId}`, authenticated(token));
		assert.equal(saleReadBack.status, 200);
		assert.equal(saleReadBack.body.data.status, "COMPLETED");
		assert.equal(saleReadBack.body.data.items[0].quantity, 2);

		const inventoryAfterSale = await request(`/api/inventory/${productId}`, authenticated(token));
		assert.equal(inventoryAfterSale.status, 200);
		assert.equal(inventoryAfterSale.body.data.stockQuantity, 3);

		const returnable = await request(`/api/sales/${saleId}/returnable-items`, authenticated(token));
		assert.equal(returnable.status, 200);
		const saleItemId = returnable.body.data.items[0].saleItemId as string;

		const saleReturn = await request(`/api/sales/${saleId}/returns`, authenticated(token, json({
			refundType: "CASH",
			reason: "Integration test return",
			items: [{ saleItemId, quantity: 1 }],
		})));
		assert.equal(saleReturn.status, 201);
		assert.equal(saleReturn.body.data.refundAmount, 100);

		const returns = await request(`/api/sales/${saleId}/returns`, authenticated(token));
		assert.equal(returns.status, 200);
		assert.equal(returns.body.data.items.length, 1);

		const inventoryAfterReturn = await request(`/api/inventory/${productId}`, authenticated(token));
		assert.equal(inventoryAfterReturn.status, 200);
		assert.equal(inventoryAfterReturn.body.data.stockQuantity, 4);

		console.log("SALES_PURCHASES_MODULE_TESTS_PASSED");
	} finally {
		if (companyId) {
			await prisma.$transaction([
				prisma.returnItem.deleteMany({ where: { return: { companyId } } }),
				prisma.return.deleteMany({ where: { companyId } }),
				prisma.salePayment.deleteMany({ where: { sale: { companyId } } }),
				prisma.customerPayment.deleteMany({ where: { companyId } }),
				prisma.saleItem.deleteMany({ where: { sale: { companyId } } }),
				prisma.sale.deleteMany({ where: { companyId } }),
				prisma.supplierPayment.deleteMany({ where: { companyId } }),
				prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { companyId } } }),
				prisma.purchaseOrder.deleteMany({ where: { companyId } }),
				prisma.inventoryMovement.deleteMany({ where: { companyId } }),
				prisma.emailLog.deleteMany({ where: { companyId } }),
				prisma.auditLog.deleteMany({ where: { companyId } }),
				prisma.product.deleteMany({ where: { companyId } }),
				prisma.category.deleteMany({ where: { companyId } }),
				prisma.supplier.deleteMany({ where: { companyId } }),
				prisma.customer.deleteMany({ where: { companyId } }),
				prisma.session.deleteMany({ where: { user: { companyId } } }),
				prisma.user.deleteMany({ where: { companyId } }),
				prisma.company.delete({ where: { id: companyId } }),
			]);
		}
		await prisma.$disconnect();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
};

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
