export const RedisKeys = {
	passwordReset: (tokenHash: string) => `password-reset:${tokenHash}`,
};
