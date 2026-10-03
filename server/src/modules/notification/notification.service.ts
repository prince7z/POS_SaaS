import crypto from "node:crypto";
import { enqueueEmail } from "./queue/email.queue";
import { EmailType } from "./notification.types";
import { logger } from "../../lib/logger";

export const queueWelcomeEmail = async (input: { companyId: string; userId: string; email: string; name: string }) => {
	try {
		await enqueueEmail({ type: EmailType.WELCOME, companyId: input.companyId, recipient: { email: input.email, name: input.name, userId: input.userId }, data: { userId: input.userId }, metadata: { triggeredBy: "registration" } });
	} catch (error) {
		logger.error("Welcome email could not be queued", error);
	}
};

export const queuePasswordResetEmail = async (input: { userId: string; email: string; name: string; resetToken: string }) =>
	enqueueEmail({ type: EmailType.PASSWORD_RESET, recipient: { email: input.email, name: input.name, userId: input.userId }, data: { userId: input.userId, resetToken: input.resetToken }, metadata: { triggeredBy: "password-reset" } });

export const queueOrderSuccessEmail = async (input: { companyId: string; orderId: string; invoiceNumber: string; email: string; name?: string; customerId?: string; triggeredBy: string }) =>
	enqueueEmail({
		type: EmailType.ORDER_SUCCESS,
		companyId: input.companyId,
		recipient: { email: input.email, name: input.name, customerId: input.customerId },
		data: { orderId: input.orderId, invoiceId: input.orderId, invoiceNumber: input.invoiceNumber },
		metadata: { triggeredBy: input.triggeredBy },
	});

export const queueInvoiceEmail = async (input: { companyId: string; invoiceId: string; invoiceNumber: string; email: string; name?: string; customerId?: string; triggeredBy: string }) =>
	enqueueEmail({
		type: EmailType.INVOICE_SEND,
		companyId: input.companyId,
		recipient: { email: input.email, name: input.name, customerId: input.customerId },
		data: { orderId: input.invoiceId, invoiceId: input.invoiceId, invoiceNumber: input.invoiceNumber },
		metadata: { triggeredBy: input.triggeredBy },
	});

export const hashResetToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export const generateResetToken = () => crypto.randomBytes(32).toString("hex");
