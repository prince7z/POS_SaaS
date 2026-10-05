export const RedisKeys = {
	passwordReset: (tokenHash: string) => `password-reset:${tokenHash}`,
	qrUploadSession: (tokenHash: string) => `qr-upload:${tokenHash}`,
};
