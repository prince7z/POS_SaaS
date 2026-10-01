import { Access } from "@prisma/client";
import { Router } from "express";

import { requireAccess } from "../../middleware/access";
import { requireAuth } from "../../middleware/auth";
import { sendSuccess } from "../../utils/apiResponse";
import { unauthorized } from "../../utils/errors";
import * as service from "./service";

const router = Router();
const auth = (request: import("express").Request) => {
	if (!request.auth) throw unauthorized();
	return request.auth;
};
const filters = (request: import("express").Request) => service.parse(service.dashboardSchema, request.query);
const pages = (request: import("express").Request) => service.parse(service.pageSchema, request.query);
const csvResponse = (response: import("express").Response, name: string, data: unknown) => {
	response.type("text/csv").attachment(name).send(service.csv(Array.isArray(data) ? data as Array<Record<string, unknown>> : []));
};

router.get("/sales", requireAuth, requireAccess(Access.REPORT_SALES), async (req, res) => sendSuccess(res, await service.salesDashboard(auth(req).companyId, filters(req))));
router.get("/sales/transactions", requireAuth, requireAccess(Access.REPORT_SALES), async (req, res) => sendSuccess(res, await service.salesTransactions(auth(req).companyId, pages(req))));
router.get("/sales/export", requireAuth, requireAccess(Access.REPORT_SALES), async (req, res) => csvResponse(res, "sales.csv", (await service.salesTransactions(auth(req).companyId, pages(req))).items));

router.get("/inventory-customer", requireAuth, requireAccess(Access.REPORT_INVENTORY_CUSTOMER), async (req, res) => sendSuccess(res, await service.inventoryDashboard(auth(req).companyId, filters(req))));
router.get("/inventory-customer/low-stock", requireAuth, requireAccess(Access.REPORT_INVENTORY_CUSTOMER), async (req, res) => sendSuccess(res, await service.lowStockItems(auth(req).companyId, pages(req))));
router.get("/inventory-customer/top-customers", requireAuth, requireAccess(Access.REPORT_INVENTORY_CUSTOMER), async (req, res) => sendSuccess(res, { items: await service.topCustomers(auth(req).companyId, filters(req)) }));
router.get("/inventory-customer/recent-customers", requireAuth, requireAccess(Access.REPORT_INVENTORY_CUSTOMER), async (req, res) => sendSuccess(res, { items: await service.recentCustomers(auth(req).companyId, filters(req)) }));
router.get("/inventory-customer/export", requireAuth, requireAccess(Access.REPORT_INVENTORY_CUSTOMER), async (req, res) => csvResponse(res, "inventory-customer.csv", await service.lowStockItems(auth(req).companyId, pages(req)).then((x) => x.items)));

router.get("/profit-loss", requireAuth, requireAccess(Access.REPORT_PROFIT_LOSS), async (req, res) => sendSuccess(res, await service.pnlDashboard(auth(req).companyId, filters(req))));
router.get("/profit-loss/top-products", requireAuth, requireAccess(Access.REPORT_PROFIT_LOSS), async (req, res) => sendSuccess(res, { items: await service.profitableProducts(auth(req).companyId, filters(req)) }));
router.get("/profit-loss/top-expenses", requireAuth, requireAccess(Access.REPORT_PROFIT_LOSS), async (req, res) => sendSuccess(res, (await service.pnlDashboard(auth(req).companyId, filters(req))).expenseBreakdown));
router.get("/profit-loss/recent-expenses", requireAuth, requireAccess(Access.REPORT_PROFIT_LOSS), async (req, res) => sendSuccess(res, { items: await service.recentExpenses(auth(req).companyId, filters(req)) }));
router.get("/profit-loss/export", requireAuth, requireAccess(Access.REPORT_PROFIT_LOSS), async (req, res) => csvResponse(res, "profit-loss.csv", (await service.pnlDashboard(auth(req).companyId, filters(req))).expenseBreakdown));

export default router;
