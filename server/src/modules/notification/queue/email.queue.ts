import { Queue } from "bullmq";
import { createBullMqConnection } from "../../../infrastructure/redis";
import { logger } from "../../../lib/logger";
import { EMAIL_QUEUE_NAME } from "../notification.constants";
import type { EmailJob } from "../notification.types";

export const emailQueue = new Queue<EmailJob>(EMAIL_QUEUE_NAME, {
	connection: createBullMqConnection(),
	defaultJobOptions: {
		attempts: 3,
		backoff: { type: "exponential", delay: 5000 },
		removeOnComplete: { age: 3600, count: 1000 },
		removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
	},
});

export const enqueueEmail = async (job: EmailJob) => {
	const queued = await emailQueue.add("send-email", job);
	logger.info("Email job queued", JSON.stringify({ jobId: queued.id, emailType: job.type, companyId: job.companyId }));
	return queued;
};
