import "dotenv/config";
import { createEmailWorker } from "../src/modules/notification/queue/email.worker";
import { logger } from "../src/lib/logger";

const worker = createEmailWorker();
logger.info("Email worker listening");
const shutdown = async () => {
	await worker.close();
	process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
