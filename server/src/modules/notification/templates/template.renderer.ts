import { EmailType } from "../notification.types";
import { welcomeTemplate } from "./welcome.template";
import { passwordResetTemplate } from "./password-reset.template";
import { invoiceTemplate, type InvoiceTemplateInput } from "./invoice.template";

export const renderTemplate = (type: EmailType, data: any) => {
	switch (type) {
		case EmailType.WELCOME: return welcomeTemplate(data);
		case EmailType.PASSWORD_RESET: return passwordResetTemplate(data);
		case EmailType.ORDER_SUCCESS:
		case EmailType.INVOICE_SEND: return invoiceTemplate(data as InvoiceTemplateInput);
		default: throw new Error(`Template is not implemented for ${type}`);
	}
};
