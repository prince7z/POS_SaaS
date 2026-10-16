import "dotenv/config";

import app from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { redisClient } from "./infrastructure/redis";
import { emailQueue } from "./modules/notification/queue/email.queue";
import { createEmailWorker } from "./modules/notification/queue/email.worker";
import { closeTakealotSyncQueue } from "./modules/takealot/sync.queue";
import { createTakealotSyncWorker } from "./modules/takealot/sync.worker";

const emailWorker = createEmailWorker();
const takealotSyncWorker = createTakealotSyncWorker();
logger.info("Email worker started alongside HTTP server");
logger.info("Takealot offer synchronization worker started alongside HTTP server");

const server = app.listen(env.port, () => {
	logger.info(`Server listening on port ${env.port}`);
});

const shutdown = async (signal: string): Promise<void> => {
	logger.info(`Received ${signal}; shutting down`);
	try {
		await emailWorker.close();
		await takealotSyncWorker.close();
		await emailQueue.close();
		await closeTakealotSyncQueue();
		await redisClient.quit();
	} catch (error) {
		logger.error("Error closing workers during shutdown", error);
	}
	server.close(async () => {
		await prisma.$disconnect();
		process.exit(0);
	});
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("uncaughtException", (error) => {
	logger.error("Uncaught exception", error);
	void shutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
	logger.error("Unhandled rejection", reason);
	void shutdown("unhandledRejection");
});
