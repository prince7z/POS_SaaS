import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { mediaError } from "../../utils/errors";

export const DEFAULT_PRESIGNED_URL_EXPIRY = 600;

type UploadUrlInput = {
	key: string;
	contentType: string;
	expiresIn?: number;
};

type DownloadUrlInput = {
	key: string;
	expiresIn?: number;
};

const getBucket = (): string => {
	if (!env.aws.bucket) {
		throw mediaError("S3_UPLOAD_URL_FAILED", "S3 bucket is not configured", 500);
	}
	return env.aws.bucket;
};

const getExpiry = (expiresIn?: number): number => {
	if (expiresIn === undefined) return DEFAULT_PRESIGNED_URL_EXPIRY;
	if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 604800) {
		throw mediaError("S3_UPLOAD_URL_FAILED", "S3 URL expiry must be between 1 and 604800 seconds");
	}
	return expiresIn;
};

const credentials =
	env.aws.accessKeyId && env.aws.secretAccessKey
		? {
				accessKeyId: env.aws.accessKeyId,
				secretAccessKey: env.aws.secretAccessKey,
				...(env.aws.sessionToken && { sessionToken: env.aws.sessionToken }),
			}
		: undefined;

export const s3Client = new S3Client({
	region: env.aws.region,
	endpoint: env.aws.endpoint,
	forcePathStyle: Boolean(env.aws.endpoint),
	credentials,
});

export const generateUploadUrl = async ({ key, contentType, expiresIn }: UploadUrlInput) => {
	const effectiveExpiry = getExpiry(expiresIn);
	try {
		const url = await getSignedUrl(
			s3Client,
			new PutObjectCommand({ Bucket: getBucket(), Key: key, ContentType: contentType }),
			{ expiresIn: effectiveExpiry },
		);
		return { url, expiresIn: effectiveExpiry, key };
	} catch (error) {
		logger.error("Failed to generate S3 upload URL", error);
		throw mediaError("S3_UPLOAD_URL_FAILED", "Could not generate upload URL", 500);
	}
};

export const generateDownloadUrl = async ({ key, expiresIn }: DownloadUrlInput) => {
	const effectiveExpiry = getExpiry(expiresIn);
	try {
		const url = await getSignedUrl(
			s3Client,
			new GetObjectCommand({ Bucket: getBucket(), Key: key }),
			{ expiresIn: effectiveExpiry },
		);
		return { url, expiresIn: effectiveExpiry, key };
	} catch (error) {
		logger.error("Failed to generate S3 download URL", error);
		throw mediaError("S3_DOWNLOAD_URL_FAILED", "Could not generate download URL", 500);
	}
};

export const deleteS3Object = async ({ key }: { key: string }) => {
	try {
		await s3Client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
		return { success: true, key };
	} catch (error) {
		logger.error("Failed to delete S3 object", error);
		throw mediaError("S3_DELETE_FAILED", "Could not delete media object", 500);
	}
};