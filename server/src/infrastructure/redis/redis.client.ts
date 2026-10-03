import Redis from "ioredis";

import { logger } from "../../lib/logger";
import { redisConfig } from "./redis.config";

export const redisClient = new Redis(redisConfig.url);

redisClient.on("error", (error) => logger.error("Redis connection error", error));
redisClient.on("connect", () => logger.info("Redis connected"));

export const createBullMqConnection = () =>
	new Redis(redisConfig.url, { maxRetriesPerRequest: null });
