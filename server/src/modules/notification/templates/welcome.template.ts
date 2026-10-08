export const welcomeTemplate = ({ name }: { name?: string }) => ({
	subject: "Welcome to Jcom",
	html: `<p>Hello ${name ?? "there"},</p><p>Welcome to Jcom POS. Your account is ready to use.</p>`,
	text: `Hello ${name ?? "there"},\n\nWelcome to Jcom POS. Your account is ready to use.`,
});
