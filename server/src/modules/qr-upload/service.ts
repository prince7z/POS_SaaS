import crypto from "node:crypto";
import { z } from "zod";

import { RedisKeys, redisClient } from "../../infrastructure/redis";
import { createStagedMediaUploadUrls, toPublicMediaUrl, type MediaResource } from "../../integrations/aws/media";
import { mediaError, validationError } from "../../utils/errors";

export const QrPurposeEnum = z.enum([
	"PRODUCT_IMAGE",
	"CATEGORY_IMAGE",
	"BRAND_LOGO",
	"CUSTOMER_PROFILE",
	"COMPANY_LOGO",
]);

export type QrUploadPurpose = z.infer<typeof QrPurposeEnum>;

export interface QrSessionData {
	companyId: string;
	userId: string;
	purpose: QrUploadPurpose;
	status: "PENDING" | "UPLOADED";
	keys: string[];
	expiresAt: string;
}

const SESSION_TTL_SECONDS = 900; // 15 minutes

const hashToken = (rawToken: string): string =>
	crypto.createHash("sha256").update(rawToken).digest("hex");

const getSessionFromRedis = async (rawToken: string): Promise<{ session: QrSessionData; key: string } | null> => {
	const tokenHash = hashToken(rawToken);
	const redisKey = RedisKeys.qrUploadSession(tokenHash);
	const rawData = await redisClient.get(redisKey);
	if (!rawData) return null;
	try {
		const session = JSON.parse(rawData) as QrSessionData;
		if (new Date(session.expiresAt).getTime() < Date.now()) {
			await redisClient.del(redisKey);
			return null;
		}
		return { session, key: redisKey };
	} catch {
		await redisClient.del(redisKey);
		return null;
	}
};

const purposeToResourceMap: Record<QrUploadPurpose, MediaResource> = {
	PRODUCT_IMAGE: "PRODUCT_IMAGE",
	CATEGORY_IMAGE: "CATEGORY_LOGO",
	BRAND_LOGO: "BRAND_LOGO",
	CUSTOMER_PROFILE: "CUSTOMER_PROFILE",
	COMPANY_LOGO: "COMPANY_LOGO",
};

export const createQrSession = async (companyId: string, userId: string, purposeInput: string) => {
	const parsed = QrPurposeEnum.safeParse(purposeInput);
	if (!parsed.success) {
		throw validationError("Invalid QR upload purpose");
	}
	const purpose = parsed.data;

	const rawToken = crypto.randomBytes(32).toString("hex");
	const tokenHash = hashToken(rawToken);
	const redisKey = RedisKeys.qrUploadSession(tokenHash);

	const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
	const sessionData: QrSessionData = {
		companyId,
		userId,
		purpose,
		status: "PENDING",
		keys: [],
		expiresAt,
	};

	await redisClient.set(redisKey, JSON.stringify(sessionData), "EX", SESSION_TTL_SECONDS);

	return {
		token: rawToken,
		purpose,
		expiresAt,
		isMultiple: purpose === "PRODUCT_IMAGE",
	};
};

export const getSessionInfo = async (rawToken: string) => {
	const result = await getSessionFromRedis(rawToken);
	if (!result) {
		throw mediaError("QR_SESSION_EXPIRED", "QR upload session has expired or is invalid", 404);
	}
	const { session } = result;
	return {
		purpose: session.purpose,
		status: session.status,
		expiresAt: session.expiresAt,
		isMultiple: session.purpose === "PRODUCT_IMAGE",
	};
};

export const requestPresignedUrls = async (
	rawToken: string,
	files: Array<{ contentType: string; size?: number }>,
) => {
	const result = await getSessionFromRedis(rawToken);
	if (!result) {
		throw mediaError("QR_SESSION_EXPIRED", "QR upload session has expired or is invalid", 404);
	}
	const { session } = result;

	if (session.status !== "PENDING") {
		throw mediaError("QR_SESSION_ALREADY_UPLOADED", "Session has already been completed", 400);
	}

	if (!Array.isArray(files) || files.length === 0) {
		throw validationError("At least one file must be specified");
	}

	const maxCount = session.purpose === "PRODUCT_IMAGE" ? 10 : 1;
	if (files.length > maxCount) {
		throw validationError(`Maximum ${maxCount} file(s) allowed for purpose ${session.purpose}`);
	}

	const allowedContentTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
	const maxFileSize = 10 * 1024 * 1024; // 10MB

	for (const file of files) {
		if (!file.contentType || !allowedContentTypes.includes(file.contentType.toLowerCase())) {
			throw validationError(`Unsupported image type: ${file.contentType}`);
		}
		if (file.size && file.size > maxFileSize) {
			throw validationError("File size exceeds maximum allowed 10MB limit");
		}
	}

	const resource = purposeToResourceMap[session.purpose];
	const contentTypes = files.map((f) => f.contentType.toLowerCase());

	const uploads = await createStagedMediaUploadUrls({
		companyId: session.companyId,
		resource,
		contentTypes,
	});

	return { files: uploads };
};

export const completeSession = async (rawToken: string, keys: string[]) => {
	const result = await getSessionFromRedis(rawToken);
	if (!result) {
		throw mediaError("QR_SESSION_EXPIRED", "QR upload session has expired or is invalid", 404);
	}
	const { session, key: redisKey } = result;

	if (!Array.isArray(keys) || keys.length === 0) {
		throw validationError("At least one S3 key is required to complete session");
	}

	const expectedPrefix = `companies/${session.companyId}/pending/`;
	for (const key of keys) {
		if (typeof key !== "string" || !key.startsWith(expectedPrefix) || key.includes("..")) {
			throw validationError(`Invalid key structure or unauthorized path: ${key}`);
		}
	}

	session.status = "UPLOADED";
	session.keys = keys;

	const remainingTtl = Math.max(
		300,
		Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
	);
	await redisClient.set(redisKey, JSON.stringify(session), "EX", remainingTtl);

	return {
		success: true,
		status: session.status,
		keys: session.keys,
	};
};

export const getStatus = async (rawToken: string) => {
	const result = await getSessionFromRedis(rawToken);
	if (!result) {
		return {
			status: "EXPIRED" as const,
			keys: [],
			previewUrls: [],
		};
	}

	const { session } = result;
	if (session.status === "PENDING") {
		return {
			status: "PENDING" as const,
			keys: [],
			previewUrls: [],
		};
	}

	const previewUrls = session.keys.map((k) => toPublicMediaUrl(k));
	return {
		status: "UPLOADED" as const,
		keys: session.keys,
		previewUrls,
	};
};

export const deleteQrSession = async (rawToken: string) => {
	const tokenHash = hashToken(rawToken);
	const redisKey = RedisKeys.qrUploadSession(tokenHash);
	await redisClient.del(redisKey);
};
