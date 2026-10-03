import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as controller from "./controller";

const router = Router();
router.use(requireAuth);
router.post("/conversations", controller.create);
router.get("/conversations", controller.list);
router.get("/conversations/:conversationId", controller.get);
router.post("/conversations/:conversationId/messages", controller.message);
router.post("/conversations/:conversationId/resume", controller.resume);
router.post("/runs/:runId/cancel", controller.cancel);

export default router;
