import "dotenv/config";
import assert from "node:assert/strict";

type Check = { name: string; passed: boolean };
type LlmRequest = { messages: Array<{ role: string; content: string }> };

const scenarioPrompt = (from: string, to: string) =>
	`For Takealot sales from ${from} through ${to}, report gross revenue, Takealot-reported total fees, and estimated merchandise profit. Use Takealot data only, and explain when profit data is unavailable.`;

const formatLocalDate = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const parseOption = (name: string): string | undefined => {
	const prefix = `--${name}=`;
	const args = process.argv.slice(2);
	const equalsValue = args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
	if (equalsValue) return equalsValue;
	const optionIndex = args.indexOf(`--${name}`);
	return optionIndex >= 0 ? args[optionIndex + 1] : undefined;
};

const report = {
	status: "RUNNING",
	mode: "Live planner and Takealot service; final response synthesis is mocked to keep account data local",
	prompt: "",
	checks: [] as Check[],
	summary: {
		plannerCalls: 0,
		takealotServiceCalls: 0,
		finalStageCalls: 0,
		revenueAvailable: false,
		feesAvailable: false,
		profitAvailable: false,
	},
	failure: undefined as string | undefined,
};

const recordCheck = (name: string, passed: boolean) => {
	report.checks.push({ name, passed });
	assert.ok(passed, name);
};

