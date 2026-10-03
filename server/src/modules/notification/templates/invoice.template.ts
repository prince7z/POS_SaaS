import QRCode from "qrcode";

export interface InvoiceTemplateInput {
	id?: string;
	invoiceNumber?: string;
	soldAt?: Date | string | null;
	company?: {
		name?: string | null;
		email?: string | null;
		phone?: string | null;
		addressLine1?: string | null;
		city?: string | null;
		currencyCode?: string | null;
		logoUrl?: string | null;
		businessHours?: any;
		invoiceTerms?: string[] | null;
	} | null;
	customer?: {
		name?: string | null;
		email?: string | null;
		phone?: string | null;
	} | null;
	items?: Array<{
		productName?: string | null;
		sku?: string | null;
		quantity: number;
		unitPrice: number;
		lineSubtotal?: number;
		imageUrl?: string | null;
	}>;
	subtotal?: number;
	taxRate?: number;
	taxAmount?: number;
	discountAmount?: number;
	total?: number;
	notes?: string | null;
	verificationUrl?: string;
	qrCodeDataUrl?: string;
}

export const DEFAULT_BUSINESS_HOURS = {
	weekdays: { open: "08:00", close: "16:00" },
};

export const DEFAULT_INVOICE_TERMS = [
	"Goods once sold cannot be returned or exchanged except as per the store's return policy.",
	"Please check the products and invoice details before leaving the store.",
	"Warranty, if applicable, is subject to the manufacturer's terms and conditions.",
	"Any eligible return or exchange must be accompanied by the original invoice.",
];

