export const passwordResetTemplate = ({ name, resetUrl }: { name?: string; resetUrl?: string }) => ({
	subject: "Reset your Jcom password",
	html: `<p>Hello ${name ?? "there"},</p><p>Use the link below to set a new password. It expires in 15 minutes.</p><p><a href="${resetUrl}">Reset password</a></p>`,
	text: `Hello ${name ?? "there"},\n\nReset your password: ${resetUrl}\n\nThis link expires in 15 minutes.`,
});
