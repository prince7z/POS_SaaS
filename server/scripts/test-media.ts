import assert from "node:assert/strict";

process.env.AWS_S3_BUCKET ??= "media-test-bucket";
process.env.AWS_REGION ??= "us-east-2";
process.env.AWS_ACCESS_KEY_ID ??= "media-test-access-key";
process.env.AWS_SECRET_ACCESS_KEY ??= "media-test-secret-key";

const run = async (): Promise<void> => {
	const media = await import("../src/integrations/aws/media");
	const s3 = await import("../src/integrations/aws/s3");

	assert.equal(s3.DEFAULT_PRESIGNED_URL_EXPIRY, 600);
	assert.equal(media.getExtensionFromContentType("image/jpeg"), "jpg");
	assert.equal(media.getExtensionFromContentType("image/png"), "png");
	assert.equal(media.getExtensionFromContentType("image/webp"), "webp");
	assert.equal(media.getExtensionFromContentType("application/pdf"), "pdf");
	assert.equal(media.getExtensionFromContentType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), "docx");

	const upload = await media.createMediaUploadUrl({
		companyId: "company-test",
		resource: "PRODUCT_IMAGE",
		resourceId: "product-test",
		contentType: "image/webp",
	});
	assert.equal(upload.expiresIn, 600);
	assert.equal(upload.contentType, "image/webp");
	assert.match(upload.key, /^companies\/company-test\/products\/product-test\/[0-9a-f-]+\.webp$/);
	assert.ok(upload.uploadUrl.startsWith("http"));
	assert.ok(Date.parse(upload.expiresAt) > Date.now());

	const customExpiry = await media.createMediaUploadUrl({
		companyId: "company-test",
		resource: "COMPANY_LOGO",
		resourceId: "company-test",
		contentType: "image/png",
		expiresIn: 120,
	});
	assert.equal(customExpiry.expiresIn, 120);

	const invoice = await media.createMediaUploadUrl({
		companyId: "company-test",
		resource: "INVOICE_PDF",
		resourceId: "invoice-test",
		contentType: "application/pdf",
	});
	assert.match(invoice.key, /^companies\/company-test\/invoices\/invoice-test\/[0-9a-f-]+\.pdf$/);

	const document = await media.createMediaUploadUrl({
		companyId: "company-test",
		resource: "DOCUMENT",
		resourceId: "document-test",
		contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	});
	assert.match(document.key, /^companies\/company-test\/documents\/document-test\/[0-9a-f-]+\.docx$/);

	const multiple = await media.createMediaUploadUrls({
		companyId: "company-test",
		resource: "PRODUCT_IMAGE",
		resourceId: "product-test",
		contentTypes: ["image/jpeg", "image/webp"],
	});
	assert.equal(multiple.length, 2);
	assert.notEqual(multiple[0]?.key, multiple[1]?.key);

	await assert.rejects(
		() => media.createMediaUploadUrl({ companyId: "company-test", resource: "PRODUCT_IMAGE", resourceId: "product-test", contentType: "image/gif" }),
		(error: { code?: string }) => error.code === "INVALID_MEDIA_TYPE",
	);
	await assert.rejects(
		() => media.createMediaDownloadUrl({ key: "companies/other/../../secret" }),
		(error: { code?: string }) => error.code === "MEDIA_KEY_INVALID",
	);
	await assert.rejects(
		() => media.deleteMediaObject("not-a-company-key"),
		(error: { code?: string }) => error.code === "MEDIA_KEY_INVALID",
	);

	console.log("MEDIA_INFRASTRUCTURE_TESTS_PASSED");
};

run().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
