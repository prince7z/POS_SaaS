import "dotenv/config";

const readOptional = (name: string): string | undefined => {
	const value = process.env[name]?.trim();
	return value || undefined;
};

const readRequired = (name: string): string => {
	const value = readOptional(name);

	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}

	return value;
};

const readPort = (): number => {
	const port = Number(readOptional("PORT") ?? "3000");

	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error("PORT must be an integer between 1 and 65535");
	}

	return port;
};

export const env = {
	port: readPort(),
	nodeEnv: readOptional("NODE_ENV") ?? "development",
	databaseUrl: readRequired("PSQL"),
	aws: {
		region: readOptional("AWS_REGION") ?? "us-east-2",
		accessKeyId: readOptional("AWS_ACCESS_KEY_ID"),
		secretAccessKey: readOptional("AWS_SECRET_ACCESS_KEY"),
		sessionToken: readOptional("AWS_SESSION_TOKEN"),
		endpoint: readOptional("AWS_ENDPOINT_URL_S3"),
		bucket: readOptional("AWS_S3_BUCKET"),
	},
	redis: {
		url: readOptional("REDIS_URL") ?? "redis://localhost:6379",
	},
	brevo: {
		apiKey: readOptional("BREVO_API_KEY"),
	},
} as const;
