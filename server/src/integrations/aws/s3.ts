import { S3Client } from "@aws-sdk/client-s3";

import { env } from "../../config/env";

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