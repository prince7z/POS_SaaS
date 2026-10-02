import { prisma } from "../src/lib/prisma";

// Real person portrait images (for Customers and Suppliers)
const PERSON_IMAGE_KEYS = [
	"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1517404215738-15263e9f9178?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=800&q=80",
	"https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=800&q=80",
];

// Product / item / object images (for Categories and Brands)
const ITEM_IMAGE_KEYS = [
	"https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80", // Smartwatch / Tech
	"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80", // Headphones
	"https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80", // Sneakers / Shoes
	"https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80", // Coffee / Beverages
	"https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80", // Smartphone / Gadget
	"https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80", // Laptop / Office
	"https://images.unsplash.com/photo-1585386959984-a41552231693?auto=format&fit=crop&w=800&q=80", // Beauty / Skincare
	"https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=800&q=80", // Fashion / Backpack
	"https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=800&q=80", // Sunglasses
	"https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80", // Furniture / Decor
	"https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80", // Camera / Electronics
	"https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80", // Health / Pharmacy
];

async function main() {
	console.log("Updating mock images in database...");

	// 1. Update Customers (Person portrait images -> profileImageKey)
	const customers = await prisma.customer.findMany({ select: { id: true } });
	console.log(`Updating ${customers.length} customers with person images...`);
	for (let i = 0; i < customers.length; i++) {
		const img = PERSON_IMAGE_KEYS[i % PERSON_IMAGE_KEYS.length];
		await prisma.customer.update({
			where: { id: customers[i].id },
			data: { profileImageKey: img },
		});
	}

	// 2. Update Suppliers (Person/Contact person images -> logoKey or profileImageKey)
	const suppliers = await prisma.supplier.findMany({ select: { id: true } });
	console.log(`Updating ${suppliers.length} suppliers with person images...`);
	for (let i = 0; i < suppliers.length; i++) {
		const img = PERSON_IMAGE_KEYS[(i + 5) % PERSON_IMAGE_KEYS.length];
		try {
			await (prisma.supplier as any).update({
				where: { id: suppliers[i].id },
				data: { logoKey: img },
			});
		} catch {
			// Ignore if Supplier table doesn't have logoKey field in DB schema
		}
	}

	// 3. Update Brands (Item/Object images -> logoKey)
	const brands = await prisma.brand.findMany({ select: { id: true } });
	console.log(`Updating ${brands.length} brands with product/item images...`);
	for (let i = 0; i < brands.length; i++) {
		const img = ITEM_IMAGE_KEYS[i % ITEM_IMAGE_KEYS.length];
		await prisma.brand.update({
			where: { id: brands[i].id },
			data: { logoKey: img },
		});
	}

	// 4. Update Categories (Item/Object images -> logoKey)
	const categories = await prisma.category.findMany({ select: { id: true } });
	console.log(`Updating ${categories.length} categories with product/item images...`);
	for (let i = 0; i < categories.length; i++) {
		const img = ITEM_IMAGE_KEYS[(i + 4) % ITEM_IMAGE_KEYS.length];
		await prisma.category.update({
			where: { id: categories[i].id },
			data: { logoKey: img },
		});
	}

	console.log("Successfully updated all mock images!");
}

main()
	.catch((err) => {
		console.error("Failed to seed mock images:", err);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
