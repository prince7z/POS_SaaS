import { Worker } from "bullmq";
import { createBullMqConnection } from "../../../infrastructure/redis";
import { logger } from "../../../lib/logger";
import { env } from "../../../config/env";
import { EMAIL_QUEUE_NAME } from "../notification.constants";
import { parseEmailJob } from "./email.job";
import { emailProvider } from "../providers/brevo.provider";
import { EmailType } from "../notification.types";
import { renderTemplate } from "../templates/template.renderer";

export const createEmailWorker = () => {
	const worker = new Worker(EMAIL_QUEUE_NAME, async (job) => {
	const payload = parseEmailJob(job.data);
	logger.info("Email job started", JSON.stringify({ jobId: job.id, emailType: payload.type, companyId: payload.companyId }));
	const template = payload.type === EmailType.PASSWORD_RESET
		? renderTemplate(payload.type, { name: payload.recipient.name, resetUrl: `${env.frontendUrl}/auth/forgot-password/${payload.data.resetToken}` })
		: renderTemplate(payload.type, { name: payload.recipient.name, invoiceNumber: payload.data.invoiceNumber });
	await emailProvider.send({ to: payload.recipient.email, toName: payload.recipient.name, ...template });
	logger.info("Email sent", JSON.stringify({ jobId: job.id, emailType: payload.type }));
	}, { connection: createBullMqConnection() });
	worker.on("failed", (job, error) => {
		logger.error("Email job failed", JSON.stringify({ jobId: job?.id, emailType: job?.data.type, error: error.message }));
	});
	return worker;
};
