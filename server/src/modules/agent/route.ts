import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as controller from "./controller";

const router = Router();
router.use(requireAuth);

// Canonical Agent routes
router.post("/stream", controller.stream);
router.post("/respond", controller.respond);

// Conversation management routes
router.post("/conversations", controller.create);
router.get("/conversations", controller.list);
router.get("/conversations/:conversationId", controller.get);

// Backward-compatibility aliases
router.post("/conversations/:conversationId/messages", controller.message);
router.post("/conversations/:conversationId/resume", controller.resume);

// Run management
router.post("/runs/:runId/cancel", controller.cancel);

export default router;
