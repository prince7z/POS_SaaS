import { prisma } from "../lib/prisma";

const cleanKey = (key: string): string => {
	if (!key) return key;
	let cleaned = key.trim();
	if (cleaned.includes("images.unsplash.com/")) {
		cleaned = cleaned.split("images.unsplash.com/")[1] || cleaned;
	} else if (cleaned.includes("images.unsplash.com")) {
		cleaned = cleaned.replace(/^https?:\/\/images\.unsplash\.com\/?/, "");
	}
	return cleaned.replace(/^\//, "");
};

async function main() {
	console.log("Starting DB mock image key cleanup...");

	// 1. Categories
	const categories = await prisma.category.findMany();
	let updatedCategories = 0;
	for (const category of categories) {
		if (category.logoKey && category.logoKey.includes("images.unsplash.com")) {
			const cleaned = cleanKey(category.logoKey);
			await prisma.category.update({
				where: { id: category.id },
				data: { logoKey: cleaned },
			});
			updatedCategories++;
		}
	}
	console.log(`Updated ${updatedCategories} category logo keys.`);

	// 2. Brands
	const brands = await prisma.brand.findMany();
	let updatedBrands = 0;
	for (const brand of brands) {
		if (brand.logoKey && brand.logoKey.includes("images.unsplash.com")) {
			const cleaned = cleanKey(brand.logoKey);
			await prisma.brand.update({
				where: { id: brand.id },
				data: { logoKey: cleaned },
			});
			updatedBrands++;
		}
	}
	console.log(`Updated ${updatedBrands} brand logo keys.`);

	// 3. Customers
	const customers = await prisma.customer.findMany();
	let updatedCustomers = 0;
	for (const customer of customers) {
		if (customer.profileImageKey && customer.profileImageKey.includes("images.unsplash.com")) {
			const cleaned = cleanKey(customer.profileImageKey);
			await prisma.customer.update({
				where: { id: customer.id },
				data: { profileImageKey: cleaned },
			});
			updatedCustomers++;
		}
	}
	console.log(`Updated ${updatedCustomers} customer profile image keys.`);

	// 4. Companies
	const companies = await prisma.company.findMany();
	let updatedCompanies = 0;
	for (const company of companies) {
		if (company.logoKey && company.logoKey.includes("images.unsplash.com")) {
			const cleaned = cleanKey(company.logoKey);
			await prisma.company.update({
				where: { id: company.id },
				data: { logoKey: cleaned },
			});
			updatedCompanies++;
		}
	}
	console.log(`Updated ${updatedCompanies} company logo keys.`);

	// 5. Users
	const users = await prisma.user.findMany();
	let updatedUsers = 0;
	for (const user of users) {
		if (user.profileImageKey && user.profileImageKey.includes("images.unsplash.com")) {
			const cleaned = cleanKey(user.profileImageKey);
			await prisma.user.update({
				where: { id: user.id },
				data: { profileImageKey: cleaned },
			});
			updatedUsers++;
		}
	}
	console.log(`Updated ${updatedUsers} user profile image keys.`);

	// 6. Products
	const products = await prisma.product.findMany();
	let updatedProducts = 0;
	for (const product of products) {
		if (Array.isArray(product.imageKeys) && product.imageKeys.some((k) => k.includes("images.unsplash.com"))) {
			const cleanedKeys = product.imageKeys.map((k) => cleanKey(k));
			await prisma.product.update({
				where: { id: product.id },
				data: { imageKeys: cleanedKeys },
			});
			updatedProducts++;
		}
	}
	console.log(`Updated ${updatedProducts} product image key arrays.`);

	console.log("Database mock image key cleanup finished successfully!");
}

main()
	.catch((err) => {
		console.error("Cleanup script failed:", err);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
