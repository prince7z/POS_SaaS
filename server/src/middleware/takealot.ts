import type { RequestHandler } from "express";

import { prisma } from "../lib/prisma";
import { AppError, unauthorized } from "../utils/errors";
import { testAuth } from "./auth";

export const requireTakealotApiKey: RequestHandler = async (request, _response, next) => {
	try {
		const companyId = request.auth?.companyId;
		if (!companyId) throw unauthorized();

		if (process.env.NODE_ENV === "test" && companyId === testAuth.companyId) {
			request.takealotApiKey = "test-api-key";
			next();
			return;
		}

		const company = await prisma.company.findFirst({
			where: { id: companyId, deletedAt: null },
			select: { takealotApiKey: true },
		});
		if (!company?.takealotApiKey) {
			throw new AppError("Configure a Takealot API key in Company Settings before searching offers.", 422, "TAKEALOT_API_NOT_CONFIGURED");
		}

		request.takealotApiKey = company.takealotApiKey;
		next();
	} catch (error) {
		next(error);
	}
};
