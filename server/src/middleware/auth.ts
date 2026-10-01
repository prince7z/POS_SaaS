import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { AppError, unauthorized } from "../utils/errors";

export const testAuth = {
	userId: "be535207-dc1d-4a47-b57a-498c4aa902dd",
	companyId: "a2b8e672-7f09-4783-81ba-51a572205b71",
} as const;

type TokenPayload = {
	sub?: unknown;
	companyId?: unknown;
};

export const requireAuth: RequestHandler = (request, _response, next) => {
	try {
		if (env.testAuthBypass) {
			request.auth = testAuth;
			next();
			return;
		}

		const header = request.header("authorization");
		if (!header?.startsWith("Bearer ")) {
			throw unauthorized();
		}

		const token = header.slice("Bearer ".length);
		const verified = jwt.verify(token, env.jwtSecret) as TokenPayload;

		if (
			typeof verified.sub !== "string" ||
			typeof verified.companyId !== "string"
		) {
			throw unauthorized();
		}

		request.auth = { userId: verified.sub, companyId: verified.companyId };
		next();
	} catch (error) {
		next(error instanceof AppError ? error : unauthorized("Invalid token"));
	}
};