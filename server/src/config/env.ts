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

const readBoolean = (name: string, fallback: boolean): boolean => {
	const value = readOptional(name);
	if (value === undefined) return fallback;
	return value.toLowerCase() === "true";
};

const readPort = (): number => {
	const port = Number(readOptional("PORT") ?? "3000");

	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error("PORT must be an integer between 1 and 65535");
	}

	return port;
};

const nodeEnv = readOptional("NODE_ENV") ?? "development";

const awsEndpoint = readOptional("AWS_ENDPOINT_URL_S3");
const awsBucket = readOptional("AWS_S3_BUCKET") ?? readOptional("BUCKET_NAME");
const awsPublicBaseUrl = readOptional("AWS_S3_PUBLIC_BASE_URL") ?? (
	awsEndpoint && awsBucket
		? `${awsEndpoint.replace(/\/$/, "")}/${awsBucket}`
		: awsEndpoint
			? awsEndpoint.replace(/\/$/, "")
			: undefined
);

export const env = {
	port: readPort(),
	nodeEnv,
	testAuthBypass: readBoolean("TEST_AUTH_BYPASS", false),
	databaseUrl: readRequired("PSQL"),
	jwtSecret: readRequired("JWT_SECRET"),
	accessTokenTtl: readOptional("ACCESS_TOKEN_TTL") ?? "15m",
	refreshTokenTtlDays: Number(readOptional("REFRESH_TOKEN_TTL_DAYS") ?? "30"),
	mockBaseUrl: readOptional("MOCK_BASE_URL") ?? readOptional("MOCK_BASE") ?? "https://images.unsplash.com",
	aws: {
		region: readOptional("AWS_REGION") ?? "us-east-2",
		accessKeyId: readOptional("AWS_ACCESS_KEY_ID"),
		secretAccessKey: readOptional("AWS_SECRET_ACCESS_KEY"),
		sessionToken: readOptional("AWS_SESSION_TOKEN"),
		endpoint: awsEndpoint,
		bucket: awsBucket,
		publicBaseUrl: awsPublicBaseUrl,
	},
	redis: {
		url: readOptional("REDIS_URL") ?? "redis://localhost:6379",
	},
	brevo: {
		apiKey: readOptional("BREVO_API_KEY"),
	},
	email: {
		from: readOptional("EMAIL_FROM") ?? "no-reply@localhost",
	},
	frontendUrl: readOptional("FRONTEND_URL") ?? "http://localhost:5173",
	displayPerf: readBoolean("DISPLAY_PERF", false),
	agent: {
		openRouterApiKey: readOptional("OPENROUTER_API_KEY"),
		model: readOptional("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini",
		siteUrl: readOptional("OPENROUTER_SITE_URL") ?? "http://localhost:5173",
		siteName: readOptional("OPENROUTER_SITE_NAME") ?? "POS SaaS",
	},
} as const;
