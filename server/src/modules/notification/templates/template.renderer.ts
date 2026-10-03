import { EmailType } from "../notification.types";
import { welcomeTemplate } from "./welcome.template";
import { passwordResetTemplate } from "./password-reset.template";
import { invoiceTemplate } from "./invoice.template";

export const renderTemplate = (type: EmailType, data: { name?: string; resetUrl?: string; invoiceNumber?: string }) => {
	switch (type) {
		case EmailType.WELCOME: return welcomeTemplate(data);
		case EmailType.PASSWORD_RESET: return passwordResetTemplate(data);
		case EmailType.ORDER_SUCCESS:
		case EmailType.INVOICE_SEND: return invoiceTemplate(data);
		default: throw new Error(`Template is not implemented for ${type}`);
	}
};
