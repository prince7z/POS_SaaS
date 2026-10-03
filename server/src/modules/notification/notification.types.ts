export enum EmailType {
	WELCOME = "WELCOME",
	PASSWORD_RESET = "PASSWORD_RESET",
	ORDER_SUCCESS = "ORDER_SUCCESS",
	INVOICE_SEND = "INVOICE_SEND",
}

export interface EmailJob {
	type: EmailType;
	companyId?: string;
	storeId?: string;
	recipient: {
		email: string;
		name?: string;
		customerId?: string;
		userId?: string;
	};
	data: {
		orderId?: string;
		invoiceId?: string;
		userId?: string;
		resetToken?: string;
		invoiceNumber?: string;
	};
	metadata?: {
		triggeredBy?: string;
		requestId?: string;
	};
}

export interface EmailAttachment {
	filename: string;
	content: Buffer;
	contentType: string;
}

export interface SendEmailOptions {
	to: string;
	toName?: string;
	subject: string;
	html: string;
	text?: string;
	attachments?: EmailAttachment[];
}

export interface EmailProvider {
	send(options: SendEmailOptions): Promise<void>;
}
