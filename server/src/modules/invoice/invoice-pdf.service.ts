import PDFDocument from "pdfkit";
import { formatInvoiceTime, money, formatDate, DEFAULT_BUSINESS_HOURS, DEFAULT_INVOICE_TERMS } from "../notification/templates/invoice.template";

export interface InvoicePdfData {
	id?: string;
	invoiceNumber: string;
	soldAt: Date | string;
	company?: {
		name?: string | null;
		phone?: string | null;
		email?: string | null;
		addressLine1?: string | null;
		city?: string | null;
		currencyCode?: string | null;
		logoUrl?: string | null;
		businessHours?: any;
		invoiceTerms?: string[] | null;
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
	qrCodeBuffer?: Buffer | null;
	logoBuffer?: Buffer | null;
}

export const generateInvoicePdfBuffer = (invoice: InvoicePdfData): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ margin: 40, size: "A4" });
		const buffers: Buffer[] = [];

		doc.on("data", (chunk) => buffers.push(chunk));
		doc.on("end", () => resolve(Buffer.concat(buffers)));
		doc.on("error", (err) => reject(err));

		const textColor = "#1A202C";
		const secondaryColor = "#718096";
		const borderColor = "#E2E8F0";

		let leftY = 40;

		// Logo
		if (invoice.logoBuffer) {
			try {
				doc.image(invoice.logoBuffer, 40, leftY, { fit: [140, 40] });
				leftY += 46;
			} catch (e) {
				// fallback
			}
		}

		// Company Name
		doc.fillColor(textColor).fontSize(14).font("Helvetica-Bold").text(invoice.company?.name || "Harbor & Pine Market", 40, leftY);
		leftY += 18;

		// Company details (address · city · phone)
		doc.fillColor(secondaryColor).fontSize(9).font("Helvetica");
		const companyMeta = [invoice.company?.addressLine1 || "24 Market Street", invoice.company?.city || "Johannesburg", invoice.company?.phone || "+27 11 555 0188"]
			.filter(Boolean)
			.join(" · ");
		doc.text(companyMeta, 40, leftY);
		leftY += 16;

		// Opening hours
		const bHours = invoice.company?.businessHours?.weekdays ? invoice.company.businessHours : DEFAULT_BUSINESS_HOURS;
		doc.fillColor(secondaryColor).fontSize(8).font("Helvetica").text("Opening hours", 40, leftY);
		leftY += 11;
		const openStr = formatInvoiceTime(bHours.weekdays.open);
		const closeStr = formatInvoiceTime(bHours.weekdays.close);
		doc.fillColor(textColor).fontSize(9).text(`Weekdays: ${openStr} – ${closeStr}`, 40, leftY);
		leftY += 18;

		// Header Right (INVOICE, QR code, Invoice #, Date)
		let rightY = 40;
		const rightX = 390;
		const rightWidth = 165;

		doc.fillColor(textColor).fontSize(14).font("Helvetica-Bold").text("INVOICE", rightX, rightY, { width: rightWidth, align: "right" });
		rightY += 20;

		if (invoice.qrCodeBuffer) {
			try {
				doc.image(invoice.qrCodeBuffer, rightX + rightWidth - 76, rightY, { width: 76, height: 76 });
				rightY += 80;
			} catch (e) {
				// ignore
			}
		}

		doc.fillColor(textColor).fontSize(10).font("Helvetica").text(invoice.invoiceNumber || "INV-1011", rightX, rightY, { width: rightWidth, align: "right" });
		rightY += 14;
		doc.fillColor(secondaryColor).fontSize(9).text(formatDate(invoice.soldAt), rightX, rightY, { width: rightWidth, align: "right" });
		rightY += 16;

		let y = Math.max(leftY, rightY) + 10;

		// Separator
		doc.moveTo(40, y).lineTo(555, y).strokeColor(borderColor).lineWidth(1).stroke();
		y += 18;

		// Bill To
		doc.fillColor(secondaryColor).fontSize(8).font("Helvetica").text("Bill to", 40, y);
		y += 12;
		doc.fillColor(textColor).fontSize(11).font("Helvetica-Bold").text(invoice.customer?.name || "Walk-in Customer", 40, y);
		y += 15;

		const customerMeta = [invoice.customer?.email, invoice.customer?.phone].filter(Boolean).join(" · ") || "No contact details";
		doc.fillColor(secondaryColor).fontSize(9).font("Helvetica").text(customerMeta, 40, y);
		y += 22;

		// Table Header
		doc.moveTo(40, y).lineTo(555, y).strokeColor(borderColor).lineWidth(1).stroke();
		y += 6;
		doc.fillColor("#4A5568").fontSize(9).font("Helvetica-Bold");
		doc.text("Item", 40, y);
		doc.text("Qty", 300, y, { width: 40, align: "left" });
		doc.text("Price", 370, y, { width: 80, align: "right" });
		doc.text("Total", 465, y, { width: 90, align: "right" });

		y += 16;
		doc.moveTo(40, y).lineTo(555, y).strokeColor(borderColor).lineWidth(0.5).stroke();
		y += 10;

		// Table Rows
		for (const item of invoice.items || []) {
			if (y > 680) {
				doc.addPage();
				y = 40;
			}

			const lineTotal = item.lineSubtotal ?? item.quantity * item.unitPrice;

			doc.fillColor(textColor).font("Helvetica-Bold").fontSize(9).text(item.productName || "Item", 40, y, { width: 240 });
			if (item.sku) {
				doc.fillColor(secondaryColor).font("Helvetica").fontSize(8).text(item.sku, 40, y + 12);
			}

			doc.fillColor(textColor).font("Helvetica").fontSize(9);
			doc.text(String(item.quantity), 300, y, { width: 40, align: "left" });
			doc.text(money(item.unitPrice), 370, y, { width: 80, align: "right" });
			doc.text(money(lineTotal), 465, y, { width: 90, align: "right" });

			const rowHeight = item.sku ? 26 : 18;
			y += rowHeight;
			doc.moveTo(40, y).lineTo(555, y).strokeColor("#EDF2F7").lineWidth(0.5).stroke();
			y += 8;
		}

		y += 10;

		// Summary Box
		if (y > 640) {
			doc.addPage();
			y = 40;
		}

		const sumLabelX = 360;
		const sumValX = 465;
		const sumWidth = 90;

		const subtotal = invoice.subtotal ?? (invoice.items || []).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
		const taxRate = invoice.taxRate !== undefined && invoice.taxRate !== null ? invoice.taxRate : 8;
		const taxAmount = invoice.taxAmount ?? (subtotal * taxRate) / 100;
		const discountAmount = invoice.discountAmount || 0;
		const total = invoice.total ?? Math.max(0, subtotal + taxAmount - discountAmount);

		doc.fillColor(secondaryColor).font("Helvetica").fontSize(9);
		doc.text("Subtotal", sumLabelX, y);
		doc.fillColor(textColor).text(money(subtotal), sumValX, y, { width: sumWidth, align: "right" });
		y += 16;

		doc.fillColor(secondaryColor).text(`Tax (${taxRate}%)`, sumLabelX, y);
		doc.fillColor(textColor).text(money(taxAmount), sumValX, y, { width: sumWidth, align: "right" });
		y += 16;

		doc.fillColor(secondaryColor).text("Discount", sumLabelX, y);
		doc.fillColor(textColor).text(`-${money(discountAmount)}`, sumValX, y, { width: sumWidth, align: "right" });
		y += 16;

		doc.moveTo(sumLabelX, y).lineTo(555, y).strokeColor(borderColor).lineWidth(1).stroke();
		y += 6;

		doc.fillColor(textColor).font("Helvetica-Bold").fontSize(10).text("Total", sumLabelX, y);
		doc.fillColor(textColor).font("Helvetica-Bold").fontSize(10).text(money(total), sumValX, y, { width: sumWidth, align: "right" });
		y += 28;

		// Notes
		if (invoice.notes) {
			if (y > 680) {
				doc.addPage();
				y = 40;
			}
			doc.fillColor(secondaryColor).font("Helvetica").fontSize(8).text("Notes", 40, y);
			y += 11;
			doc.fillColor(textColor).font("Helvetica").fontSize(9).text(invoice.notes, 40, y, { width: 515 });
			y += 24;
		}

		// Terms & Conditions
		const terms = invoice.company?.invoiceTerms?.length ? invoice.company.invoiceTerms : DEFAULT_INVOICE_TERMS;
		if (y > 640) {
			doc.addPage();
			y = 40;
		}

		doc.moveTo(40, y).lineTo(555, y).strokeColor(borderColor).lineWidth(1).stroke();
		y += 14;
		doc.fillColor(textColor).font("Helvetica-Bold").fontSize(9).text("Terms and conditions", 40, y);
		y += 14;

		doc.fillColor(secondaryColor).font("Helvetica").fontSize(8);
		for (const term of terms) {
			doc.text(`• ${term}`, 40, y, { width: 515 });
			y += 13;
		}
		y += 14;

		// Footer
		if (y > 740) {
			doc.addPage();
			y = 740;
		}

		doc.moveTo(40, y).lineTo(555, y).strokeColor(borderColor).lineWidth(1).stroke();
		y += 12;

		const storeName = invoice.company?.name || "Harbor & Pine Market";
		doc.fillColor("#2D3748").font("Helvetica").fontSize(9).text(`Thank you for shopping with ${storeName}.`, 40, y, { align: "center" });

		doc.end();
	});
};
