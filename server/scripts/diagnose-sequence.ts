import { prisma } from "../src/lib/prisma";

const main = async () => {
	try {
		await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "purchase_order_number_sequence" START WITH 1001 INCREMENT BY 1`);
		const rows = await prisma.$queryRawUnsafe(`SELECT nextval('"purchase_order_number_sequence"')::bigint AS value`);
		console.log(rows);
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	} finally {
		await prisma.$disconnect();
	}
};

main();
