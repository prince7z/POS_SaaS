import { createOpenRouterClient } from "../client/openRouterClient";
import { planSchema, type AgentUser, type Plan } from "../schemas";
import { plannerSystemPrompt } from "../prompts/planner";
import { agentToolRegistry } from "../registry";
import { logger } from "../../../lib/logger";
import { logDetailedAgentError } from "../utils/errorPrinter";

const plannerToolCatalog = (permissions: string[]) =>
	agentToolRegistry
		.map((tool) => {
			const operations = tool.operations.filter((operation) => {
				const requiredAccess = tool.requiredAccessByOperation[operation];
				return !requiredAccess || permissions.includes(requiredAccess);
			});
			return operations.length ? {
				tool: tool.name,
				description: tool.description,
				operations,
			} : null;
		})
		.filter((tool): tool is NonNullable<typeof tool> => tool !== null);

import type { AgentPerfTracker } from "../utils/perfLogger";

export const createPlan = async (
	request: string,
	user: AgentUser,
	history: Array<{ role: string; content: string }> = [],
	tracker?: AgentPerfTracker
): Promise<Plan> => {
	const availableTools = plannerToolCatalog(user.permissions);
	const historyContext = history.length > 0
		? history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")
		: "No previous messages.";

	const messages = [
		{
			role: "system" as const,
			content: `${plannerSystemPrompt}
Return JSON with exactly this shape:
{"steps":[{"id":"step_1","type":"human_input","request":{"type":"question","question":"Which period would you like to analyze?","options":[{"id":"30d","label":"Last 30 days","value":"30d"},{"id":"90d","label":"Last 90 days","value":"90d"}],"allowOther":true},"description":"Clarify period","dependsOn":[]},{"id":"step_2","type":"final","description":"Finalize response","dependsOn":["step_1"]}]}`,
		},
		{
			role: "user" as const,
			content: JSON.stringify({
				currentRequest: request,
				conversationHistory: historyContext,
				availableTools,
				userContext: {
					userName: user.userName || "Store Manager",
					companyName: user.companyName || "Jcom",
					companyLogoUrl: user.companyLogoUrl || null,
				},
				instruction: `Create an ordered plan using only available tools or human_input/final steps. Take previous conversation history into full account to understand context.
For expense requests, use finance_tool. Use list_expenses for "what/recent/show/list expenses"; use expense_summary for totals or counts;
use expense_analytics for trends or category breakdowns; use pnl_dashboard when the request asks about profit or loss.
Date filters must use YYYY-MM-DD. Always include a final step.`,
			}),
		},
	];

	const content = await createOpenRouterClient().invokeJson(
		messages,
		tracker,
		undefined,
		{
			nodeName: "planner",
			state: {
				request,
				user: { id: user.id, companyId: user.companyId, permissionsCount: user.permissions.length },
				historyCount: history.length,
				availableToolsCount: availableTools.length,
			},
		}
	);

	const normalized = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let parsed: any = JSON.parse(normalized);
		if (parsed && typeof parsed === "object") {
			if ("plan" in parsed && parsed.plan && typeof parsed.plan === "object") {
				parsed = parsed.plan;
			}
			if ("data" in parsed && parsed.data && typeof parsed.data === "object") {
				parsed = parsed.data;
			}
			if ("steps" in parsed && Array.isArray(parsed.steps)) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				parsed.steps = parsed.steps.map((step: any, idx: number) => {
					if (typeof step !== "object" || step === null) return step;

					const rawType = String(step.type || "").toLowerCase();

					if (
						rawType.includes("human") ||
						rawType.includes("input") ||
						rawType.includes("question") ||
						rawType.includes("clarification") ||
						"request" in step
					) {
						step.type = "human_input";
						const req = step.request && typeof step.request === "object" ? step.request : {};
						const q = req.question || step.question || step.description || "Please provide clarification.";
						const reqType = req.type ? String(req.type).toLowerCase() : "question";
						step.request = {
							type: reqType,
							question: q,
							options: req.options || step.options,
							allowOther: req.allowOther ?? step.allowOther ?? true,
						};
					} else if (rawType === "tool" || rawType === "action" || "tool" in step) {
						step.type = "tool";
						if (step.tool === "email_tool") {
							step.requiresConfirmation = false;
						}
					} else {
						step.type = "final";
					}

					if (!step.id) step.id = `step_${idx + 1}`;
					if (!Array.isArray(step.dependsOn)) step.dependsOn = [];
					if (!step.description || step.description === step.id || step.description.startsWith("step_")) {
						step.description = step.operation
							? `Execute ${step.operation.replace(/_/g, " ")}`
							: step.tool
							? `Execute ${step.tool.replace(/_/g, " ")}`
							: `Process step ${idx + 1}`;
					}

					return step;
				});
			}
		}

		const candidate =
			typeof parsed === "object" && parsed !== null && "id" in parsed && "type" in parsed && "description" in parsed
				? { steps: [parsed] }
				: parsed;

		return planSchema.parse(candidate);
	} catch (err: unknown) {
		const formatted = logDetailedAgentError("Planner Validation Failed", err, {
			rawOutput: normalized.slice(0, 1000),
			userRequest: request,
		}, tracker);
		throw new Error(`Planner returned an invalid plan: ${formatted.summary}`);
	}
};
