import { randomUUID } from "node:crypto";

import { mediaError } from "../../utils/errors";
import {
	deleteS3Object,
	generateDownloadUrl,
	generateUploadUrl,
} from "./s3";

export type MediaResource =
	| "USER_PROFILE"
	| "CUSTOMER_PROFILE"
	| "COMPANY_LOGO"
	| "PRODUCT_IMAGE"
	| "BRAND_LOGO"
 	| "CATEGORY_LOGO"
	| "INVOICE_PDF"
	| "DOCUMENT";

const ALLOWED_CONTENT_TYPES = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"application/pdf": "pdf",
	"application/msword": "doc",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
	"application/vnd.ms-excel": "xls",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
	"application/vnd.ms-powerpoint": "ppt",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
	"text/csv": "csv",
} as const;

const safePathSegment = (value: string): boolean => /^[A-Za-z0-9_-]+$/.test(value);

export const getExtensionFromContentType = (contentType: string): string => {
	const extension = ALLOWED_CONTENT_TYPES[contentType as keyof typeof ALLOWED_CONTENT_TYPES];
	if (!extension) throw mediaError("INVALID_MEDIA_TYPE", "Unsupported media type");
	return extension;
};

const createKey = (companyId: string, resource: MediaResource, resourceId: string, extension: string): string => {
	if (!safePathSegment(companyId) || !safePathSegment(resourceId)) {
		throw mediaError("MEDIA_KEY_INVALID", "Invalid media resource identifier");
	}

	const fileName = `${randomUUID()}.${extension}`;
	switch (resource) {
		case "USER_PROFILE":
			return `companies/${companyId}/users/${resourceId}/profile/${fileName}`;
		case "CUSTOMER_PROFILE":
			return `companies/${companyId}/customers/${resourceId}/profile/${fileName}`;
		case "COMPANY_LOGO":
			return `companies/${companyId}/logo/${fileName}`;
		case "PRODUCT_IMAGE":
			return `companies/${companyId}/products/${resourceId}/${fileName}`;
		case "BRAND_LOGO":
			return `companies/${companyId}/brands/${resourceId}/logo/${fileName}`;
		case "CATEGORY_LOGO":
			return `companies/${companyId}/categories/${resourceId}/logo/${fileName}`;
		case "INVOICE_PDF":
			return `companies/${companyId}/invoices/${resourceId}/${fileName}`;
		case "DOCUMENT":
			return `companies/${companyId}/documents/${resourceId}/${fileName}`;
		default:
			throw mediaError("MEDIA_KEY_INVALID", "Invalid media resource");
	}
};

const validateKey = (key: string): void => {
	if (!key.startsWith("companies/") || key.includes("..") || key.includes("\\") || key.startsWith("/")) {
		throw mediaError("MEDIA_KEY_INVALID", "Invalid media key");
	}
};

type MediaUploadInput = {
	companyId: string;
	resource: MediaResource;
	resourceId: string;
	contentType: string;
	expiresIn?: number;
};

const upload = async ({ companyId, resource, resourceId, contentType, expiresIn }: MediaUploadInput) => {
	const extension = getExtensionFromContentType(contentType);
	const key = createKey(companyId, resource, resourceId, extension);
	const result = await generateUploadUrl({ key, contentType, expiresIn });
	return {
		key,
		uploadUrl: result.url,
		expiresIn: result.expiresIn,
		expiresAt: new Date(Date.now() + result.expiresIn * 1000).toISOString(),
		contentType,
	};
};

export const createMediaUploadUrl = upload;

export const createMediaUploadUrls = async ({
	companyId,
	resource,
	resourceId,
	contentTypes,
	expiresIn,
}: Omit<MediaUploadInput, "contentType"> & { contentTypes: string[] }) =>
	Promise.all(contentTypes.map((contentType) => upload({ companyId, resource, resourceId, contentType, expiresIn })));

export const createMediaDownloadUrl = async ({ key, expiresIn }: { key: string; expiresIn?: number }) => {
	validateKey(key);
	return generateDownloadUrl({ key, expiresIn });
};

export const deleteMediaObject = async (key: string) => {
	validateKey(key);
	return deleteS3Object({ key });
};