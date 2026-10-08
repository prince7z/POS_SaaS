import type { RequestHandler } from "express";
import { Access } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { forbidden, unauthorized } from "../utils/errors";
import { testAuth } from "./auth";

export const requireAccess = (access: Access): RequestHandler => async (
	request,
	_response,
	next,
) => {
	try {
		if (env.testAuthBypass) {
			request.auth = testAuth;
			request.authenticatedUser = {
				id: testAuth.userId,
				companyId: testAuth.companyId,
				accesses: Object.values(Access),
			};
			next();
			return;
		}

		if (!request.auth) {
			throw unauthorized();
		}

		const companyUser = await prisma.companyUser.findFirst({
			where: {
				userId: request.auth.userId,
				companyId: request.auth.companyId,
				isActive: true,
				deletedAt: null,
			},
			select: { userId: true, companyId: true, accesses: true },
		});

		if (!companyUser) {
			throw unauthorized("User is inactive or no longer exists in this company");
		}
		if (!companyUser.accesses.includes(access)) {
			throw forbidden();
		}

		request.authenticatedUser = {
			id: companyUser.userId,
			companyId: companyUser.companyId,
			accesses: companyUser.accesses,
		};
		next();
	} catch (error) {
		next(error);
	}
};