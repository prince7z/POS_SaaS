import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { env } from "../config/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: env.databaseUrl });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
	adapter,
	transactionOptions: {
		maxWait: 15000,
		timeout: 30000,
	},
});

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}
