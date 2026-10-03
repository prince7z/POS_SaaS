import type { EmailProvider, SendEmailOptions } from "../notification.types";
export type { SendEmailOptions } from "../notification.types";

export abstract class BaseEmailProvider implements EmailProvider {
	abstract send(options: SendEmailOptions): Promise<void>;
}
