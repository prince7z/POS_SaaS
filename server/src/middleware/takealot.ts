import type { RequestHandler } from "express";

import { prisma } from "../lib/prisma";
import { AppError, unauthorized } from "../utils/errors";
import { testAuth } from "./auth";

export const getTakealotApiKey = async (companyId: string): Promise<string> => {
	if (process.env.NODE_ENV === "test" && companyId === testAuth.companyId) {
		return "test-api-key";
	}

	const company = await prisma.company.findFirst({
		where: { id: companyId, deletedAt: null },
		select: { takealotApiKey: true },
	});
	if (!company?.takealotApiKey) {
		throw new AppError("Takealot API key is not configured. Add it in Company Settings to use Takealot reporting.", 422, "TAKEALOT_API_NOT_CONFIGURED");
	}
	return company.takealotApiKey;
};

export const requireTakealotApiKey: RequestHandler = async (request, _response, next) => {
	try {
		const companyId = request.auth?.companyId;
		if (!companyId) throw unauthorized();
		request.takealotApiKey = await getTakealotApiKey(companyId);
		next();
	} catch (error) {
		next(error);
	}
};
