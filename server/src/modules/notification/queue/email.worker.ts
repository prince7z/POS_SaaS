import { Worker } from "bullmq";
import QRCode from "qrcode";
import { createBullMqConnection } from "../../../infrastructure/redis";
import { logger } from "../../../lib/logger";
import { env } from "../../../config/env";
import { EMAIL_QUEUE_NAME } from "../notification.constants";
import { parseEmailJob } from "./email.job";
import { emailProvider } from "../providers/brevo.provider";
import { EmailType } from "../notification.types";
import { renderTemplate } from "../templates/template.renderer";
import { prisma } from "../../../lib/prisma";
import { generateInvoicePdfBuffer } from "../../invoice/invoice-pdf.service";
import { toPublicMediaUrl } from "../../../integrations/aws/media";

export const createEmailWorker = () => {
	const worker = new Worker(
		EMAIL_QUEUE_NAME,
		async (job) => {
			const payload = parseEmailJob(job.data);
			logger.info("Email job started", JSON.stringify({ jobId: job.id, emailType: payload.type, companyId: payload.companyId }));

			if (payload.type === EmailType.CUSTOM) {
				const toRecipients = payload.data.to || payload.recipient.email;
				const subject = payload.data.subject || "No Subject";
				const html = payload.data.html || "";
				const primaryEmail = Array.isArray(toRecipients) ? toRecipients[0] : toRecipients;
				await emailProvider.send({
					to: primaryEmail,
					toName: payload.recipient.name,
					subject,
					html,
				});
			} else if (payload.type === EmailType.PASSWORD_RESET) {
				const template = renderTemplate(payload.type, {
					name: payload.recipient.name,
					resetUrl: `${env.frontendUrl}/auth/forgot-password/${payload.data.resetToken}`,
				});
				await emailProvider.send({ to: payload.recipient.email, toName: payload.recipient.name, ...template });
			} else if (payload.type === EmailType.INVOICE_SEND || payload.type === EmailType.ORDER_SUCCESS) {
				const targetId = payload.data.invoiceId || payload.data.orderId;
				let sale: any = null;

				if (targetId) {
					sale = await prisma.sale.findFirst({
						where: { id: targetId },
						include: {
							company: true,
							customer: true,
							cashier: { select: { id: true, fullName: true } },
							items: {
								orderBy: { createdAt: "asc" },
								include: { product: { select: { imageKeys: true } } },
							},
						},
					});
				}

				if (sale) {
					const logoUrl = sale.company.logoKey ? toPublicMediaUrl(sale.company.logoKey) : null;
					const verificationUrl = `${env.frontendUrl}/invoice-verification/${sale.id}`;

					let qrCodeDataUrl: string | undefined = undefined;
					let qrCodeBuffer: Buffer | null = null;
					try {
						qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 96 });
						qrCodeBuffer = await QRCode.toBuffer(verificationUrl, { margin: 1, width: 96 });
					} catch (e) {
						logger.error("Failed to generate QR code for invoice", JSON.stringify({ saleId: sale.id, error: String(e) }));
					}

					let logoBuffer: Buffer | null = null;
					if (logoUrl) {
						try {
							const logoRes = await fetch(logoUrl);
							if (logoRes.ok) {
								logoBuffer = Buffer.from(await logoRes.arrayBuffer());
							}
						} catch (e) {
							// ignore logo fetch failure
						}
					}

					const invoiceData = {
						id: sale.id,
						invoiceNumber: sale.invoiceNumber,
						soldAt: sale.soldAt,
						company: {
							name: sale.company.name,
							phone: sale.company.phone,
							email: sale.company.email,
							addressLine1: sale.company.addressLine1,
							city: sale.company.city,
							currencyCode: sale.company.currencyCode,
							logoUrl,
							businessHours: sale.company.businessHours,
							invoiceTerms: sale.company.invoiceTerms,
						},
						customer: {
							name: payload.recipient.name || sale.customer?.name || "Walk-in customer",
							email: payload.recipient.email || sale.customer?.email || null,
							phone: sale.customer?.phone || null,
						},
						items: sale.items.map((item: any) => ({
							productName: item.productName,
							sku: item.sku,
							quantity: Number(item.quantity),
							unitPrice: Number(item.unitPrice),
							lineSubtotal: Number(item.lineSubtotal),
							imageUrl: item.product?.imageKeys?.[0] ? toPublicMediaUrl(item.product.imageKeys[0]) : null,
						})),
						subtotal: Number(sale.subtotal),
						taxRate: Number(sale.taxRate),
						taxAmount: Number(sale.taxAmount),
						discountAmount: Number(sale.discountAmount),
						total: Number(sale.total),
						notes: sale.notes,
						verificationUrl,
						qrCodeDataUrl,
						qrCodeBuffer,
						logoBuffer,
					};

					const template = renderTemplate(payload.type, invoiceData);
					const pdfBuffer = await generateInvoicePdfBuffer(invoiceData);

					await emailProvider.send({
						to: payload.recipient.email,
						toName: payload.recipient.name || sale.customer?.name,
						...template,
						attachments: [
							{
								filename: `${sale.invoiceNumber || "Invoice"}.pdf`,
								content: pdfBuffer,
								contentType: "application/pdf",
							},
						],
					});
				} else {
					const template = renderTemplate(payload.type, {
						name: payload.recipient.name,
						invoiceNumber: payload.data.invoiceNumber,
					});
					await emailProvider.send({ to: payload.recipient.email, toName: payload.recipient.name, ...template });
				}
			} else {
				const template = renderTemplate(payload.type, {
					name: payload.recipient.name,
					invoiceNumber: payload.data.invoiceNumber,
				});
				await emailProvider.send({ to: payload.recipient.email, toName: payload.recipient.name, ...template });
			}

			logger.info("Email sent successfully", JSON.stringify({ jobId: job.id, emailType: payload.type }));
		},
		{ connection: createBullMqConnection() },
	);

	worker.on("error", (error) => {
		logger.error("Email job error", JSON.stringify({ error: error.message }));
	});
	worker.on("failed", (job, error) => {
		logger.error("Email job failed", JSON.stringify({ jobId: job?.id, emailType: job?.data?.type, error: error.message }));
	});

	return worker;
};
