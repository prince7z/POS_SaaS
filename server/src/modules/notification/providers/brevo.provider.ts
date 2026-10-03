import { env } from "../../../config/env";
import { AppError } from "../../../utils/errors";
import { logger } from "../../../lib/logger";
import { BaseEmailProvider, type SendEmailOptions } from "./email.provider";

export class BrevoEmailProvider extends BaseEmailProvider {
	async send(options: SendEmailOptions): Promise<void> {
		if (!env.brevo.apiKey) throw new AppError("Email provider is not configured", 503, "EMAIL_PROVIDER_NOT_CONFIGURED");
		const response = await fetch("https://api.brevo.com/v3/smtp/email", {
			method: "POST",
			headers: { "api-key": env.brevo.apiKey, "content-type": "application/json", accept: "application/json" },
			body: JSON.stringify({
				sender: { email: env.email.from },
				to: [{ email: options.to, ...(options.toName ? { name: options.toName } : {}) }],
				subject: options.subject,
				htmlContent: options.html,
				textContent: options.text,
				...(options.attachments ? {
					attachment: options.attachments.map((attachment) => ({
						name: attachment.filename,
						content: attachment.content.toString("base64"),
					})),
				} : {}),
			}),
		});
		if (!response.ok) {
			const detail = (await response.text()).slice(0, 500);
			logger.error("Email provider rejected message", detail);
			throw new Error(`Email provider returned ${response.status}`);
		}
	}
}

export const emailProvider = new BrevoEmailProvider();
