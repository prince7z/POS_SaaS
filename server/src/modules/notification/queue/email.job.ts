import { z } from "zod";
import { EmailType, type EmailJob } from "../notification.types";

const emailJobSchema = z.object({
	type: z.nativeEnum(EmailType),
	companyId: z.string().uuid().optional(),
	storeId: z.string().uuid().optional(),
	recipient: z.object({ email: z.string().email(), name: z.string().optional(), customerId: z.string().uuid().optional(), userId: z.string().uuid().optional() }),
	data: z.object({
		orderId: z.string().uuid().optional(),
		invoiceId: z.string().uuid().optional(),
		userId: z.string().uuid().optional(),
		resetToken: z.string().min(1).optional(),
		invoiceNumber: z.string().optional(),
		subject: z.string().optional(),
		html: z.string().optional(),
		to: z.union([z.string(), z.array(z.string())]).optional(),
	}),
	metadata: z.object({ triggeredBy: z.string().optional(), requestId: z.string().optional() }).optional(),
});

export const parseEmailJob = (input: unknown): EmailJob => emailJobSchema.parse(input);
