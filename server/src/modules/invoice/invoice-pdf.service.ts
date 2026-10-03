import PDFDocument from "pdfkit";

export interface InvoicePdfData {
	invoiceNumber: string;
	soldAt: Date | string;
	company?: {
		name?: string | null;
		phone?: string | null;
		email?: string | null;
		addressLine1?: string | null;
		city?: string | null;
		state?: string | null;
		postalCode?: string | null;
		currencyCode?: string | null;
	} | null;
	customer?: {
		name?: string | null;
		phone?: string | null;
		email?: string | null;
	} | null;
	items: Array<{
		productName?: string | null;
		sku?: string | null;
		quantity: number;
		unitPrice: number;
		lineSubtotal?: number;
	}>;
	subtotal: number;
	taxRate?: number;
	taxAmount?: number;
	discountAmount?: number;
	total: number;
	notes?: string | null;
}

export const generateInvoicePdfBuffer = (invoice: InvoicePdfData): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ margin: 40, size: "A4" });
		const buffers: Buffer[] = [];

		doc.on("data", (chunk) => buffers.push(chunk));
		doc.on("end", () => resolve(Buffer.concat(buffers)));
		doc.on("error", (err) => reject(err));

		const primaryColor = "#2563EB";
		const textColor = "#111827";
		const secondaryColor = "#6B7280";
		const borderColor = "#E5E7EB";

		// Company Logo / Name & INVOICE Header
		doc.fillColor(primaryColor).fontSize(20).text(invoice.company?.name || "Store Invoice", 40, 40);
		doc.fillColor(secondaryColor).fontSize(9);
		const companyDetails = [invoice.company?.addressLine1, invoice.company?.city, invoice.company?.phone, invoice.company?.email]
			.filter(Boolean)
			.join(" • ");
		if (companyDetails) doc.text(companyDetails, 40, 66);

		doc.fillColor(primaryColor).fontSize(22).text("INVOICE", 420, 40, { align: "right" });
		doc.fillColor(textColor).fontSize(10).text(`Invoice #: ${invoice.invoiceNumber || "N/A"}`, 420, 66, { align: "right" });
		const dateStr = invoice.soldAt ? new Date(invoice.soldAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";
		if (dateStr) doc.fillColor(secondaryColor).fontSize(9).text(`Date: ${dateStr}`, 420, 80, { align: "right" });

		// Divider
		doc.moveTo(40, 105).lineTo(555, 105).strokeColor(borderColor).stroke();

		// Customer / Bill To
		doc.fillColor(secondaryColor).fontSize(9).text("BILL TO", 40, 120);
		doc.fillColor(textColor).fontSize(11).text(invoice.customer?.name || "Walk-in Customer", 40, 134);
		const customerContact = [invoice.customer?.email, invoice.customer?.phone].filter(Boolean).join(" • ");
		if (customerContact) doc.fillColor(secondaryColor).fontSize(9).text(customerContact, 40, 150);

		// Items Table Header
		let y = 180;
		doc.rect(40, y, 515, 22).fill("#F3F4F6");
		doc.fillColor(textColor).fontSize(9).font("Helvetica-Bold");
		doc.text("Item", 48, y + 6);
		doc.text("Qty", 300, y + 6, { width: 40, align: "right" });
		doc.text("Price", 360, y + 6, { width: 80, align: "right" });
		doc.text("Total", 450, y + 6, { width: 95, align: "right" });

		// Table Rows
		doc.font("Helvetica").fontSize(9);
		y += 26;
		const currency = invoice.company?.currencyCode || "$";

		for (const item of invoice.items || []) {
			if (y > 700) {
				doc.addPage();
				y = 40;
			}
			const lineTotal = item.lineSubtotal ?? (item.quantity * item.unitPrice);
			doc.fillColor(textColor).text(item.productName || "Product", 48, y, { width: 240 });
			if (item.sku) {
				doc.fillColor(secondaryColor).fontSize(8).text(`SKU: ${item.sku}`, 48, y + 11);
			}
			doc.fillColor(textColor).fontSize(9);
			doc.text(String(item.quantity), 300, y, { width: 40, align: "right" });
			doc.text(`${currency}${Number(item.unitPrice).toFixed(2)}`, 360, y, { width: 80, align: "right" });
			doc.text(`${currency}${Number(lineTotal).toFixed(2)}`, 450, y, { width: 95, align: "right" });

			y += item.sku ? 24 : 18;
			doc.moveTo(40, y - 4).lineTo(555, y - 4).strokeColor("#F3F4F6").stroke();
		}

		// Summary Box
		y += 10;
		if (y > 680) {
			doc.addPage();
			y = 40;
		}

		const rightX = 350;
		const valX = 450;

		doc.fillColor(secondaryColor).fontSize(9).text("Subtotal", rightX, y);
		doc.fillColor(textColor).text(`${currency}${Number(invoice.subtotal || 0).toFixed(2)}`, valX, y, { width: 95, align: "right" });
		y += 16;

		if (invoice.taxAmount) {
			doc.fillColor(secondaryColor).text(`Tax (${invoice.taxRate || 0}%)`, rightX, y);
			doc.fillColor(textColor).text(`${currency}${Number(invoice.taxAmount).toFixed(2)}`, valX, y, { width: 95, align: "right" });
			y += 16;
		}

		if (invoice.discountAmount) {
			doc.fillColor(secondaryColor).text("Discount", rightX, y);
			doc.fillColor(textColor).text(`-${currency}${Number(invoice.discountAmount).toFixed(2)}`, valX, y, { width: 95, align: "right" });
			y += 16;
		}

		doc.moveTo(rightX, y).lineTo(555, y).strokeColor(borderColor).stroke();
		y += 6;

		doc.fillColor(textColor).font("Helvetica-Bold").fontSize(11).text("Total", rightX, y);
		doc.fillColor(primaryColor).fontSize(12).text(`${currency}${Number(invoice.total || 0).toFixed(2)}`, valX, y, { width: 95, align: "right" });
		y += 30;

		// Notes & Footer
		if (invoice.notes) {
			doc.fillColor(secondaryColor).font("Helvetica-Bold").fontSize(9).text("Notes:", 40, y);
			doc.font("Helvetica").text(invoice.notes, 40, y + 12);
			y += 30;
		}

		doc.moveTo(40, 750).lineTo(555, 750).strokeColor(borderColor).stroke();
		doc.fillColor(secondaryColor).font("Helvetica").fontSize(9).text(`Thank you for shopping with ${invoice.company?.name || "us"}!`, 40, 762, { align: "center" });

		doc.end();
	});
};
