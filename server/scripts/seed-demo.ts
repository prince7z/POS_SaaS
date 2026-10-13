/**
 * scripts/seed-demo.ts
 * Main orchestrator for the DemoMart Retail demo seeder.
 *
 * Run: npm run seed:demo
 * Reset: npm run seed:demo:reset
 *
 * Required env vars:
 *   DEMO_SEED_ENABLED=true
 *   PSQL=<connection string>
 *   AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 *   DEMO_ADMIN_PASSWORD=<secure password>
 *
 * Optional:
 *   DEMO_COMPANY_EMAIL, DEMO_ADMIN_EMAIL, DEMO_SEED_RESET, DEMO_MEDIA_PREFIX
 *
 * Licensing note:
 *   DummyJSON product images are used for DEVELOPMENT/STAGING only.
 *   RandomUser.me portraits are used with the disclaimer that they are
 *   sourced from UI Faces and intended for demo/development use only.
 *   Do not use rehosted images in production without verifying redistribution rights.
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Config (must be first import so env vars are read before other modules)
// ---------------------------------------------------------------------------
import {
	DEMO_SEED_ENABLED,
	DEMO_SEED_RESET,
	DEMO_RANDOM_SEED,
	DEMO_MEDIA_PREFIX,
	DEMO_ADMIN_EMAIL,
	DEMO_ADMIN_PASSWORD,
	DEMO_COMPANY_EMAIL,
	CACHE_DOWNLOADS_DIR,
	CACHE_PROCESSED_DIR,
	CACHE_REPORTS_DIR,
	CACHE_DIR,
	IMAGE_CONCURRENCY,
	TARGET_PRODUCTS,
	makePrng,
} from "./seed-demo/config";

if (!DEMO_SEED_ENABLED) {
	console.error(
		"[seed-demo] DEMO_SEED_ENABLED is not set to 'true'. " +
		"Set DEMO_SEED_ENABLED=true in your .env to enable demo seeding.",
	);
	process.exit(1);
}

// ---------------------------------------------------------------------------
// Prisma
// ---------------------------------------------------------------------------
import { prisma } from "../src/lib/prisma";

// ---------------------------------------------------------------------------
// Seed modules
// ---------------------------------------------------------------------------
import { getOrCreateDemoCompany } from "./seed-demo/company-admin";
import {
	fetchDummyJsonProducts,
	fetchRandomUserPortraits,
	selectProducts,
} from "./seed-demo/external-data";
import { downloadOrReadCache, downloadImageWithRetry } from "./seed-demo/image-download";
import {
	normalizeToSquareWebp,
	createSquareLogoSvg,
	svgToWebp,
	LOGO_PALETTE,
} from "./seed-demo/image-processing";
import { uploadImageBufferToS3, makeS3Key } from "./seed-demo/s3-storage";
import {
	loadManifest,
	setEntry,
	isAlreadyUploaded,
	makeProcessedPath,
	sha256OfBuffer,
} from "./seed-demo/image-manifest";
import { CATEGORY_DEFS, BRAND_DEFS, seedCatalog } from "./seed-demo/catalog";
import { seedSuppliers, seedCustomers } from "./seed-demo/suppliers-customers";
import { seedOpeningInventory } from "./seed-demo/opening-inventory";
import { seedPurchases } from "./seed-demo/purchases";
import { seedSales } from "./seed-demo/sales";
import { seedCustomerPayments } from "./seed-demo/payments";
import { seedReturns } from "./seed-demo/returns";
import { seedExpenses } from "./seed-demo/expenses";
import { validateSeedData } from "./seed-demo/validation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function withConcurrencyLimit<T>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
	let index = 0;
	const workers = Array.from({ length: limit }, async () => {
		while (index < items.length) {
			const current = index++;
			await fn(items[current]!, current);
		}
	});
	await Promise.all(workers);
}

// ---------------------------------------------------------------------------
// Image upload helper
// ---------------------------------------------------------------------------
async function uploadSvgLogo(
	s3Key: string,
	svgString: string,
	entityType: string,
	entityKey: string,
): Promise<string> {
	if (isAlreadyUploaded(s3Key)) return s3Key;

	const { buffer } = await svgToWebp(svgString);
	await uploadImageBufferToS3(s3Key, buffer);

	setEntry({
		sourceUrl: null,
		provider: "local-svg",
		entityType,
		entityKey,
		s3Key,
		contentType: "image/webp",
		width: 512,
		height: 512,
		sourceLicenseStatus: "local-generated-no-restrictions",
		downloaded: true,
		processed: true,
		uploaded: true,
		checksumSha256: sha256OfBuffer(buffer),
	});

	return s3Key;
}

async function uploadDownloadedImage(
	sourceUrl: string,
	s3Key: string,
	entityType: string,
	entityKey: string,
	cacheKey: string,
	provider: string,
	licenseStatus: string,
): Promise<string | null> {
	if (isAlreadyUploaded(s3Key)) return s3Key;

	try {
		const raw = await downloadOrReadCache(sourceUrl, cacheKey);
		const { buffer, width, height } = await normalizeToSquareWebp(raw, "contain");

		// Write to processed cache
		const processedPath = makeProcessedPath(s3Key);
		fs.mkdirSync(path.dirname(processedPath), { recursive: true });
		fs.writeFileSync(processedPath, buffer);

		await uploadImageBufferToS3(s3Key, buffer);

		setEntry({
			sourceUrl,
			provider,
			entityType,
			entityKey,
			s3Key,
			contentType: "image/webp",
			width,
			height,
			sourceLicenseStatus: licenseStatus,
			downloaded: true,
			processed: true,
			uploaded: true,
			checksumSha256: sha256OfBuffer(buffer),
		});

		return s3Key;
	} catch (error) {
		console.warn(`  [image] Failed ${s3Key}: ${(error as Error).message}`);
		setEntry({
			sourceUrl,
			provider,
			entityType,
			entityKey,
			s3Key,
			contentType: "image/webp",
			width: 0,
			height: 0,
			sourceLicenseStatus: licenseStatus,
			downloaded: false,
			processed: false,
			uploaded: false,
			error: (error as Error).message,
		});
		return null;
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
	console.log("=".repeat(60));
	console.log("DemoMart Retail — Demo Seeder");
	console.log("=".repeat(60));
	console.log(`  DEMO_SEED_RESET: ${DEMO_SEED_RESET}`);
	console.log(`  Company email:   ${DEMO_COMPANY_EMAIL}`);
	console.log(`  Admin email:     ${DEMO_ADMIN_EMAIL}`);
	console.log();

	// Create cache directories
	for (const dir of [CACHE_DIR, CACHE_DOWNLOADS_DIR, CACHE_PROCESSED_DIR, CACHE_REPORTS_DIR]) {
		fs.mkdirSync(dir, { recursive: true });
	}
	loadManifest();

	const prng = makePrng(DEMO_RANDOM_SEED);
	const fakerSeed = 20261001;

	// -----------------------------------------------------------------------
	// Step 1: Fetch external data
	// -----------------------------------------------------------------------
	console.log("▶ Step 1: Fetching external product data…");
	const allProducts = await fetchDummyJsonProducts();
	console.log(`  DummyJSON: ${allProducts.length} products`);
	const selectedProducts = selectProducts(allProducts, TARGET_PRODUCTS);
	console.log(`  Selected: ${selectedProducts.length} products across ${new Set(selectedProducts.map((p) => p.source.category)).size} categories`);

	console.log("▶ Step 1b: Fetching portrait data…");
	let portraitResults: Awaited<ReturnType<typeof fetchRandomUserPortraits>> = [];
	try {
		portraitResults = await fetchRandomUserPortraits(60);
		console.log(`  RandomUser: ${portraitResults.length} portraits`);
	} catch (error) {
		console.warn(`  RandomUser fetch failed (will use SVG avatars): ${(error as Error).message}`);
	}

	// -----------------------------------------------------------------------
	// Step 2: Upload company logo
	// -----------------------------------------------------------------------
	console.log("▶ Step 2: Generating and uploading logos…");

	// We need a temporary companyId placeholder for S3 keys before DB insert;
	// we'll use DEMO_SEED_ID as the prefix since company UUID isn't known yet.
	const seedId = "demomart";

	const companyLogoKey = makeS3Key(DEMO_MEDIA_PREFIX, seedId, "company", "logo.webp");
	const companyLogoSvg = createSquareLogoSvg({
		name: "DemoMart Retail",
		background: "#1E3A5F",
		foreground: "#FFFFFF",
		initials: "DM",
		tagline: "EST. 2024",
	});
	await uploadSvgLogo(companyLogoKey, companyLogoSvg, "company", "demomart-retail");
	console.log("  ✓ Company logo");

	// Category logos
	const categoryLogoKeys = new Map<string, string>();
	for (let i = 0; i < CATEGORY_DEFS.length; i++) {
		const def = CATEGORY_DEFS[i]!;
		const slug = def.name.toLowerCase().replaceAll(/[^a-z0-9]/g, "-");
		const key = makeS3Key(DEMO_MEDIA_PREFIX, seedId, "categories", `${slug}-logo.webp`);
		const palette = LOGO_PALETTE[i % LOGO_PALETTE.length]!;
		const initials = def.name.split(/[\s&]+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
		const svg = createSquareLogoSvg({ name: def.name, background: palette.bg, foreground: palette.fg, initials });
		await uploadSvgLogo(key, svg, "category", def.name);
		categoryLogoKeys.set(def.name, key);
	}
	console.log(`  ✓ ${categoryLogoKeys.size} category logos`);

	// Brand logos
	const brandLogoKeys = new Map<string, string>();
	for (let i = 0; i < BRAND_DEFS.length; i++) {
		const def = BRAND_DEFS[i]!;
		const slug = def.name.toLowerCase().replaceAll(/[^a-z0-9]/g, "-");
		const key = makeS3Key(DEMO_MEDIA_PREFIX, seedId, "brands", `${slug}-logo.webp`);
		const palette = LOGO_PALETTE[(i + 5) % LOGO_PALETTE.length]!;
		const initials = def.name.split(/[\s&]+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
		const svg = createSquareLogoSvg({ name: def.name, background: palette.bg, foreground: palette.fg, initials });
		await uploadSvgLogo(key, svg, "brand", def.name);
		brandLogoKeys.set(def.name, key);
	}
	console.log(`  ✓ ${brandLogoKeys.size} brand logos`);

	// -----------------------------------------------------------------------
	// Step 3: Download + upload product images
	// -----------------------------------------------------------------------
	console.log("▶ Step 3: Downloading and uploading product images…");
	const productImageKeys = new Map<string, string[]>();
	let imgSucceeded = 0, imgFailed = 0;

	await withConcurrencyLimit(selectedProducts, IMAGE_CONCURRENCY, async (sel, i) => {
		const key = makeS3Key(DEMO_MEDIA_PREFIX, seedId, "products", `${sel.demoSku}-image-01.webp`);
		const result = await uploadDownloadedImage(
			sel.imageUrl,
			key,
			"product",
			sel.demoSku,
			`product-${sel.source.id}`,
			"dummyjson",
			"dev-staging-only — verify before redistribution",
		);
		if (result) {
			productImageKeys.set(sel.demoSku, [result]);
			imgSucceeded++;
		} else {
			productImageKeys.set(sel.demoSku, []);
			imgFailed++;
		}
	});
	console.log(`  Product images: ${imgSucceeded} uploaded, ${imgFailed} failed`);

	// -----------------------------------------------------------------------
	// Step 4: Download + upload customer avatars
	// -----------------------------------------------------------------------
	console.log("▶ Step 4: Uploading customer avatars…");
	const customerAvatarKeys = new Map<number, string>();
	let avatarSucceeded = 0;

	await withConcurrencyLimit(
		portraitResults.slice(0, 55),
		IMAGE_CONCURRENCY,
		async (portrait, i) => {
			const portraitUrl = portrait.picture.large;
			const key = makeS3Key(DEMO_MEDIA_PREFIX, seedId, "customers", `customer-${String(i + 1).padStart(3, "0")}-avatar.webp`);
			const result = await uploadDownloadedImage(
				portraitUrl,
				key,
				"customer",
				`customer-${i}`,
				`portrait-${i}`,
				"randomuser.me",
				"dev-demo-only — randomuser.me/documentation — verify terms before redistribution",
			);
			if (result) {
				customerAvatarKeys.set(i, result);
				avatarSucceeded++;
			}
		},
	);
	console.log(`  Customer avatars: ${avatarSucceeded} uploaded`);

	// Admin avatar (first portrait)
	let adminAvatarKey: string | undefined;
	if (portraitResults.length > 55) {
		const portrait = portraitResults[55]!;
		const key = makeS3Key(DEMO_MEDIA_PREFIX, seedId, "users", "admin-avatar.webp");
		const result = await uploadDownloadedImage(portrait.picture.large, key, "user", "admin", "portrait-admin", "randomuser.me", "dev-demo-only");
		if (result) adminAvatarKey = result;
	}

	// -----------------------------------------------------------------------
	// Step 5: Create company + admin user
	// -----------------------------------------------------------------------
	console.log("▶ Step 5: Creating company and admin user…");
	const { company, user } = await getOrCreateDemoCompany(prisma, companyLogoKey);
	console.log(`  Company: ${company.name} (${company.id})`);
	console.log(`  Admin:   ${user.email}`);

	// Update admin profile image
	if (adminAvatarKey) {
		await prisma.user.update({ where: { id: user.id }, data: { profileImageKey: adminAvatarKey } });
	}

	// -----------------------------------------------------------------------
	// Step 6: Suppliers
	// -----------------------------------------------------------------------
	console.log("▶ Step 6: Seeding suppliers…");
	const supplierIds = await seedSuppliers(prisma, company.id, fakerSeed);

	// -----------------------------------------------------------------------
	// Step 7: Customers
	// -----------------------------------------------------------------------
	console.log("▶ Step 7: Seeding customers…");
	const { customers, walkIn } = await seedCustomers(prisma, company.id, customerAvatarKeys, fakerSeed);

	// -----------------------------------------------------------------------
	// Step 8: Catalog (categories, brands, products)
	// -----------------------------------------------------------------------
	console.log("▶ Step 8: Seeding catalog…");
	const catalog = await seedCatalog(
		prisma,
		company.id,
		selectedProducts,
		supplierIds,
		categoryLogoKeys,
		brandLogoKeys,
		productImageKeys,
		prng,
	);

	// -----------------------------------------------------------------------
	// Step 9: Opening inventory
	// -----------------------------------------------------------------------
	console.log("▶ Step 9: Seeding opening inventory…");
	const stockMap = new Map<string, number>();
	const productStocks = await seedOpeningInventory(
		prisma,
		company.id,
		user.id,
		catalog.products,
		supplierIds,
		prng,
	);
	for (const ps of productStocks) {
		stockMap.set(ps.id, ps.stockQuantity);
	}

	// -----------------------------------------------------------------------
	// Step 10: Ongoing purchases
	// -----------------------------------------------------------------------
	console.log("▶ Step 10: Seeding purchase orders…");
	await seedPurchases(prisma, company.id, user.id, productStocks, supplierIds, stockMap, prng);

	// -----------------------------------------------------------------------
	// Step 11: Sales
	// -----------------------------------------------------------------------
	console.log("▶ Step 11: Seeding sales…");
	const saleRows = await seedSales(
		prisma,
		company.id,
		user.id,
		productStocks,
		customers,
		walkIn,
		stockMap,
		prng,
	);

	// -----------------------------------------------------------------------
	// Step 12: Customer payments
	// -----------------------------------------------------------------------
	console.log("▶ Step 12: Seeding customer payments…");
	await seedCustomerPayments(prisma, company.id, user.id, saleRows, prng);

	// -----------------------------------------------------------------------
	// Step 13: Returns
	// -----------------------------------------------------------------------
	console.log("▶ Step 13: Seeding returns…");
	await seedReturns(prisma, company.id, user.id, saleRows, stockMap, prng);

	// -----------------------------------------------------------------------
	// Step 14: Expenses
	// -----------------------------------------------------------------------
	console.log("▶ Step 14: Seeding expenses…");
	await seedExpenses(prisma, company.id, user.id, prng);

	// -----------------------------------------------------------------------
	// Step 15: Validation
	// -----------------------------------------------------------------------
	console.log("▶ Step 15: Validating seeded data…");
	const errors = await validateSeedData(prisma, company.id);

	if (errors.length > 0) {
		console.error(`\n[VALIDATION] ${errors.length} invariant(s) violated:`);
		for (const err of errors) {
			console.error(`  ✗ ${err.invariant} | ${err.entity}(${err.entityId}): expected=${err.expected} actual=${err.actual}`);
		}
	} else {
		console.log("  ✓ All invariants passed");
	}

	// -----------------------------------------------------------------------
	// Summary
	// -----------------------------------------------------------------------
	const [
		saleCount, productCount, categoryCount, brandCount, supplierCount,
		customerCount, purchaseCount, returnCount, expenseCount,
		inventoryMovCount, saleItemCount, customerPaymentCount, supplierPaymentCount,
	] = await Promise.all([
		prisma.sale.count({ where: { companyId: company.id } }),
		prisma.product.count({ where: { companyId: company.id } }),
		prisma.category.count({ where: { companyId: company.id } }),
		prisma.brand.count({ where: { companyId: company.id } }),
		prisma.supplier.count({ where: { companyId: company.id } }),
		prisma.customer.count({ where: { companyId: company.id } }),
		prisma.purchaseOrder.count({ where: { companyId: company.id } }),
		prisma.return.count({ where: { companyId: company.id } }),
		prisma.expense.count({ where: { companyId: company.id } }),
		prisma.inventoryMovement.count({ where: { companyId: company.id } }),
		prisma.saleItem.count({ where: { sale: { companyId: company.id } } }),
		prisma.customerPayment.count({ where: { companyId: company.id } }),
		prisma.supplierPayment.count({ where: { companyId: company.id } }),
	]);

	console.log("\n" + "=".repeat(60));
	console.log("SEED COMPLETE — DemoMart Retail");
	console.log("=".repeat(60));
	console.log(`  Company ID:          ${company.id}`);
	console.log(`  Admin login email:   ${user.email}`);
	console.log(`  Admin password:      ${DEMO_ADMIN_PASSWORD}`);
	console.log();
	console.log("  Entity counts:");
	console.log(`    Categories:          ${categoryCount}`);
	console.log(`    Brands:              ${brandCount}`);
	console.log(`    Suppliers:           ${supplierCount}`);
	console.log(`    Products:            ${productCount}`);
	console.log(`    Customers:           ${customerCount}`);
	console.log(`    Sales:               ${saleCount}`);
	console.log(`    Sale items:          ${saleItemCount}`);
	console.log(`    Purchase orders:     ${purchaseCount}`);
	console.log(`    Supplier payments:   ${supplierPaymentCount}`);
	console.log(`    Customer payments:   ${customerPaymentCount}`);
	console.log(`    Returns:             ${returnCount}`);
	console.log(`    Expenses:            ${expenseCount}`);
	console.log(`    Inventory movements: ${inventoryMovCount}`);
	console.log();
	console.log(`  Image uploads:       ${imgSucceeded} product + ${avatarSucceeded} avatar`);
	console.log(`  Image failures:      ${imgFailed}`);
	console.log(`  Validation errors:   ${errors.length}`);
	console.log();
	console.log("  Licensing note: DummyJSON images and RandomUser.me portraits");
	console.log("  are for DEVELOPMENT/STAGING use only. Verify redistribution");
	console.log("  rights before any public deployment.");
	console.log("=".repeat(60));
}

main()
	.catch((error: unknown) => {
		console.error("[seed-demo] Fatal error:", error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
