import "dotenv/config";
import assert from "node:assert/strict";

const TEST_COMPANY_ID = "a2b8e672-7f09-4783-81ba-51a572205b71";
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const describeShape = (value: unknown, depth = 0): unknown => {
  if (depth > 5) return typeof value;
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return { type: "array", length: value.length, item: value.length ? describeShape(value[0], depth + 1) : null };
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, describeShape(child, depth + 1)]));
  }
  return typeof value;
};

type ApiBody = {
  success: boolean;
  data?: Record<string, unknown>;
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  error?: { code: string; message: string };
};

const main = async () => {
  process.env.NODE_ENV = "test";
  process.env.TEST_AUTH_BYPASS = "true";
  process.env.PSQL ??= "postgresql://postgres:postgres@127.0.0.1:5432/pos_test?schema=public";
  process.env.JWT_SECRET ??= "takealot-dashboard-test-secret";

  const { prisma } = await import("../src/lib/prisma");
  const company = await prisma.company.findFirst({
    where: { id: TEST_COMPANY_ID, deletedAt: null },
    select: { id: true },
  });
  assert.ok(company, "The provided Takealot test company must exist.");

  const integrations = await prisma.integration.findMany({
    where: { companyId: TEST_COMPANY_ID, type: "TAKEALOT", isActive: true },
    select: { id: true, credentials: true },
  });
  assert.equal(integrations.length, 1, "The company must have exactly one active Takealot integration.");
  const integration = integrations[0];
  const credentials = integration.credentials;
  assert.ok(
    typeof credentials === "object" && credentials !== null && "apiKey" in credentials &&
      typeof credentials.apiKey === "string" && credentials.apiKey.length > 0,
    "The migrated integration must have a configured API key.",
  );
  const previousSync = await prisma.takealotSyncState.findUnique({
    where: { integrationId: integration.id },
    select: { status: true, lastSuccessfulSyncAt: true },
  });
  const hasFreshSync = previousSync?.status === "SUCCEEDED" &&
    previousSync.lastSuccessfulSyncAt !== null &&
    Date.now() - previousSync.lastSuccessfulSyncAt.getTime() < 24 * 60 * 60 * 1000;
  const shouldRunSync = process.env.TAKEALOT_FORCE_SYNC === "true" || !hasFreshSync;
  const { getTakealotApiKey } = await import("../src/modules/integrations/service");
  const { takealotApi } = await import("../src/modules/takealot/takealot-api");
  const { takealotClient } = await import("../src/integrations/takealot/client");
  const apiKey = await getTakealotApiKey(TEST_COMPANY_ID, integration.id);
  const rawOffers = await takealotClient.request<unknown>(apiKey, "/v2/offers", { page_number: 1, page_size: 100 });
  console.log(`Observed /v2/offers response structure: ${JSON.stringify(describeShape(rawOffers))}`);
  const rawOfferList = typeof rawOffers === "object" && rawOffers !== null && "offers" in rawOffers
    ? (rawOffers as { offers?: unknown }).offers
    : undefined;
  if (Array.isArray(rawOfferList)) {
    const shapes = new Map<string, number>();
    for (const candidate of rawOfferList) {
      if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate) || !("total_excess_takealot_stock" in candidate)) continue;
      const value = (candidate as Record<string, unknown>).total_excess_takealot_stock;
      const shape = value === null
        ? { type: "null" }
        : typeof value === "object"
        ? Array.isArray(value)
          ? { type: "array", length: value.length, itemType: typeof value[0] }
          : {
              type: "object",
              fields: Object.fromEntries(Object.entries(value).map(([key, child]) => [
                key,
                typeof child === "object" && child !== null && !Array.isArray(child)
                  ? { type: "object", fields: Object.keys(child) }
                  : typeof child,
              ])),
            }
        : { type: typeof value };
      const key = JSON.stringify(shape);
      shapes.set(key, (shapes.get(key) ?? 0) + 1);
    }
    console.log(`Observed total_excess_takealot_stock structures: ${JSON.stringify([...shapes].map(([shape, count]) => ({ count, shape: JSON.parse(shape) })))}`);
  }
  await takealotApi.getOffers(apiKey, 1, 100);

  const express = (await import("express")).default;
  const { errorHandler } = await import("../src/middleware/error");
  const integrationsRouter = (await import("../src/modules/integrations/route")).default;
  const takealotRouter = (await import("../src/modules/takealot/route")).default;
  const { createTakealotSyncWorker } = await import("../src/modules/takealot/sync.worker");

  const app = express();
  app.use(express.json());
  app.use("/integrations", integrationsRouter);
  app.use("/integrations/:integrationId/takealot", takealotRouter);
  app.use(errorHandler);
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start Takealot dashboard API test server.");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const worker = shouldRunSync ? createTakealotSyncWorker() : undefined;
  const report: string[] = [];

  const request = async (path: string): Promise<{ response: Response; body: ApiBody }> => {
    const response = await fetch(`${baseUrl}${path}`);
    return { response, body: await response.json() as ApiBody };
  };

  try {
    const listed = await request("/integrations");
    assert.equal(listed.response.status, 200);
    assert.equal(listed.body.success, true);
    const integrationList = listed.body.data?.items ?? listed.body.data;
    assert.ok(Array.isArray(integrationList), "Integration list should be returned.");
    assert.ok(!JSON.stringify(listed.body).includes(String(credentials.apiKey)), "API keys must never be returned.");
    report.push("PASS integration listing and secret redaction");

    const tested = await fetch(`${baseUrl}/integrations/${integration.id}/test`, { method: "POST" });
    const testBody = await tested.json() as ApiBody;
    assert.equal(tested.status, 200, `Takealot credential test failed: ${testBody.error?.message ?? "unknown error"}`);
    assert.equal(testBody.data?.connected, true);
    report.push("PASS live Takealot integration credential check");

    let syncStatus: ApiBody["data"] | undefined;
    if (shouldRunSync) {
      const sync = await fetch(`${baseUrl}/integrations/${integration.id}/takealot/sync`, { method: "POST" });
      const syncBody = await sync.json() as ApiBody;
      assert.equal(sync.status, 202, `Sync enqueue failed: ${syncBody.error?.message ?? "unknown error"}`);
      const requestedJobId = syncBody.data?.jobId;
      const deadline = Date.now() + 30 * 1000;
      while (Date.now() < deadline) {
        await sleep(2000);
        const statusResult = await request(`/integrations/${integration.id}/takealot/sync-status`);
        assert.equal(statusResult.response.status, 200);
        syncStatus = statusResult.body.data;
        if (requestedJobId) assert.equal(syncStatus?.jobId, requestedJobId, "Status polling must not enqueue duplicate sync jobs.");
        const status = syncStatus?.status;
        if (status === "SUCCEEDED" || status === "FAILED") break;
      }
    } else {
      const statusResult = await request(`/integrations/${integration.id}/takealot/sync-status`);
      assert.equal(statusResult.response.status, 200);
      syncStatus = statusResult.body.data;
    }
    assert.equal(
      syncStatus?.status,
      "SUCCEEDED",
      `Offer synchronization ended in ${String(syncStatus?.status ?? "unknown")}: ${String(syncStatus?.errorMessage ?? "timed out")}`,
    );
    assert.ok(Number(syncStatus?.pagesProcessed) >= 1);
    assert.equal(syncStatus?.pagesProcessed, syncStatus?.totalPages);
    report.push(shouldRunSync
      ? `PASS complete paginated offer synchronization (${String(syncStatus?.offersProcessed)} offers / ${String(syncStatus?.totalPages)} pages)`
      : `PASS existing successful synchronization (${String(syncStatus?.offersProcessed)} offers / ${String(syncStatus?.totalPages)} pages)`);

    const endpoints = [
      ["overview", `/integrations/${integration.id}/takealot/dashboard/overview`],
      ["offers", `/integrations/${integration.id}/takealot/offers?page=1&pageSize=10&sortBy=title&sortOrder=asc`],
      ["inventory analytics", `/integrations/${integration.id}/takealot/analytics/inventory`],
      ["warehouse analytics", `/integrations/${integration.id}/takealot/analytics/warehouses`],
      ["pricing and reported sales", `/integrations/${integration.id}/takealot/analytics/pricing-sales`],
      ["inventory summary", `/integrations/${integration.id}/takealot/inventory/summary`],
      ["inventory snapshots", `/integrations/${integration.id}/takealot/inventory/snapshots?from=2000-01-01&to=2099-12-31&interval=day`],
      ["alerts", `/integrations/${integration.id}/takealot/alerts?page=1&pageSize=10`],
    ] as const;
    for (const [name, path] of endpoints) {
      const result = await request(path);
      assert.equal(result.response.status, 200, `${name} endpoint failed: ${result.body.error?.message ?? "unknown error"}`);
      assert.equal(result.body.success, true, `${name} endpoint did not return success.`);
      assert.ok(result.body.data, `${name} endpoint returned no data.`);
      report.push(`PASS ${name} endpoint`);
    }

    const invalidFilter = await request(`/integrations/${integration.id}/takealot/offers?pageSize=101`);
    assert.equal(invalidFilter.response.status, 400, "Invalid offer pagination should be rejected.");
    report.push("PASS offers input validation");

    const foreignIntegration = await request("/integrations/00000000-0000-4000-8000-000000000000/takealot/dashboard/overview");
    assert.equal(foreignIntegration.response.status, 404, "Unknown integration must not be accessible.");
    report.push("PASS integration ownership/not-found guard");

    console.log(report.join("\n"));
    console.log("\nTakealot dashboard API checks passed.");
  } finally {
    if (worker) await worker.close();
    const { closeTakealotSyncQueue } = await import("../src/modules/takealot/sync.queue");
    const { redisClient } = await import("../src/infrastructure/redis");
    await closeTakealotSyncQueue();
    await redisClient.quit();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
};

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error("Takealot dashboard API checks failed.");
    console.error(error);
    process.exit(1);
  },
);