export function formatInvoiceTime(value?: string | null): string {
	if (!value) return "";
	const [hours, minutes] = value.split(":").map(Number);
	if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value;
	const d = new Date(2000, 0, 1, hours, minutes);
	return d.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

export function money(amount: number): string {
	const val = Number(amount) || 0;
	return val.toFixed(2);
}

export function formatDate(val?: Date | string | null): string {
	const d = val ? new Date(val) : new Date();
	return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export const invoiceTemplate = (input: InvoiceTemplateInput) => {
	const company = input.company || {};
	const customer = input.customer || {};
	const items = input.items || [];

	const subtotal = input.subtotal ?? items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
	const taxRate = input.taxRate !== undefined && input.taxRate !== null ? input.taxRate : 8;
	const taxAmount = input.taxAmount ?? (subtotal * taxRate) / 100;
	const discountAmount = input.discountAmount || 0;
	const total = input.total ?? Math.max(0, subtotal + taxAmount - discountAmount);

	const companyMeta = [company.addressLine1, company.city, company.phone].filter(Boolean).join(" · ");
	const customerMeta = [customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact details";

	const bHours = company.businessHours?.weekdays ? company.businessHours : DEFAULT_BUSINESS_HOURS;
	const openingHoursStr = `Weekdays: ${formatInvoiceTime(bHours.weekdays.open)} – ${formatInvoiceTime(bHours.weekdays.close)}`;

	const terms = company.invoiceTerms?.length ? company.invoiceTerms : DEFAULT_INVOICE_TERMS;

	const itemRowsHtml = items
		.map(
			(item) => `
		<tr>
			<td style="padding: 12px 0; border-bottom: 1px solid #E2E8F0; text-align: left; vertical-align: top;">
				<div style="font-weight: 700; color: #1A202C; font-size: 14px; line-height: 1.3;">${item.productName || "Item"}</div>
				${item.sku ? `<div style="font-size: 12px; color: #718096; margin-top: 2px;">${item.sku}</div>` : ""}
			</td>
			<td style="padding: 12px 0; border-bottom: 1px solid #E2E8F0; text-align: left; vertical-align: top; color: #1A202C; font-size: 14px;">${item.quantity}</td>
			<td style="padding: 12px 0; border-bottom: 1px solid #E2E8F0; text-align: right; vertical-align: top; color: #1A202C; font-size: 14px;">${money(item.unitPrice)}</td>
			<td style="padding: 12px 0; border-bottom: 1px solid #E2E8F0; text-align: right; vertical-align: top; color: #1A202C; font-size: 14px;">${money(item.quantity * item.unitPrice)}</td>
		</tr>
	`,
		)
		.join("");

	const html = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Invoice ${input.invoiceNumber || ""}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1A202C;">
	<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FFFFFF; padding: 24px 12px;">
		<tr>
			<td align="center">
				<table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 32px;">
					<tr>
						<td>
							<!-- Header -->
							<table border="0" cellpadding="0" cellspacing="0" width="100%">
								<tr>
									<td style="vertical-align: top;">
										${
											company.logoUrl
												? `<img src="${company.logoUrl}" alt="${company.name || ""}" style="max-height: 42px; max-width: 150px; object-fit: contain; display: block; margin-bottom: 8px;" />`
												: `<div style="font-size: 28px; line-height: 1; margin-bottom: 8px;">🛒</div>`
										}
										<div style="font-size: 16px; font-weight: 700; color: #1A202C; margin-top: 4px;">${company.name || "Harbor & Pine Market"}</div>
										${companyMeta ? `<div style="font-size: 12px; color: #718096; margin-top: 2px;">${companyMeta}</div>` : ""}
										<div style="font-size: 12px; color: #718096; margin-top: 12px;">
											<div style="font-weight: 400; color: #718096;">Opening hours</div>
											<div>${openingHoursStr}</div>
										</div>
									</td>
									<td style="text-align: right; vertical-align: top; width: 160px;">
										<div style="font-size: 14px; font-weight: 700; color: #1A202C; letter-spacing: 0.5px;">INVOICE</div>
										${input.qrCodeDataUrl ? `<img src="${input.qrCodeDataUrl}" alt="Invoice verification QR code" width="76" height="76" style="display: block; margin: 4px 0 4px auto; border-radius: 2px;" />` : ""}
										<div style="font-size: 13px; color: #1A202C; font-weight: 400;">${input.invoiceNumber || "INV-1011"}</div>
										<div style="font-size: 12px; color: #718096; margin-top: 2px;">${formatDate(input.soldAt)}</div>
									</td>
								</tr>
							</table>

							<!-- Separator -->
							<div style="border-top: 1px solid #E2E8F0; margin: 24px 0;"></div>

							<!-- Bill To -->
							<div style="margin-bottom: 24px;">
								<div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Bill to</div>
								<div style="font-size: 14px; font-weight: 700; color: #1A202C;">${customer.name || "Walk-in Customer"}</div>
								<div style="font-size: 13px; color: #718096; margin-top: 2px;">${customerMeta}</div>
							</div>

							<!-- Items Table -->
							<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 24px;">
								<thead>
									<tr style="border-bottom: 1px solid #E2E8F0;">
										<th style="padding: 8px 0; text-align: left; font-size: 13px; font-weight: 600; color: #4A5568;">Item</th>
										<th style="padding: 8px 0; text-align: left; font-size: 13px; font-weight: 600; color: #4A5568;">Qty</th>
										<th style="padding: 8px 0; text-align: right; font-size: 13px; font-weight: 600; color: #4A5568;">Price</th>
										<th style="padding: 8px 0; text-align: right; font-size: 13px; font-weight: 600; color: #4A5568;">Total</th>
									</tr>
								</thead>
								<tbody>
									${itemRowsHtml}
								</tbody>
							</table>

							<!-- Summary -->
							<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
								<tr>
									<td></td>
									<td width="240" style="vertical-align: top;">
										<table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; color: #1A202C;">
											<tr>
												<td style="padding: 4px 0; color: #718096;">Subtotal</td>
												<td style="padding: 4px 0; text-align: right;">${money(subtotal)}</td>
											</tr>
											<tr>
												<td style="padding: 4px 0; color: #718096;">Tax (${taxRate}%)</td>
												<td style="padding: 4px 0; text-align: right;">${money(taxAmount)}</td>
											</tr>
											<tr>
												<td style="padding: 4px 0; color: #718096;">Discount</td>
												<td style="padding: 4px 0; text-align: right;">-${money(discountAmount)}</td>
											</tr>
											<tr>
												<td colspan="2" style="padding: 8px 0;"><div style="border-top: 1px solid #E2E8F0;"></div></td>
											</tr>
											<tr>
												<td style="padding: 4px 0; font-weight: 700; color: #1A202C;">Total</td>
												<td style="padding: 4px 0; text-align: right; font-weight: 700; color: #1A202C;">${money(total)}</td>
											</tr>
										</table>
									</td>
								</tr>
							</table>

							<!-- Notes -->
							${
								input.notes
									? `
								<div style="margin-bottom: 24px;">
									<div style="font-size: 12px; color: #718096;">Notes</div>
									<div style="font-size: 14px; color: #1A202C; margin-top: 2px;">${input.notes}</div>
								</div>
							`
									: ""
							}

							<!-- Terms -->
							<div style="padding-top: 24px; border-top: 1px solid #E2E8F0; margin-top: 24px; font-size: 12px; color: #2D3748;">
								<div style="font-weight: 700; color: #1A202C; margin-bottom: 6px;">Terms and conditions</div>
								<div style="line-height: 1.6; color: #2D3748;">
									${terms.map((t) => `<div>• ${t}</div>`).join("")}
								</div>
							</div>

							<!-- Footer -->
							<div style="text-align: center; padding-top: 20px; margin-top: 24px; border-top: 1px solid #E2E8F0; font-size: 13px; color: #2D3748;">
								Thank you for shopping with ${company.name || "Harbor & Pine Market"}.
							</div>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
	`;

	return {
		subject: `Invoice ${input.invoiceNumber || ""} from ${company.name || "Harbor & Pine Market"}`,
		html,
		text: `Invoice ${input.invoiceNumber || ""} from ${company.name || "Harbor & Pine Market"}\nTotal: ${money(total)}\nThank you for shopping with ${company.name || "Harbor & Pine Market"}.`,
	};
};
