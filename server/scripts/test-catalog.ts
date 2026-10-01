import assert from "node:assert/strict";
import http from "node:http";

type Options = { method?: string; headers?: Record<string, string>; body?: string };
type Result = { response: { status: number }; body: Record<string, any> };

const main = async (): Promise<void> => {
	process.env.JWT_SECRET ??= "catalog-test-secret-change-me";
	process.env.AWS_S3_BUCKET ??= "catalog-test-bucket";
	process.env.AWS_ACCESS_KEY_ID ??= "catalog-test-access-key";
	process.env.AWS_SECRET_ACCESS_KEY ??= "catalog-test-secret-key";

	const { default: app } = await import("../src/app");
	const { prisma } = await import("../src/lib/prisma");
	const server = app.listen(0);
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Could not start test server");
	const baseUrl = `http://127.0.0.1:${address.port}`;
	const companyIds: string[] = [];

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
	const tokenOptions = (token: string, options: Options = {}): Options => ({ ...options, headers: { ...(options.headers ?? {}), authorization: `Bearer ${token}` } });

	try {
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
		const register = async (name: string, emailPrefix: string) => {
			const result = await request("/api/auth/register", json({ company: { name: `${name}-${suffix}` }, admin: { fullName: `${name} Admin`, email: `${emailPrefix}-${suffix}@example.test`, password: "StrongPassword123" } }));
			assert.equal(result.response.status, 201);
			companyIds.push(result.body.data.company.id);
			return result.body.data as { company: { id: string }; accessToken: string };
		};

		const first = await register("Catalog Test Store", "catalog-admin");
		const second = await register("Other Catalog Store", "other-admin");
		const firstAuth = tokenOptions(first.accessToken);
		const secondAuth = tokenOptions(second.accessToken);

		const category = await request("/api/catalog/categories", tokenOptions(first.accessToken, { ...json({ name: "Electronics", description: "Devices" }) }));
		assert.equal(category.response.status, 201);
		const categoryId = category.body.data.id as string;
		const child = await request("/api/catalog/categories", tokenOptions(first.accessToken, { ...json({ name: "Phones", parentId: categoryId }) }));
		assert.equal(child.response.status, 201);
		const childId = child.body.data.id as string;

		const hierarchy = await request(`/api/catalog/categories/${categoryId}`, firstAuth);
		assert.equal(hierarchy.response.status, 200);
		assert.equal(hierarchy.body.data.children.length, 1);

		const brand = await request("/api/catalog/brands", tokenOptions(first.accessToken, { ...json({ name: "Catalog Brand" }) }));
		assert.equal(brand.response.status, 201);
		const brandId = brand.body.data.id as string;
		const brandUpload = await request(`/api/catalog/brands/${brandId}/logo/upload-url`, tokenOptions(first.accessToken, { ...json({ contentType: "image/png" }) }));
		assert.equal(brandUpload.response.status, 200);
		assert.match(brandUpload.body.data.key, new RegExp(`^companies/${first.company.id}/brands/${brandId}/logo/`));

		const product = await request("/api/catalog/products", tokenOptions(first.accessToken, { ...json({ name: "Phone", sku: `PHONE-${suffix}`, categoryId: childId, brandId, rrp: 100, sellingPrice: 90, purchaseCost: 50, lowStockThreshold: 2 }) }));
		assert.equal(product.response.status, 201);
		const productId = product.body.data.id as string;
		assert.equal(product.body.data.stockQuantity, 0);
		assert.equal(product.body.data.averageCost, 0);
		assert.equal(product.body.data.isLowStock, true);

		const lowStock = await request("/api/catalog/products?lowStock=true", firstAuth);
		assert.equal(lowStock.response.status, 200);
		assert.ok(lowStock.body.data.items.some((item: { id: string }) => item.id === productId));

		const imageUrls = await request(`/api/catalog/products/${productId}/images/upload-urls`, tokenOptions(first.accessToken, { ...json({ contentTypes: ["image/webp", "image/jpeg"] }) }));
		assert.equal(imageUrls.response.status, 200);
		const imageKeys = imageUrls.body.data.uploads.map((item: { key: string }) => item.key) as string[];
		const added = await request(`/api/catalog/products/${productId}/images`, tokenOptions(first.accessToken, { ...json({ imageKeys }) }));
		assert.deepEqual(added.body.data.imageKeys, imageKeys);
		const download = await request(`/api/catalog/products/${productId}/images/0/url`, firstAuth);
		assert.equal(download.response.status, 200);
		const reordered = await request(`/api/catalog/products/${productId}/images`, tokenOptions(first.accessToken, { ...json({ imageKeys: [...imageKeys].reverse() }), method: "PATCH" }));
		assert.deepEqual(reordered.body.data.imageKeys, [...imageKeys].reverse());
		const removed = await request(`/api/catalog/products/${productId}/images`, tokenOptions(first.accessToken, { ...json({ imageKey: imageKeys[0] }), method: "DELETE" }));
		assert.equal(removed.response.status, 200);

		const crossTenant = await request(`/api/catalog/products/${productId}`, secondAuth);
		assert.equal(crossTenant.response.status, 404);
		assert.equal((await request(`/api/catalog/brands/${brandId}`, secondAuth)).response.status, 404);
		assert.equal((await request(`/api/catalog/categories/${categoryId}`, secondAuth)).response.status, 404);

		assert.equal((await request(`/api/catalog/brands/${brandId}`, firstAuth)).response.status, 200);
		assert.equal((await request(`/api/catalog/brands/${brandId}`, tokenOptions(first.accessToken, { method: "DELETE" }))).response.status, 409);
		assert.equal((await request(`/api/catalog/categories/${categoryId}`, tokenOptions(first.accessToken, { method: "DELETE" }))).response.status, 409);
		assert.equal((await request(`/api/catalog/products/${productId}`, tokenOptions(first.accessToken, { method: "DELETE" }))).response.status, 200);
		assert.equal((await request(`/api/catalog/categories/${childId}`, tokenOptions(first.accessToken, { method: "DELETE" }))).response.status, 200);
		assert.equal((await request(`/api/catalog/categories/${categoryId}`, tokenOptions(first.accessToken, { method: "DELETE" }))).response.status, 200);
		assert.equal((await request(`/api/catalog/brands/${brandId}`, tokenOptions(first.accessToken, { method: "DELETE" }))).response.status, 200);

		console.log("CATALOG_MODULE_TESTS_PASSED");
	} finally {
		for (const companyId of companyIds) {
			await prisma.auditLog.deleteMany({ where: { companyId } });
			await prisma.session.deleteMany({ where: { user: { companyId } } });
			await prisma.product.deleteMany({ where: { companyId } });
			await prisma.category.deleteMany({ where: { companyId } });
			await prisma.brand.deleteMany({ where: { companyId } });
			await prisma.customer.deleteMany({ where: { companyId } });
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
