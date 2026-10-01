import bcrypt from "bcryptjs";
import { Access, DiscountType, ExpenseCategory, InventoryMovementType, PaymentMethod, PaymentStatus, Prisma, PurchaseOrderStatus, RefundType, ReturnStatus, SaleSource, SaleStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { prisma } from "../src/lib/prisma";

const DEMO_EMAIL = "demo@pos-saas.local";
const DEMO_PASSWORD = "DemoPassword123!";
const RESET = process.argv.includes("--reset");
const money = (value: number) => new Prisma.Decimal(value.toFixed(2));
const qty = (value: number) => new Prisma.Decimal(value.toFixed(3));
const image = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=85`;
const images = [
	image("photo-1556742049-0cfed4f6a45d"),
	image("photo-1523275335684-37898b6baf30"),
	image("photo-1542291026-7eec264c27ff"),
	image("photo-1495474472287-4d71bcdd2085"),
	image("photo-1511707171634-5f897ff02aa9"),
	image("photo-1541807084-5c52b6b3adef"),
	image("photo-1585386959984-a41552231693"),
	image("photo-1600185365483-26d7a4cc7519"),
	image("photo-1572635196237-14b3f281503f"),
	image("photo-1511499767150-a48a237f0083"),
];

const categories = [
	["Electronics", "Smart devices, accessories and everyday technology"],
	["Mobile Accessories", "Cases, chargers, cables and audio accessories"],
	["Home & Kitchen", "Practical products for home and kitchen"],
	["Beauty & Personal Care", "Personal care and grooming essentials"],
	["Fashion", "Apparel, footwear and accessories"],
	["Office & Stationery", "Workplace and study essentials"],
	["Sports & Outdoors", "Fitness, travel and outdoor gear"],
	["Groceries", "Shelf-stable food and household consumables"],
] as const;

const brands = ["Northstar", "Apex Living", "Harbor & Co.", "Brightline", "Mosaic", "Everyday Goods", "Summit", "Urban Thread"];
const productTemplates = [
	["Wireless Noise-Cancelling Headphones", "Electronics", 1899, 1099, 649],
	["Smart Fitness Watch", "Electronics", 2499, 1599, 930],
	["Portable Bluetooth Speaker", "Electronics", 1299, 799, 430],
	["USB-C Fast Charger 65W", "Mobile Accessories", 699, 399, 210],
	["Braided USB-C Cable 2m", "Mobile Accessories", 299, 169, 75],
	["MagSafe Phone Case", "Mobile Accessories", 599, 349, 170],
	["Stainless Steel Water Bottle", "Home & Kitchen", 449, 299, 130],
	["Digital Kitchen Scale", "Home & Kitchen", 399, 249, 110],
	["LED Desk Lamp", "Home & Kitchen", 899, 549, 260],
	["Ceramic Travel Mug", "Home & Kitchen", 349, 219, 95],
	["Daily Moisture Face Cream", "Beauty & Personal Care", 499, 329, 145],
	["Sandalwood Body Wash", "Beauty & Personal Care", 299, 199, 82],
	["Hair Styling Dryer", "Beauty & Personal Care", 1099, 699, 355],
	["Everyday Canvas Sneakers", "Fashion", 1199, 799, 420],
	["Classic Leather Belt", "Fashion", 599, 399, 190],
	["Polarised Sunglasses", "Fashion", 799, 499, 245],
	["Hardcover Project Notebook", "Office & Stationery", 249, 149, 60],
	["Precision Gel Pen Set", "Office & Stationery", 179, 99, 38],
	["Ergonomic Wireless Mouse", "Office & Stationery", 649, 399, 205],
	["Resistance Band Set", "Sports & Outdoors", 499, 299, 125],
	["Insulated Lunch Cooler", "Sports & Outdoors", 699, 449, 205],
	["Compact Travel Backpack", "Sports & Outdoors", 999, 649, 310],
	["Premium Ground Coffee 500g", "Groceries", 249, 169, 86],
	["Organic Green Tea 40 Pack", "Groceries", 199, 129, 62],
	["Dark Chocolate 70% 100g", "Groceries", 89, 59, 28],
] as const;

const firstNames = ["Aisha", "Liam", "Noah", "Mia", "Olivia", "Ethan", "Amara", "Theo", "Zanele", "Maya", "Lucas", "Nadia", "Aria", "Eli", "Sofia", "Daniel", "Leah", "Kai", "Grace", "Sipho"];
const lastNames = ["Naidoo", "Jacobs", "Mokoena", "Williams", "Pillay", "Dlamini", "Smith", "Khumalo", "Botha", "Mthembu", "van Wyk", "Ndlovu"];
const cityData = [["Johannesburg", "GP"], ["Cape Town", "WC"], ["Durban", "KZN"], ["Pretoria", "GP"], ["Gqeberha", "EC"]] as const;
const supplierNames = ["Metro Wholesale", "Cape Trade Supply", "Prime Distribution", "Good Earth Imports", "Blue Crane Suppliers", "Urban Stockists", "Summit Wholesale", "Golden Route Trading", "MarketLink Supply", "Harbor Distributors"];
const rand = (seed: number) => {
	let value = seed >>> 0;
	return () => {
		value = (value * 1664525 + 1013904223) >>> 0;
		return value / 4294967296;
	};
};
const dateDaysAgo = (days: number) => new Date(Date.now() - days * 86400000);
const dayStart = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 10, 0, 0));
const sum = (values: Prisma.Decimal[]) => values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0));

async function clearCompany(companyId: string): Promise<void> {
	await prisma.$transaction([
		prisma.returnItem.deleteMany({ where: { return: { companyId } } }),
		prisma.return.deleteMany({ where: { companyId } }),
		prisma.salePayment.deleteMany({ where: { sale: { companyId } } }),
		prisma.customerPayment.deleteMany({ where: { companyId } }),
		prisma.saleItem.deleteMany({ where: { sale: { companyId } } }),
		prisma.sale.deleteMany({ where: { companyId } }),
		prisma.supplierPayment.deleteMany({ where: { companyId } }),
		prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { companyId } } }),
		prisma.purchaseOrder.deleteMany({ where: { companyId } }),
		prisma.inventoryMovement.deleteMany({ where: { companyId } }),
		prisma.emailLog.deleteMany({ where: { companyId } }),
		prisma.expense.deleteMany({ where: { companyId } }),
		prisma.auditLog.deleteMany({ where: { companyId } }),
		prisma.session.deleteMany({ where: { user: { companyId } } }),
		prisma.product.deleteMany({ where: { companyId } }),
		prisma.category.deleteMany({ where: { companyId } }),
		prisma.brand.deleteMany({ where: { companyId } }),
		prisma.supplier.deleteMany({ where: { companyId } }),
		prisma.customer.deleteMany({ where: { companyId } }),
		prisma.user.deleteMany({ where: { companyId } }),
		prisma.company.delete({ where: { id: companyId } }),
	]);
}

async function main(): Promise<void> {
	const random = rand(20261001);
	const existing = await prisma.company.findFirst({ where: { email: DEMO_EMAIL } });
	if (existing && !RESET) throw new Error(`Demo company already exists. Re-run with --reset to recreate ${existing.id}.`);
	if (existing) await clearCompany(existing.id);

	const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
	const company = await prisma.company.create({
		data: {
			name: "Harbor & Pine Market",
			email: DEMO_EMAIL,
			phone: "+27 11 555 0188",
			addressLine1: "24 Market Street",
			city: "Johannesburg",
			state: "GP",
			postalCode: "2001",
			countryCode: "ZA",
			currencyCode: "ZAR",
			timezone: "Africa/Johannesburg",
			defaultTaxRate: money(15),
		},
	});
	const user = await prisma.user.create({
		data: {
			companyId: company.id,
			email: "admin@harborpine.local",
			passwordHash,
			fullName: "Harbor & Pine Admin",
			phone: "+27 82 555 0142",
			roleName: "Admin",
			accesses: Object.values(Access),
		},
	});

	const categoryRows = await Promise.all(categories.map(([name, description]) => prisma.category.create({ data: { companyId: company.id, name, description } })));
	const categoryMap = new Map(categoryRows.map((row) => [row.name, row.id]));
	const brandRows = await Promise.all(brands.map((name) => prisma.brand.create({ data: { companyId: company.id, name, description: `${name} quality range` } })));
	const suppliers = await Promise.all(supplierNames.map((name, index) => prisma.supplier.create({
		data: {
			companyId: company.id, name, contactPerson: `${firstNames[index]} ${lastNames[index]}`, phone: `+27 11 555 ${String(1000 + index).slice(-4)}`,
			email: `orders${index + 1}@${name.toLowerCase().replaceAll(/[^a-z]/g, "")}.local`, website: `https://example.com/${name.toLowerCase().replaceAll(/[^a-z]/g, "-")}`,
			addressLine1: `${10 + index} Commerce Park`, city: cityData[index % cityData.length][0], state: cityData[index % cityData.length][1],
			postalCode: `20${String(10 + index).padStart(3, "0")}`, paymentTermsDays: [0, 14, 30][index % 3], creditLimit: money(10000 + index * 2500),
		},
	})));

	const products = await Promise.all(productTemplates.map(async ([name, category, rrp, sellingPrice, purchaseCost], index) => prisma.product.create({
		data: {
			companyId: company.id, categoryId: categoryMap.get(category)!, brandId: brandRows[index % brandRows.length].id, supplierId: suppliers[index % suppliers.length].id,
			name, sku: `HP-${String(index + 1).padStart(4, "0")}`, barcode: `600${String(100000000 + index)}`,
			description: `${name} from the Harbor & Pine curated retail collection.`, rrp: money(rrp), sellingPrice: money(sellingPrice), purchaseCost: money(purchaseCost),
			stockQuantity: qty(0), averageCost: money(purchaseCost), lowStockThreshold: qty(index % 5 === 0 ? 8 : 4), warrantyMonths: index < 10 ? 12 : null,
			productCode: `HP-${String(index + 1).padStart(4, "0")}`, imageKeys: [images[index % images.length]],
		},
	})));
	const customers = await Promise.all(Array.from({ length: 100 }, async (_, index) => {
		const first = firstNames[index % firstNames.length]; const last = lastNames[(index * 3) % lastNames.length]; const city = cityData[index % cityData.length];
		return prisma.customer.create({
			data: {
				companyId: company.id, name: `${first} ${last}`, phone: `+27 7${String(10000000 + index).slice(-8)}`, email: `customer${String(index + 1).padStart(3, "0")}@harborpine.local`,
				customerType: index % 4 === 0 ? "Wholesale" : index % 3 === 0 ? "Business" : "Retail", addressLine1: `${index + 1} Pine Avenue`, city: city[0], state: city[1], postalCode: `20${String(20 + index).padStart(3, "0")}`,
				creditLimit: money(index % 5 === 0 ? 10000 : 2500), creditBalance: money(0), storeCreditBalance: money(0), createdAt: dateDaysAgo(180 - (index % 170)),
			},
		});
	}));
	const walkIn = await prisma.customer.create({ data: { companyId: company.id, name: "Walk-in Customer", isWalkIn: true, creditLimit: money(0), creditBalance: money(0), storeCreditBalance: money(0) } });

	const stockByProduct = new Map(products.map((product) => [product.id, 0]));
	for (let index = 0; index < products.length; index++) {
		const product = products[index]; const received = 35 + (index % 6) * 10; stockByProduct.set(product.id, received);
		await prisma.product.update({ where: { id: product.id }, data: { stockQuantity: qty(received), averageCost: product.purchaseCost } });
		const order = await prisma.purchaseOrder.create({ data: { companyId: company.id, supplierId: product.supplierId!, poNumber: `PO-SEED-${String(index + 1).padStart(4, "0")}`, status: PurchaseOrderStatus.RECEIVED, orderDate: dateDaysAgo(190 - index), expectedDate: dateDaysAgo(180 - index), subtotal: money(Number(product.purchaseCost) * received), taxAmount: money(Number(product.purchaseCost) * received * 0.15), total: money(Number(product.purchaseCost) * received * 1.15), paidAmount: money(Number(product.purchaseCost) * received * 1.15), balanceDue: money(0), createdBy: user.id } });
		await prisma.purchaseOrderItem.create({ data: { purchaseOrderId: order.id, productId: product.id, orderedQuantity: qty(received), receivedQuantity: qty(received), unitCost: product.purchaseCost, lineTotal: money(Number(product.purchaseCost) * received) } });
		await prisma.inventoryMovement.create({ data: { companyId: company.id, productId: product.id, movementType: InventoryMovementType.PURCHASE_RECEIPT, quantityChange: qty(received), quantityBefore: qty(0), quantityAfter: qty(received), unitCost: product.purchaseCost, operationId: order.id, referenceType: "PURCHASE_ORDER", referenceId: order.id, reason: "Opening demo stock", createdBy: user.id } });
	}

	const saleRows: Array<{ id: string; saleItemId: string; item: typeof products[number]; quantity: number; customerId: string | null; soldAt: Date }> = [];
	const salePlans = Array.from({ length: 250 }, (_, index) => {
		const itemCount = 1 + Math.floor(random() * 3); const chosen = new Set<number>();
		while (chosen.size < itemCount) chosen.add(Math.floor(random() * products.length));
		const selected = [...chosen].map((productIndex) => products[productIndex]);
		const customer = index % 7 === 0 ? walkIn : customers[(index * 7) % customers.length];
		const saleId = randomUUID();
		const soldAt = dayStart(dateDaysAgo(Math.floor(random() * 180)));
		const lines = selected.map((product, lineIndex) => {
			const quantity = 1 + Math.floor(random() * (lineIndex === 0 ? 3 : 2)); const unitPrice = product.sellingPrice;
			return { product, quantity, unitPrice, lineSubtotal: money(Number(unitPrice) * quantity) };
		});
		const subtotal = sum(lines.map((line) => line.lineSubtotal)); const hasDiscount = index % 11 === 0; const discountAmount = hasDiscount ? money(Number(subtotal) * 0.1) : money(0); const taxAmount = money((Number(subtotal) - Number(discountAmount)) * 0.15); const total = money(Number(subtotal) - Number(discountAmount) + Number(taxAmount));
		const plannedLines = lines.map((line) => {
			const before = stockByProduct.get(line.product.id)!; const after = Math.max(0, before - line.quantity); stockByProduct.set(line.product.id, after);
			return { ...line, id: randomUUID(), before, after };
		});
		return { index, id: saleId, selected, customer, soldAt, plannedLines, subtotal, hasDiscount, discountAmount, taxAmount, total };
	});
	await prisma.sale.createMany({
		data: salePlans.map((plan) => ({
			id: plan.id, companyId: company.id, invoiceNumber: `INV-SEED-${String(plan.index + 1).padStart(5, "0")}`,
			customerId: plan.customer.id, cashierId: user.id, source: SaleSource.POS, status: SaleStatus.COMPLETED,
			paymentStatus: PaymentStatus.PAID, soldAt: plan.soldAt, subtotal: plan.subtotal, taxRate: money(15),
			taxAmount: plan.taxAmount, discountType: plan.hasDiscount ? DiscountType.PERCENT : null,
			discountValue: plan.hasDiscount ? money(10) : null, discountAmount: plan.discountAmount, total: plan.total,
			paidAmount: plan.total, balanceDue: money(0), notes: plan.index % 13 === 0 ? "Demo loyalty customer sale" : null,
		})),
	});
	await prisma.saleItem.createMany({
		data: salePlans.flatMap((plan) => plan.plannedLines.map((line) => ({
			id: line.id, saleId: plan.id, productId: line.product.id, productName: line.product.name,
			sku: line.product.sku, barcode: line.product.barcode, quantity: qty(line.quantity), unitPrice: line.unitPrice,
			unitCost: line.product.purchaseCost, lineSubtotal: line.lineSubtotal,
		}))),
	});
	await prisma.salePayment.createMany({
		data: salePlans.map((plan) => ({
			saleId: plan.id, paymentMethod: [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.STORE_CREDIT][plan.index % 3],
			amount: plan.total, reference: `DEMO-PAY-${plan.index + 1}`, paidAt: plan.soldAt, createdBy: user.id,
		})),
	});
	await prisma.inventoryMovement.createMany({
		data: salePlans.flatMap((plan) => plan.plannedLines.map((line) => ({
			companyId: company.id, productId: line.product.id, movementType: InventoryMovementType.SALE,
			quantityChange: qty(-line.quantity), quantityBefore: qty(line.before), quantityAfter: qty(line.after),
			unitCost: line.product.purchaseCost, operationId: plan.id, referenceType: "SALE", referenceId: plan.id,
			reason: "Demo sale", createdBy: user.id,
		}))),
	});
	saleRows.push(...salePlans.map((plan) => ({
		id: plan.id, saleItemId: plan.plannedLines[0].id, item: plan.selected[0],
		quantity: plan.plannedLines[0].quantity, customerId: plan.customer.id === walkIn.id ? null : plan.customer.id,
		soldAt: plan.soldAt,
	})));
	await Promise.all(products.map((product) => prisma.product.update({ where: { id: product.id }, data: { stockQuantity: qty(stockByProduct.get(product.id)!) } })));
	console.log("Created 250/250 sales...");

	for (const [index, sale] of saleRows.filter((_, saleIndex) => saleIndex % 29 === 0).entries()) {
		if (!sale.customerId) continue;
		const returnId = randomUUID(); const returnQuantity = 1; const refundAmount = money(Number(sale.item.sellingPrice) * returnQuantity);
		await prisma.return.create({ data: { id: returnId, companyId: company.id, returnNumber: `RET-SEED-${String(index + 1).padStart(4, "0")}`, saleId: sale.id, customerId: sale.customerId, reason: "Demo customer return", refundType: index % 2 === 0 ? RefundType.CASH : RefundType.STORE_CREDIT, refundAmount, status: ReturnStatus.COMPLETED, processedBy: user.id, processedAt: new Date(sale.soldAt.getTime() + 86400000) } });
		await prisma.returnItem.create({ data: { returnId, saleItemId: sale.saleItemId, productId: sale.item.id, quantity: qty(returnQuantity), unitRefundPrice: sale.item.sellingPrice, refundAmount } });
		const current = stockByProduct.get(sale.item.id)!; stockByProduct.set(sale.item.id, current + returnQuantity);
		await prisma.product.update({ where: { id: sale.item.id }, data: { stockQuantity: qty(current + returnQuantity) } });
	}

	const expenseData = Array.from({ length: 80 }, (_, index) => {
		const category = Object.values(ExpenseCategory)[index % Object.values(ExpenseCategory).length];
		return { companyId: company.id, expenseDate: dateDaysAgo(Math.floor(random() * 180)), category, otherCategoryName: category === ExpenseCategory.OTHER ? ["Licensing", "Repairs", "Delivery"][index % 3] : null, description: `${category.replaceAll("_", " ")} - ${index + 1}`, amount: money([850, 1200, 2400, 4800, 6750][index % 5]), createdBy: user.id };
	});
	await prisma.expense.createMany({ data: expenseData });

	console.log(`Seeded ${company.name}`);
	console.log(`Company ID: ${company.id}`);
	console.log(`Login email: ${DEMO_EMAIL}`);
	console.log(`Login password: ${DEMO_PASSWORD}`);
	console.log(`Created: ${categoryRows.length} categories, ${brandRows.length} brands, ${products.length} products, ${customers.length + 1} customers, ${saleRows.length} sales, ${expenseData.length} expenses`);
	console.log("Product images use stable public Unsplash URLs stored in imageKeys.");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
}).finally(async () => {
	await prisma.$disconnect();
});
