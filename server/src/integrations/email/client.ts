import { BrevoClient } from "@getbrevo/brevo";

import { env } from "../../config/env";

export const emailClient = new BrevoClient({
	apiKey: env.brevo.apiKey ?? "",
});