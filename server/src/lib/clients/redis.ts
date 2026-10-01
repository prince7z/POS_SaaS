import { createClient } from "redis";

import { env } from "../../config/env";

export const redisClient = createClient({
	url: env.redis.url,
});

redisClient.on("error", (error) => {
	console.error("Redis client error", error);
});

export const connectRedis = async () => {
	if (!redisClient.isOpen) {
		await redisClient.connect();
	}

	return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
	if (redisClient.isOpen) {
		await redisClient.quit();
	}
};
