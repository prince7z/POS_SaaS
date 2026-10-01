import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../../config/env";

export const s3Client = new S3Client({
	region: env.aws.region,
	endpoint: env.aws.endpoint,
	forcePathStyle: Boolean(env.aws.endpoint),
	credentials: {
		accessKeyId: env.aws.accessKeyId,
		secretAccessKey: env.aws.secretAccessKey,
		...(env.aws.sessionToken && { sessionToken: env.aws.sessionToken }),
	},
});

export const createUploadUrl = async (
	key: string,
	contentType: string,
	expiresIn = 900,
): Promise<string> => {
	const command = new PutObjectCommand({
		Bucket: env.aws.bucket,
		Key: key,
		ContentType: contentType,
	});

	return getSignedUrl(s3Client, command, { expiresIn });
};

export const createDownloadUrl = async (
	key: string,
	expiresIn = 900,
): Promise<string> => {
	const command = new GetObjectCommand({
		Bucket: env.aws.bucket,
		Key: key,
	});

	return getSignedUrl(s3Client, command, { expiresIn });
};

export const deleteObject = async (key: string): Promise<void> => {
	await s3Client.send(
		new DeleteObjectCommand({
			Bucket: env.aws.bucket,
			Key: key,
		}),
	);
};
