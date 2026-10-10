import type { Access } from "@prisma/client";

declare global {
	namespace Express {
		interface Request {
			auth?: {
				userId: string;
				companyId: string;
			};
				authenticatedUser?: {
				id: string;
				companyId: string;
				accesses: Access[];
					takealotApiKey?: string;
				};
				takealotApiKey?: string;
		}
	}
}

export {};