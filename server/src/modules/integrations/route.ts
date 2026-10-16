import { Access } from "@prisma/client";
import { Router, type Request } from "express";

import { requireAccess } from "../../middleware/access";
import { requireAuth } from "../../middleware/auth";
import { sendMessage, sendSuccess } from "../../utils/apiResponse";
import { unauthorized } from "../../utils/errors";
import * as service from "./service";

const router = Router();

const authFrom = (request: Request) => {
  if (!request.auth) throw unauthorized();
  return request.auth;
};

router.get("/", requireAuth, requireAccess(Access.SETTINGS, Access.TAKEALOT, Access.PRODUCTS), async (request, response) => {
  return sendSuccess(response, await service.listIntegrations(authFrom(request).companyId));
});

router.post("/", requireAuth, requireAccess(Access.SETTINGS), async (request, response) => {
  const auth = authFrom(request);
  const input = service.parse(service.createIntegrationSchema, request.body);
  return sendSuccess(response, await service.createIntegration(auth.companyId, input), 201);
});

router.get("/:id", requireAuth, requireAccess(Access.SETTINGS, Access.TAKEALOT), async (request, response) => {
  return sendSuccess(
    response,
    await service.getIntegration(authFrom(request).companyId, service.parseIntegrationId(request.params.id)),
  );
});

router.patch("/:id", requireAuth, requireAccess(Access.SETTINGS), async (request, response) => {
  const auth = authFrom(request);
  const input = service.parse(service.updateIntegrationSchema, request.body);
  return sendSuccess(
    response,
    await service.updateIntegration(auth.companyId, service.parseIntegrationId(request.params.id), input),
  );
});

router.delete("/:id", requireAuth, requireAccess(Access.SETTINGS), async (request, response) => {
  await service.deleteIntegration(authFrom(request).companyId, service.parseIntegrationId(request.params.id));
  return sendMessage(response, "Integration removed successfully");
});

router.post("/:id/test", requireAuth, requireAccess(Access.SETTINGS), async (request, response) => {
  return sendSuccess(
    response,
    await service.testTakealotIntegration(authFrom(request).companyId, service.parseIntegrationId(request.params.id)),
  );
});

export default router;
