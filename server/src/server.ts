import "dotenv/config";

import app from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";

const server = app.listen(env.port, () => {
	logger.info(`Server listening on port ${env.port}`);
});

const shutdown = async (signal: string): Promise<void> => {
	logger.info(`Received ${signal}; shutting down`);
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
