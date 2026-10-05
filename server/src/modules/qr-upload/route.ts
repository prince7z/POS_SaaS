import { Router } from "express";

import { requireAuth } from "../../middleware/auth";
import { sendSuccess } from "../../utils/apiResponse";
import {
	completeSession,
	createQrSession,
	deleteMediaKey,
	deleteQrSession,
	getSessionInfo,
	getStatus,
	requestPresignedUrls,
} from "./service";

const router = Router();

const authContext = (request: import("express").Request) => {
	const auth = request.auth;
	if (!auth) throw new Error("Authentication missing");
	return auth;
};

router.post("/session", requireAuth, async (request, response, next) => {
	try {
		const auth = authContext(request);
		const { purpose } = request.body || {};
		const session = await createQrSession(auth.companyId, auth.userId, purpose);
		return sendSuccess(response, session, 201);
	} catch (error) {
		next(error);
	}
});

router.get("/:token/session", async (request, response, next) => {
	try {
		const { token } = request.params;
		const info = await getSessionInfo(token);
		return sendSuccess(response, info);
	} catch (error) {
		next(error);
	}
});

router.post("/:token/presign", async (request, response, next) => {
	try {
		const { token } = request.params;
		const { files } = request.body || {};
		const result = await requestPresignedUrls(token, files);
		return sendSuccess(response, result);
	} catch (error) {
		next(error);
	}
});

router.post("/:token/complete", async (request, response, next) => {
	try {
		const { token } = request.params;
		const { keys } = request.body || {};
		const result = await completeSession(token, keys);
		return sendSuccess(response, result);
	} catch (error) {
		next(error);
	}
});

router.get("/:token/status", async (request, response, next) => {
	try {
		const { token } = request.params;
		const statusResult = await getStatus(token);
		return sendSuccess(response, statusResult);
	} catch (error) {
		next(error);
	}
});

router.delete("/:token", async (request, response, next) => {
	try {
		const { token } = request.params;
		await deleteQrSession(token);
		return sendSuccess(response, { success: true });
	} catch (error) {
		next(error);
	}
});

router.post("/delete-media", requireAuth, async (request, response, next) => {
	try {
		const auth = authContext(request);
		const { key } = request.body || {};
		const result = await deleteMediaKey(auth.companyId, key);
		return sendSuccess(response, result);
	} catch (error) {
		next(error);
	}
});

export default router;
