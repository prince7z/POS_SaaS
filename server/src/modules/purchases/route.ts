import { Access } from "@prisma/client";
import { Router } from "express";

import { requireAccess } from "../../middleware/access";
import { requireAuth } from "../../middleware/auth";
import { sendMessage, sendSuccess } from "../../utils/apiResponse";
import { unauthorized, validationError } from "../../utils/errors";
import * as service from "./service";

const router = Router();

const authContext = (request: import("express").Request) => {
	if (!request.auth) throw unauthorized();
	return request.auth;
};

const idFrom = (request: import("express").Request) => {
	const id = request.params.id;
	if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw validationError("Invalid purchase id");
	return id;
};

const supplierIdFrom = (request: import("express").Request) => {
	const id = request.params.id;
	if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw validationError("Invalid supplier id");
	return id;
};

const purchaseAccess = [requireAuth, requireAccess(Access.PURCHASES)] as const;
const supplierAccess = [requireAuth, requireAccess(Access.SUPPLIERS)] as const;

router.get("/suppliers", ...supplierAccess, async (request, response) => {
	return sendSuccess(response, await service.listSuppliers(authContext(request).companyId, service.parse(service.supplierListSchema, request.query)));
});

router.get("/suppliers/:id", ...supplierAccess, async (request, response) => {
	return sendSuccess(response, await service.getSupplier(authContext(request).companyId, supplierIdFrom(request)));
});

router.post("/suppliers", ...supplierAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.createSupplier(auth.companyId, auth.userId, service.parse(service.supplierSchema, request.body)), 201);
});

router.patch("/suppliers/:id", ...supplierAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.updateSupplier(auth.companyId, auth.userId, supplierIdFrom(request), service.parse(service.supplierUpdateSchema, request.body)));
});

router.delete("/suppliers/:id", ...supplierAccess, async (request, response) => {
	const auth = authContext(request);
	await service.deleteSupplier(auth.companyId, auth.userId, supplierIdFrom(request));
	return sendMessage(response, "Supplier deleted successfully");
});

router.get("/:id/payments", ...purchaseAccess, async (request, response) => {
	return sendSuccess(response, await service.listSupplierPayments(authContext(request).companyId, idFrom(request), service.parse(service.paymentListSchema, request.query)));
});

router.post("/:id/payments", ...purchaseAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.recordSupplierPayment(auth.companyId, auth.userId, idFrom(request), service.parse(service.supplierPaymentSchema, request.body)), 201);
});

router.post("/:id/receive", ...purchaseAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.receivePurchaseOrder(auth.companyId, auth.userId, idFrom(request), service.parse(service.receivePurchaseSchema, request.body)));
});

router.post("/:id/cancel", ...purchaseAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.cancelPurchaseOrder(auth.companyId, auth.userId, idFrom(request)));
});

router.post("/", ...purchaseAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.createPurchaseOrder(auth.companyId, auth.userId, service.parse(service.purchaseCreateSchema, request.body)), 201);
});

router.patch("/:id", ...purchaseAccess, async (request, response) => {
	const auth = authContext(request);
	return sendSuccess(response, await service.updatePurchaseOrder(auth.companyId, auth.userId, idFrom(request), service.parse(service.purchaseUpdateSchema, request.body)));
});

router.get("/", ...purchaseAccess, async (request, response) => {
	return sendSuccess(response, await service.listPurchaseOrders(authContext(request).companyId, service.parse(service.purchaseListSchema, request.query)));
});

router.get("/:id", ...purchaseAccess, async (request, response) => {
	return sendSuccess(response, await service.getPurchaseOrder(authContext(request).companyId, idFrom(request)));
});

export default router;
