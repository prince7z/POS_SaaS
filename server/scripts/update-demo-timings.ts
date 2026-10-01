import { prisma } from "../src/lib/prisma";

const DEMO_EMAIL = "demo@pos-saas.local";
const companyIdArg = process.argv.find((argument) => argument.startsWith("--company-id="))?.split("=")[1];
const companyEmail = process.argv.find((argument) => argument.startsWith("--company-email="))?.split("=")[1] ?? DEMO_EMAIL;

const addMinutes = (date: Date, minutes: number): Date => new Date(date.getTime() + minutes * 60_000);
const withClockTime = (date: Date, seed: number, minimumHour = 8, maximumHour = 20): Date => {
	const result = new Date(date);
	const span = (maximumHour - minimumHour) * 60 * 60 + 59 * 60 + 59;
	const seconds = (seed * 1_103_515_245 + 12_345) % span;
	result.setUTCHours(minimumHour + Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60, 0);
	return result;
};

const runBatches = async <T>(items: T[], operation: (item: T, index: number) => Promise<unknown>, batchSize = 50): Promise<void> => {
	for (let start = 0; start < items.length; start += batchSize) {
		await Promise.all(items.slice(start, start + batchSize).map((item, offset) => operation(item, start + offset)));
	}
};

const main = async (): Promise<void> => {
	const company = companyIdArg
		? await prisma.company.findUnique({ where: { id: companyIdArg } })
		: await prisma.company.findFirst({ where: { email: companyEmail } });
	if (!company) throw new Error(`Company not found: ${companyIdArg ?? companyEmail}`);

	const [sales, saleItems, salePayments, customerPayments, purchaseOrders, supplierPayments, movements, returns, expenses, auditLogs, emailLogs] = await Promise.all([
		prisma.sale.findMany({ where: { companyId: company.id }, select: { id: true, soldAt: true, createdAt: true, updatedAt: true } }),
		prisma.saleItem.findMany({ where: { sale: { companyId: company.id } }, select: { id: true, saleId: true, createdAt: true } }),
		prisma.salePayment.findMany({ where: { sale: { companyId: company.id } }, select: { id: true, saleId: true, paidAt: true } }),
		prisma.customerPayment.findMany({ where: { companyId: company.id }, select: { id: true, invoiceId: true, paidAt: true, createdAt: true } }),
		prisma.purchaseOrder.findMany({ where: { companyId: company.id }, select: { id: true, orderDate: true, expectedDate: true, createdAt: true, updatedAt: true } }),
		prisma.supplierPayment.findMany({ where: { companyId: company.id }, select: { id: true, purchaseOrderId: true, paidAt: true, createdAt: true } }),
		prisma.inventoryMovement.findMany({ where: { companyId: company.id }, select: { id: true, operationId: true, referenceType: true, createdAt: true } }),
		prisma.return.findMany({ where: { companyId: company.id }, select: { id: true, saleId: true, processedAt: true, createdAt: true } }),
		prisma.expense.findMany({ where: { companyId: company.id }, select: { id: true, expenseDate: true, createdAt: true, updatedAt: true } }),
		prisma.auditLog.findMany({ where: { companyId: company.id }, select: { id: true, createdAt: true } }),
		prisma.emailLog.findMany({ where: { companyId: company.id }, select: { id: true, sentAt: true, createdAt: true } }),
	]);

	const saleTimes = new Map<string, Date>();
	await runBatches(sales, async (sale, index) => {
		const eventTime = withClockTime(sale.soldAt, index + 1);
		saleTimes.set(sale.id, eventTime);
		await prisma.sale.update({ where: { id: sale.id }, data: { soldAt: eventTime, createdAt: addMinutes(eventTime, -2), updatedAt: addMinutes(eventTime, 2) } });
	});

	const purchaseTimes = new Map<string, Date>();
	await runBatches(purchaseOrders, async (purchase, index) => {
		const orderTime = withClockTime(purchase.orderDate, index + 101, 7, 17);
		purchaseTimes.set(purchase.id, orderTime);
		await prisma.purchaseOrder.update({
			where: { id: purchase.id },
			data: {
				orderDate: orderTime,
				expectedDate: purchase.expectedDate ? withClockTime(purchase.expectedDate, index + 201, 8, 17) : null,
				createdAt: addMinutes(orderTime, -10),
				updatedAt: addMinutes(orderTime, 30),
			},
		});
	});

	await Promise.all([
		runBatches(saleItems, async (item, index) => {
			const parentTime = saleTimes.get(item.saleId) ?? withClockTime(item.createdAt, index + 301);
			await prisma.saleItem.update({ where: { id: item.id }, data: { createdAt: addMinutes(parentTime, index % 3) } });
		}),
		runBatches(salePayments, async (payment, index) => {
			const parentTime = saleTimes.get(payment.saleId) ?? withClockTime(payment.paidAt, index + 401);
			await prisma.salePayment.update({ where: { id: payment.id }, data: { paidAt: addMinutes(parentTime, 1 + (index % 8)) } });
		}),
		runBatches(customerPayments, async (payment, index) => {
			const parentTime = payment.invoiceId ? saleTimes.get(payment.invoiceId) : undefined;
			const eventTime = parentTime ? addMinutes(parentTime, 15 + (index % 20)) : withClockTime(payment.paidAt, index + 501);
			await prisma.customerPayment.update({ where: { id: payment.id }, data: { paidAt: eventTime, createdAt: addMinutes(eventTime, 1) } });
		}),
		runBatches(supplierPayments, async (payment, index) => {
			const parentTime = payment.purchaseOrderId ? purchaseTimes.get(payment.purchaseOrderId) : undefined;
			const eventTime = parentTime ? addMinutes(parentTime, 60 + (index % 120)) : withClockTime(payment.paidAt, index + 601, 8, 17);
			await prisma.supplierPayment.update({ where: { id: payment.id }, data: { paidAt: eventTime, createdAt: addMinutes(eventTime, 1) } });
		}),
		runBatches(movements, async (movement, index) => {
			const parentTime = movement.referenceType === "SALE" ? saleTimes.get(movement.operationId) : movement.referenceType === "PURCHASE_ORDER" ? purchaseTimes.get(movement.operationId) : undefined;
			const eventTime = parentTime ? addMinutes(parentTime, 3 + (index % 12)) : withClockTime(movement.createdAt, index + 701);
			await prisma.inventoryMovement.update({ where: { id: movement.id }, data: { createdAt: eventTime } });
		}),
		runBatches(returns, async (item, index) => {
			const parentTime = saleTimes.get(item.saleId);
			const eventTime = parentTime ? withClockTime(addMinutes(parentTime, 24 * 60), index + 801, 9, 19) : withClockTime(item.processedAt, index + 801);
			await prisma.return.update({ where: { id: item.id }, data: { processedAt: eventTime, createdAt: addMinutes(eventTime, 1) } });
		}),
		runBatches(expenses, async (expense, index) => {
			const eventTime = withClockTime(expense.expenseDate, index + 901, 8, 18);
			await prisma.expense.update({ where: { id: expense.id }, data: { expenseDate: eventTime, createdAt: addMinutes(eventTime, 2), updatedAt: addMinutes(eventTime, 5) } });
		}),
		runBatches(auditLogs, async (log, index) => {
			await prisma.auditLog.update({ where: { id: log.id }, data: { createdAt: withClockTime(log.createdAt, index + 1001) } });
		}),
		runBatches(emailLogs, async (log, index) => {
			const createdAt = withClockTime(log.createdAt, index + 1101);
			await prisma.emailLog.update({ where: { id: log.id }, data: { createdAt, sentAt: log.sentAt ? addMinutes(createdAt, 2) : null } });
		}),
	]);

	console.log(`Updated timings for company ${company.name} (${company.id})`);
	console.log(`Sales: ${sales.length}; sale items: ${saleItems.length}; payments: ${salePayments.length}; customer payments: ${customerPayments.length}`);
	console.log(`Purchases: ${purchaseOrders.length}; supplier payments: ${supplierPayments.length}; inventory movements: ${movements.length}`);
	console.log(`Returns: ${returns.length}; expenses: ${expenses.length}; audit logs: ${auditLogs.length}; email logs: ${emailLogs.length}`);
};

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
}).finally(async () => {
	await prisma.$disconnect();
});
