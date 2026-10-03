export const invoiceTemplate = ({ name, invoiceNumber }: { name?: string; invoiceNumber?: string }) => ({
	subject: `Invoice ${invoiceNumber ?? ""}`.trim(),
	html: `<p>Hello ${name ?? "there"},</p><p>Your invoice <strong>${invoiceNumber ?? ""}</strong> is ready.</p><p>Thank you for shopping with us.</p>`,
	text: `Hello ${name ?? "there"},\n\nYour invoice ${invoiceNumber ?? ""} is ready.\n\nThank you for shopping with us.`,
});
