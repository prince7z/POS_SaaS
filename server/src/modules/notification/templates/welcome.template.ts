export const welcomeTemplate = ({ name }: { name?: string }) => ({
	subject: "Welcome to POS SaaS",
	html: `<p>Hello ${name ?? "there"},</p><p>Welcome to POS SaaS. Your account is ready to use.</p>`,
	text: `Hello ${name ?? "there"},\n\nWelcome to POS SaaS. Your account is ready to use.`,
});
