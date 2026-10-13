import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { prisma } from "../lib/prisma";

const companyId = "a2b8e672-7f09-4783-81ba-51a572205b71";
const confirmationFlag = "--confirm-company-id";
const execute = process.argv.includes("--execute");

interface SourceCategory {
	id: string;
	name: string;
	description: string | null;
	parentId: string | null;
	isActive: boolean;
}

interface SeedCategory extends SourceCategory {
	depth: number;
}

async function loadCategories(): Promise<SeedCategory[]> {
	const json = await readFile(join(__dirname, "Category.json"), "utf8");
	const source = JSON.parse(json) as SourceCategory[];
	if (!Array.isArray(source) || source.length === 0) {
		throw new Error("Category.json must contain a non-empty array.");
	}

	const sourceById = new Map<string, SourceCategory>();
	const siblingNames = new Set<string>();

	for (const category of source) {
		if (
			!category.id ||
			!category.name?.trim() ||
			typeof category.isActive !== "boolean" ||
			(category.parentId !== null && typeof category.parentId !== "string")
		) {
			throw new Error("Category.json contains a record without a valid id, name, status, or parent id.");
		}
		if (sourceById.has(category.id)) {
			throw new Error(`Category.json contains duplicate id ${category.id}.`);
		}
		const siblingKey = `${category.parentId ?? "<ROOT>"}\0${category.name.trim()}`;
		if (siblingNames.has(siblingKey)) {
			throw new Error(`Category.json contains duplicate sibling category "${category.name.trim()}".`);
		}
		siblingNames.add(siblingKey);
		sourceById.set(category.id, category);
	}

	for (const category of source) {
		if (category.parentId !== null && !sourceById.has(category.parentId)) {
			throw new Error(`Category "${category.name}" refers to missing parent ${category.parentId}.`);
		}
	}

	const pending = new Set(sourceById.keys());
	const ordered: SeedCategory[] = [];
	const depthById = new Map<string, number>();
	while (pending.size > 0) {
		let addedInPass = false;
		for (const id of pending) {
			const category = sourceById.get(id)!;
			if (category.parentId !== null && pending.has(category.parentId)) continue;
			const depth = category.parentId === null ? 0 : depthById.get(category.parentId)! + 1;
			depthById.set(id, depth);
			ordered.push({ ...category, depth });
			pending.delete(id);
			addedInPass = true;
		}
		if (!addedInPass) throw new Error("Category.json contains a parent cycle.");
	}

	return ordered;
}

async function main() {
	const confirmationIndex = process.argv.indexOf(confirmationFlag);
	const confirmationArgument = process.argv.find((argument) => argument.startsWith(`${confirmationFlag}=`));
	const confirmedCompanyId =
		confirmationIndex >= 0
			? process.argv[confirmationIndex + 1]
			: confirmationArgument?.slice(confirmationFlag.length + 1) ?? null;
	if (execute && confirmedCompanyId !== companyId) {
		throw new Error(
			`Execution requires: npx --no-install tsx src/scripts/reset-company-store.ts --execute ${confirmationFlag} ${companyId}`,
		);
	}

	const company = await prisma.company.findUnique({
		where: { id: companyId },
		select: { id: true, name: true },
	});
	if (!company) throw new Error(`Company ${companyId} was not found; nothing was changed.`);

	const categories = await loadCategories();
	const [currentCategories, linkedProducts] = await Promise.all([
		prisma.category.count({ where: { companyId } }),
		prisma.product.count({ where: { companyId } }),
	]);
	const roots = categories.filter((category) => category.parentId === null).length;

	console.log(`Company: ${company.name} (${company.id})`);
	console.log(
		`Category.json: ${categories.length} records, ${roots} roots, ${new Set(categories.map((category) => category.name)).size} unique names; parent links validated.`,
	);
	console.log(`Existing company categories to replace: ${currentCategories}`);
	console.log(`Products currently linked to company categories: ${linkedProducts}`);
	console.log("No products or other business records will be deleted.");

	if (!execute) {
		console.log(
			`Dry run only. To replace categories, run: npx --no-install tsx src/scripts/reset-company-store.ts --execute ${confirmationFlag} ${companyId}`,
		);
		return;
	}

	const result = await prisma.$transaction(
		async (tx) => {
			const linkedProductCount = await tx.product.count({ where: { companyId } });
			if (linkedProductCount > 0) {
				throw new Error(
					`Cannot replace categories because ${linkedProductCount} products are still linked to them. No data was changed.`,
				);
			}

			const conflictingIds = await tx.category.findMany({
				where: { id: { in: categories.map((category) => category.id) }, companyId: { not: companyId } },
				select: { id: true },
				take: 1,
			});
			if (conflictingIds.length > 0) {
				throw new Error(
					`Category ID ${conflictingIds[0].id} already belongs to another company. No data was changed.`,
				);
			}

			await tx.category.updateMany({ where: { companyId }, data: { parentId: null } });
			await tx.category.deleteMany({ where: { companyId } });

			const categoriesByDepth = new Map<number, SeedCategory[]>();
			for (const category of categories) {
				const level = categoriesByDepth.get(category.depth) ?? [];
				level.push(category);
				categoriesByDepth.set(category.depth, level);
			}
			for (const level of categoriesByDepth.values()) {
				await tx.category.createMany({
					data: level.map((category) => ({
						id: category.id,
						companyId,
						parentId: category.parentId,
						name: category.name.trim(),
						description: category.description,
						isActive: category.isActive,
					})),
				});
			}

			return categories.length;
		},
		{ maxWait: 15000, timeout: 120000 },
	);

	const imported = await prisma.category.findMany({
		where: { companyId },
		select: { id: true, name: true, parentId: true, isActive: true },
	});
	const importedById = new Map(imported.map((category) => [category.id, category]));
	const mismatches = categories.filter((category) => {
		const saved = importedById.get(category.id);
		return (
			!saved ||
			saved.name !== category.name.trim() ||
			saved.parentId !== category.parentId ||
			saved.isActive !== category.isActive
		);
	});
	if (imported.length !== result || mismatches.length > 0) {
		throw new Error(
			`Post-import verification failed: expected ${result} category records, found ${imported.length}, with ${mismatches.length} mismatches.`,
		);
	}

	console.log(`Category replacement completed and verified: all ${result} records and parent links imported.`);
}

main()
	.catch((error: unknown) => {
		console.error("Category replacement failed:", error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
