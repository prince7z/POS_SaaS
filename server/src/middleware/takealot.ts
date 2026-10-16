import type { RequestHandler } from "express";

import { unauthorized } from "../utils/errors";
import { getTakealotApiKey as loadApiKey, parseIntegrationId } from "../modules/integrations/service";

export const getTakealotApiKey = loadApiKey;

export const requireTakealotApiKey: RequestHandler = async (request, _response, next) => {
	try {
		const auth = request.auth;
		if (!auth) throw unauthorized();
		const integrationId = parseIntegrationId(request.params.integrationId);
		request.takealotApiKey = await getTakealotApiKey(auth.companyId, integrationId);
		next();
	} catch (error) {
		next(error);
	}
};
