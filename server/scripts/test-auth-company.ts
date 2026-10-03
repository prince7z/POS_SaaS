import assert from "node:assert/strict";
import http from "node:http";

type TestRequest = {
	method?: string;
	headers?: Record<string, string>;
	body?: string;
};

type TestResponse = {
	response: { status: number };
	body: Record<string, any>;
};

const main = async (): Promise<void> => {
	process.env.JWT_SECRET ??= "module-test-secret-change-me";

	const { default: app } = await import("../src/app");
	const { prisma } = await import("../src/lib/prisma");
	const server = app.listen(0);
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Could not start test server");

	const baseUrl = `http://127.0.0.1:${address.port}`;
	let companyId: string | undefined;

	const request = async (path: string, options: TestRequest = {}): Promise<TestResponse> =>
		new Promise((resolve, reject) => {
			const clientRequest = http.request(`${baseUrl}${path}`, {
				method: options.method ?? "GET",
				headers: options.headers,
			}, (response) => {
				let rawBody = "";
				response.setEncoding("utf8");
				response.on("data", (chunk) => { rawBody += chunk; });
				response.on("end", () => resolve({
					response: { status: response.statusCode ?? 500 },
					body: JSON.parse(rawBody) as Record<string, any>,
				}));
			});
			clientRequest.on("error", reject);
			if (options.body) clientRequest.write(options.body);
			clientRequest.end();
		});

	const json = (value: unknown): TestRequest => ({
		headers: { "content-type": "application/json" },
		body: JSON.stringify(value),
	});
	const withToken = (token: string, options: TestRequest = {}): TestRequest => ({
		...options,
		headers: { ...(options.headers ?? {}), authorization: `Bearer ${token}` },
	});

	try {
		const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
		const adminEmail = `admin-${suffix}@example.test`;
		const userEmail = `cashier-${suffix}@example.test`;
		let adminToken = "";
		let refreshToken = "";
		let userId = "";

		assert.equal((await request("/api/auth/me")).response.status, 401);
		assert.equal((await request("/api/auth/register", { method: "POST", ...json({}) })).response.status, 400);

		const registered = await request("/api/auth/register", { method: "POST", ...json({
			company: { name: `Module Test Store ${suffix}`, email: `store-${suffix}@example.test` },
			admin: { fullName: "Module Test Admin", email: adminEmail, password: "StrongPassword123" },
		}) });
		assert.equal(registered.response.status, 201);
		companyId = registered.body.data.company.id;
		adminToken = registered.body.data.accessToken;
		refreshToken = registered.body.data.refreshToken;
		assert.equal(registered.body.data.user.roleName, "Admin");
		assert.equal(registered.body.data.user.passwordHash, undefined);
		assert.equal(registered.body.data.company.takealotApiKey, undefined);

		assert.equal((await request("/api/auth/login", { method: "POST", ...json({ companyId, email: adminEmail, password: "wrong-password" }) })).response.status, 401);
		const login = await request("/api/auth/login", { method: "POST", ...json({ companyId, email: adminEmail, password: "StrongPassword123" }) });
		assert.equal(login.response.status, 200);
		adminToken = login.body.data.accessToken;
		refreshToken = login.body.data.refreshToken;

		const me = await request("/api/auth/me", withToken(adminToken));
		assert.equal(me.response.status, 200);
		assert.equal(me.body.data.user.email, adminEmail);
		assert.equal(me.body.data.company.id, companyId);
		assert.equal((await request("/api/company", withToken(adminToken))).response.status, 200);

		const updatedCompany = await request("/api/company", withToken(adminToken, {
			method: "PATCH",
			...json({ name: "Updated Module Test Store", takealotApiKey: "do-not-return-this" }),
		}));
		assert.equal(updatedCompany.response.status, 200);
		assert.equal(updatedCompany.body.data.takealotApiKey, undefined);
		assert.equal(updatedCompany.body.data.takealotConfigured, true);

		const accesses = await request("/api/company/accesses", withToken(adminToken));
		assert.equal(accesses.response.status, 200);
		assert.ok(accesses.body.data.includes("USERS_ROLES"));

		const createdUser = await request("/api/company/users", withToken(adminToken, {
			method: "POST",
			...json({ fullName: "Module Test Cashier", email: userEmail, password: "StrongPassword123", roleName: "Cashier", accesses: ["POS", "CUSTOMERS", "INVOICES"] }),
		}));
		assert.equal(createdUser.response.status, 201);
		userId = createdUser.body.data.id;
		assert.equal(createdUser.body.data.passwordHash, undefined);

		const users = await request("/api/company/users?page=1&limit=20", withToken(adminToken));
		assert.equal(users.response.status, 200);
		assert.ok(users.body.data.items.some((user: { id: string }) => user.id === userId));

		const updatedUser = await request(`/api/company/users/${userId}`, withToken(adminToken, {
			method: "PATCH",
			...json({ accesses: ["POS"] }),
		}));
		assert.equal(updatedUser.response.status, 200);
		assert.deepEqual(updatedUser.body.data.accesses, ["POS"]);

		const refreshed = await request("/api/auth/refresh", { method: "POST", ...json({ refreshToken }) });
		assert.equal(refreshed.response.status, 200);
		refreshToken = refreshed.body.data.refreshToken;

		const changedPassword = await request("/api/auth/change-password", withToken(adminToken, {
			method: "PATCH",
			...json({ currentPassword: "StrongPassword123", newPassword: "NewStrongPassword123" }),
		}));
		assert.equal(changedPassword.response.status, 200);

		const forgotPasswordResponse = await request("/api/auth/forgot-password", {
			method: "POST",
			...json({ email: adminEmail }),
		});
		assert.equal(forgotPasswordResponse.response.status, 200);

		assert.equal((await request(`/api/company/users/${userId}`, withToken(adminToken, { method: "DELETE" }))).response.status, 200);
		assert.equal((await request("/api/auth/logout", withToken(adminToken, { method: "POST", ...json({ refreshToken }) }))).response.status, 200);
		assert.equal((await request("/api/auth/refresh", { method: "POST", ...json({ refreshToken }) })).response.status, 401);

		console.log("AUTH_COMPANY_MODULE_TESTS_PASSED");
	} finally {
		if (companyId) {
			await prisma.auditLog.deleteMany({ where: { companyId } });
			await prisma.session.deleteMany({ where: { user: { companyId } } });
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
