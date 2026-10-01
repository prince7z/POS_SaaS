import "dotenv/config";

const readRequired = (name: string): string => {
	const value = process.env[name]?.trim();

	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}

	return value;
};

const readOptional = (name: string): string | undefined => {
	const value = process.env[name]?.trim();
	return value || undefined;
};

export const env = {
	aws: {
		region: readRequired("AWS_REGION"),
		accessKeyId: readRequired("AWS_ACCESS_KEY_ID"),
		secretAccessKey: readRequired("AWS_SECRET_ACCESS_KEY"),
		sessionToken: readOptional("AWS_SESSION_TOKEN"),
		endpoint: readOptional("AWS_ENDPOINT_URL_S3"),
		bucket: readRequired("AWS_S3_BUCKET"),
	},
	redis: {
		url: readRequired("REDIS_URL"),
	},
} as const;