const main = async () => {
	const userId = parseOption("user-id") ?? process.env.TAKEALOT_TEST_USER_ID;
	if (!userId) {
		throw new Error("Set TAKEALOT_TEST_USER_ID or pass --user-id <uuid> for the authorized test account.");
	}
	const requestedCompanyId = parseOption("company-id") ?? process.env.TAKEALOT_TEST_COMPANY_ID;
	const openRouterApiKey = process.env.OPENROUTER_API_KEY;
	if (!openRouterApiKey) {
		throw new Error("OPENROUTER_API_KEY is not configured; no live planner request was made.");
	}

	const to = new Date();
	const from = new Date(to);
	from.setDate(from.getDate() - 6);
	const fromDate = formatLocalDate(from);
	const toDate = formatLocalDate(to);
	report.prompt = scenarioPrompt(fromDate, toDate);

	const [{ prisma }, { Access }] = await Promise.all([
		import("../src/lib/prisma"),
		import("@prisma/client"),
	]);
	const memberships = await prisma.companyUser.findMany({
		where: { userId, isActive: true, deletedAt: null },
		select: { companyId: true, accesses: true },
	});
	const eligibleMemberships = memberships.filter((membership) =>
		membership.accesses.includes(Access.TAKEALOT) &&
		(!requestedCompanyId || membership.companyId === requestedCompanyId),
	);
	recordCheck("Authorized account has Takealot access", eligibleMemberships.length > 0);
	if (eligibleMemberships.length !== 1) {
		throw new Error("Specify --company-id when the account has zero or multiple eligible Takealot company memberships.");
	}
	const membership = eligibleMemberships[0];
	const permissions = membership.accesses.map(String);
	const user = {
		id: userId,
		companyId: membership.companyId,
		permissions,
		userName: "Takealot smoke-test user",
		companyName: "Authorized smoke-test company",
		companyLogoUrl: null,
	};

	const productModel = prisma.product as unknown as {
		findMany: typeof prisma.product.findMany;
	};
	const originalProductFindMany = productModel.findMany;
	const originalFetch = globalThis.fetch;
	const llmRequestBodies: LlmRequest[] = [];
	let selectedSummaryStepId = "";
	let finalStageReceivedSummary = false;
	let finalStageHasTakealotGuidance = false;

	globalThis.fetch = async (input, init) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		if (url.hostname === "openrouter.ai") {
			const body = JSON.parse(String(init?.body)) as LlmRequest;
			llmRequestBodies.push(body);
			const userMessage = body.messages.find((message) => message.role === "user");
			assert.ok(userMessage, "The agent did not send a user message to the model.");
			const context = JSON.parse(userMessage.content) as Record<string, unknown>;

			if ("availableTools" in context) {
				report.summary.plannerCalls++;
				return originalFetch(input, init);
			}

			report.summary.finalStageCalls++;
			const stepResults = context.stepResults as Record<string, {
				success?: boolean;
				data?: { revenue?: number; totalFee?: number | null; profit?: number | null };
			}>;
			const result = stepResults[selectedSummaryStepId];
			finalStageReceivedSummary = Boolean(result?.success && result.data);
			const finalPrompt = body.messages.find((message) => message.role === "system")?.content ?? "";
			finalStageHasTakealotGuidance = finalPrompt.includes("TAKEALOT REPORTING");
			if (!result?.data) {
				return Response.json({
					choices: [{ finish_reason: "stop", message: { content: "Takealot summary was unavailable." } }],
				});
			}
			report.summary.revenueAvailable = Number.isFinite(result.data.revenue);
			report.summary.feesAvailable = result.data.totalFee !== null && Number.isFinite(result.data.totalFee);
			report.summary.profitAvailable = result.data.profit !== null && Number.isFinite(result.data.profit);
			const answer =
				`Takealot gross revenue: R${result.data.revenue?.toFixed(2)}. ` +
				`Takealot-reported fees: ${result.data.totalFee === null ? "unavailable" : `R${result.data.totalFee.toFixed(2)}`}. ` +
				`Estimated merchandise profit: ${result.data.profit === null ? "unavailable" : `R${result.data.profit.toFixed(2)}`}.`;
			return Response.json({
				choices: [{ finish_reason: "stop", message: { content: answer } }],
			});
		}

		if (url.hostname === "seller-api.takealot.com") {
			report.summary.takealotServiceCalls++;
			return originalFetch(input, init);
		}

		throw new Error(`Unexpected network destination during live check: ${url.hostname}`);
	};

	try {
		const { createPlan } = await import("../src/modules/agent/graph/planner");
		const plan = await createPlan(report.prompt, user, []);
		const toolSteps = plan.steps.filter((step) => step.type === "tool");
		const summaryStep = toolSteps.find((step) =>
			step.type === "tool" &&
			step.tool === "takealot_tool" &&
			step.operation === "sales_summary",
		);
		recordCheck("Live planner selected takealot_tool:sales_summary", Boolean(summaryStep));
		assert.ok(summaryStep, "Planner did not select the Takealot date-range summary operation.");
		recordCheck(
			"Planner used the requested date range",
			summaryStep.args.from === fromDate && summaryStep.args.to === toDate,
		);
		selectedSummaryStepId = summaryStep.id;

		const { executeTakealotTool } = await import("../src/modules/agent/graph/takealotTool");
		const summaryData = await executeTakealotTool(membership.companyId, summaryStep.operation, summaryStep.args) as {
			revenue?: number;
			totalFee?: number | null;
			profit?: number | null;
		};
		const stepResult = { success: true, data: summaryData };
		const stepResults = { [summaryStep.id]: stepResult };
		recordCheck("Takealot service completed successfully", stepResult.success);
		recordCheck("Takealot revenue was returned", Number.isFinite(summaryData.revenue));
		recordCheck("Takealot reported-fee field was returned", "totalFee" in summaryData);

		const { createFinalResponse } = await import("../src/modules/agent/graph/final");
		const finalResponse = await createFinalResponse(report.prompt, plan, stepResults);
		recordCheck("Final stage received the executed Takealot summary", finalStageReceivedSummary);
		recordCheck("Final stage includes Takealot-specific reporting guidance", finalStageHasTakealotGuidance);
		recordCheck("Final response stage produced a non-empty answer", finalResponse.trim().length > 0);
		recordCheck(
			"Final answer contains returned revenue",
			summaryData.revenue === undefined || finalResponse.includes(`R${summaryData.revenue.toFixed(2)}`),
		);
		recordCheck("Planner and final stages both ran", report.summary.plannerCalls > 0 && report.summary.finalStageCalls === 1);
	} finally {
		globalThis.fetch = originalFetch;
		productModel.findMany = originalProductFindMany;
		await prisma.$disconnect();
	}
};

main()
	.then(() => {
		report.status = "PASS";
		console.log(JSON.stringify(report, null, 2));
	})
	.catch((error: unknown) => {
		report.status = "FAIL";
		report.failure = error instanceof Error ? error.message : "Unexpected smoke-test failure";
		console.error(JSON.stringify(report, null, 2));
		process.exitCode = 1;
	});
