export interface InvoiceTemplateInput {
	name?: string;
	invoiceNumber?: string;
	company?: {
		name?: string | null;
		email?: string | null;
		phone?: string | null;
		addressLine1?: string | null;
		city?: string | null;
		currencyCode?: string | null;
		logoUrl?: string | null;
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
	soldAt?: Date | string | null;
	notes?: string | null;
}

export const invoiceTemplate = (input: InvoiceTemplateInput) => {
	const company = input.company || {};
	const customer = input.customer || {};
	const items = input.items || [];
	const currency = company.currencyCode || "$";

	const itemRowsHtml = items.map((item) => {
		const imageUrl = item.imageUrl || null;
		const lineTotal = item.lineSubtotal ?? (item.quantity * item.unitPrice);

		return `
		<tr>
			<td style="padding: 12px; border-bottom: 1px solid #E5E7EB; vertical-align: middle;">
				<table border="0" cellpadding="0" cellspacing="0">
					<tr>
						${imageUrl ? `<td style="padding-right: 12px;"><img src="${imageUrl}" width="42" height="42" style="border-radius: 6px; object-fit: cover; display: block;" /></td>` : ""}
						<td>
							<div style="font-weight: 600; color: #111827; font-size: 14px;">${item.productName || "Product"}</div>
							${item.sku ? `<div style="color: #6B7280; font-size: 12px; margin-top: 2px;">SKU: ${item.sku}</div>` : ""}
						</td>
					</tr>
				</table>
			</td>
			<td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: center; color: #374151; font-size: 14px; vertical-align: middle;">${item.quantity}</td>
			<td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right; color: #374151; font-size: 14px; vertical-align: middle;">${currency}${Number(item.unitPrice).toFixed(2)}</td>
			<td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: 600; color: #111827; font-size: 14px; vertical-align: middle;">${currency}${Number(lineTotal).toFixed(2)}</td>
		</tr>
		`;
	}).join("");

	const dateStr = input.soldAt ? new Date(input.soldAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";

	const html = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Invoice ${input.invoiceNumber || ""}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F7F8FA; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
	<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F7F8FA; padding: 30px 15px;">
		<tr>
			<td align="center">
				<table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
					<!-- Header -->
					<tr>
						<td style="padding: 28px 32px; background-color: #FFFFFF; border-bottom: 1px solid #E5E7EB;">
							<table border="0" cellpadding="0" cellspacing="0" width="100%">
								<tr>
									<td style="vertical-align: top;">
										${company.logoUrl ? `<img src="${company.logoUrl}" alt="${company.name || 'Store'}" height="38" style="display: block; max-width: 140px; margin-bottom: 8px;" />` : ""}
										<div style="font-size: 20px; font-weight: 700; color: #2563EB;">${company.name || "Sales Invoice"}</div>
										<div style="font-size: 12px; color: #6B7280; margin-top: 4px;">
											${[company.addressLine1, company.city, company.phone].filter(Boolean).join(" • ")}
										</div>
									</td>
									<td style="text-align: right; vertical-align: top;">
										<div style="font-size: 14px; font-weight: 700; color: #2563EB; letter-spacing: 0.5px;">INVOICE</div>
										<div style="font-size: 16px; font-weight: 700; color: #111827; margin-top: 4px;">${input.invoiceNumber || "INV-0000"}</div>
										${dateStr ? `<div style="font-size: 12px; color: #6B7280; margin-top: 2px;">${dateStr}</div>` : ""}
									</td>
								</tr>
							</table>
						</td>
					</tr>

					<!-- Customer / Bill To -->
					<tr>
						<td style="padding: 20px 32px; background-color: #F9FAFB; border-bottom: 1px solid #E5E7EB;">
							<div style="font-size: 11px; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Bill To</div>
							<div style="font-size: 15px; font-weight: 600; color: #111827;">${customer.name || input.name || "Walk-in Customer"}</div>
							<div style="font-size: 13px; color: #6B7280; margin-top: 2px;">
								${[customer.email, customer.phone].filter(Boolean).join(" • ") || "No contact details"}
							</div>
						</td>
					</tr>

					<!-- Items Table -->
					${items.length > 0 ? `
					<tr>
						<td style="padding: 24px 32px;">
							<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
								<thead>
									<tr style="background-color: #F3F4F6;">
										<th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 700; color: #374151; border-radius: 6px 0 0 6px;">ITEM</th>
										<th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 700; color: #374151;">QTY</th>
										<th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 700; color: #374151;">PRICE</th>
										<th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 700; color: #374151; border-radius: 0 6px 6px 0;">TOTAL</th>
									</tr>
								</thead>
								<tbody>
									${itemRowsHtml}
								</tbody>
							</table>
						</td>
					</tr>` : ""}

					<!-- Financial Summary -->
					${input.total !== undefined ? `
					<tr>
						<td style="padding: 0 32px 24px 32px;">
							<table border="0" cellpadding="0" cellspacing="0" width="100%">
								<tr>
									<td width="40%"></td>
									<td width="60%">
										<table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; color: #374151;">
											<tr>
												<td style="padding: 4px 0; color: #6B7280;">Subtotal</td>
												<td style="padding: 4px 0; text-align: right; font-weight: 500;">${currency}${Number(input.subtotal || 0).toFixed(2)}</td>
											</tr>
											${input.taxAmount ? `
											<tr>
												<td style="padding: 4px 0; color: #6B7280;">Tax (${input.taxRate || 0}%)</td>
												<td style="padding: 4px 0; text-align: right; font-weight: 500;">${currency}${Number(input.taxAmount).toFixed(2)}</td>
											</tr>` : ""}
											${input.discountAmount ? `
											<tr>
												<td style="padding: 4px 0; color: #6B7280;">Discount</td>
												<td style="padding: 4px 0; text-align: right; color: #059669; font-weight: 500;">-${currency}${Number(input.discountAmount).toFixed(2)}</td>
											</tr>` : ""}
											<tr>
												<td colspan="2" style="padding: 8px 0;"><div style="border-top: 1px solid #E5E7EB;"></div></td>
											</tr>
											<tr>
												<td style="padding: 4px 0; font-size: 16px; font-weight: 700; color: #111827;">Total</td>
												<td style="padding: 4px 0; text-align: right; font-size: 18px; font-weight: 700; color: #2563EB;">${currency}${Number(input.total || 0).toFixed(2)}</td>
											</tr>
										</table>
									</td>
								</tr>
							</table>
						</td>
					</tr>` : ""}

					<!-- Notes -->
					${input.notes ? `
					<tr>
						<td style="padding: 0 32px 20px 32px;">
							<div style="padding: 12px; background-color: #F9FAFB; border-radius: 6px; border: 1px solid #F3F4F6; font-size: 12px; color: #4B5563;">
								<strong style="color: #111827;">Notes:</strong> ${input.notes}
							</div>
						</td>
					</tr>` : ""}

					<!-- Footer -->
					<tr>
						<td style="padding: 24px 32px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; text-align: center;">
							<div style="font-size: 14px; font-weight: 600; color: #111827;">Thank you for shopping with ${company.name || "us"}!</div>
							<div style="font-size: 12px; color: #6B7280; margin-top: 4px;">A PDF copy of this invoice has been attached to this email.</div>
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
		subject: `Invoice ${input.invoiceNumber || ""} from ${company.name || "POS"}`,
		html,
		text: `Invoice ${input.invoiceNumber || ""} from ${company.name || "POS"}\nTotal: ${currency}${Number(input.total || 0).toFixed(2)}\nThank you for shopping with us.`,
	};
};
