import "dotenv/config";
import { prisma } from "../lib/prisma";

async function runBenchmark() {
	console.log("\n================================================================================");
	console.log("DATABASE LATENCY & COLD-START BENCHMARK TEST");
	console.log("================================================================================\n");

	// Step 1: Find any valid user to run queries against
	const sampleUser = await prisma.user.findFirst({
		select: { id: true, companyId: true },
	});

	if (!sampleUser) {
		console.log("No user record found in DB to benchmark against.");
		process.exit(1);
	}

	const { id: userId, companyId } = sampleUser;
	console.log(`Benchmarking with User ID: ${userId}, Company ID: ${companyId}\n`);

	// TEST A: First Request (Cold Connection / Initial Handshake)
	const tA1 = performance.now();
	const user1 = await prisma.user.findFirst({
		where: { id: userId, companyId, isActive: true, deletedAt: null },
		select: { id: true, companyId: true, accesses: true },
	});
	const durationA1 = Math.round((performance.now() - tA1) * 100) / 100;
	console.log(`[TEST A - Request 1 (First/Cold Query)] user.findFirst : ${durationA1}ms`);

	// TEST B: Immediate Second Request (Warm Pool Socket)
	const tB1 = performance.now();
	const user2 = await prisma.user.findFirst({
		where: { id: userId, companyId, isActive: true, deletedAt: null },
		select: { id: true, companyId: true, accesses: true },
	});
	const durationB1 = Math.round((performance.now() - tB1) * 100) / 100;
	console.log(`[TEST B - Request 2 (Immediate Warm)]   user.findFirst : ${durationB1}ms`);

	// TEST C: Third Request (Warm Pool Socket)
	const tC1 = performance.now();
	const user3 = await prisma.user.findFirst({
		where: { id: userId, companyId, isActive: true, deletedAt: null },
		select: { id: true, companyId: true, accesses: true },
	});
	const durationC1 = Math.round((performance.now() - tC1) * 100) / 100;
	console.log(`[TEST C - Request 3 (Immediate Warm)]   user.findFirst : ${durationC1}ms\n`);

	// TEST Conversation Query (First vs Second)
	const tConv1 = performance.now();
	await prisma.agentConversation.findFirst({
		where: { userId, companyId },
	});
	const durationConv1 = Math.round((performance.now() - tConv1) * 100) / 100;

	const tConv2 = performance.now();
	await prisma.agentConversation.findFirst({
		where: { userId, companyId },
	});
	const durationConv2 = Math.round((performance.now() - tConv2) * 100) / 100;

	console.log(`[CONVERSATION QUERY] Request 1: ${durationConv1}ms | Request 2 (Warm): ${durationConv2}ms\n`);

	console.log("================================================================================");
	console.log("SUMMARY OF BENCHMARK RESULTS:");
	console.log("────────────────────────────────────────────────────────────────────────────────");
	console.log(`  Request 1 (Cold / First Handshake) : ${durationA1}ms`);
	console.log(`  Request 2 (Warm Socket / Immediate): ${durationB1}ms`);
	console.log(`  Request 3 (Warm Socket / Immediate): ${durationC1}ms`);
	console.log("────────────────────────────────────────────────────────────────────────────────");

	if (durationA1 > 500 && durationB1 < 100) {
		console.log("CONCLUSION: Extremely strong evidence of COLD CONNECTION / SSL / DB HANDSHAKE LATENCY.");
		console.log("Subsequent queries over the established socket take ~" + durationB1 + "ms.");
	} else if (durationB1 > 500) {
		console.log("CONCLUSION: PERSISTENT LATENCY DETECTED across queries (" + durationB1 + "ms).");
		console.log("Investigate: Network path, DB compute location, connection pool exhaustion, or SSL mode.");
	} else {
		console.log("CONCLUSION: Normal performance detected.");
	}
	console.log("================================================================================\n");

	await prisma.$disconnect();
	process.exit(0);
}

runBenchmark().catch((err) => {
	console.error("Benchmark error:", err);
	process.exit(1);
});
