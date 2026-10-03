import { createOpenRouterClient } from "../client/openRouterClient";
import { planSchema, type AgentUser, type Plan } from "../schemas";
import { plannerSystemPrompt } from "../prompts/planner";
import { agentToolRegistry } from "../registry";

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

export const createPlan = async (request: string, user: AgentUser): Promise<Plan> => {
	const availableTools = plannerToolCatalog(user.permissions);
	const content = await createOpenRouterClient().invokeJson([
		{ role: "system", content: `${plannerSystemPrompt}
Return JSON with exactly this shape:
{"steps":[{"id":"step_1","type":"tool","tool":"finance_tool","operation":"list_expenses","args":{},"description":"List expenses","dependsOn":[]},{"id":"step_2","type":"final","description":"Summarize the tool result","dependsOn":["step_1"]}]}
Tool steps require tool, operation, args, and description. Human-input steps require request with type and question.` },
		{
			role: "user",
			content: JSON.stringify({
				request,
				availableTools,
				instruction: `Create an ordered plan using only the available tools. The server will enforce permissions.
For expense requests, use finance_tool. Use list_expenses for "what/recent/show/list expenses"; use expense_summary for totals or counts;
use expense_analytics for trends or category breakdowns; use pnl_dashboard when the request asks about profit or loss.
Expense list args are optional and may include page, limit, search, category, from, to, sortBy, and sortOrder.
Date filters must use YYYY-MM-DD. Always execute a matching tool step before the final step; do not answer that a capability is unavailable when it is listed.`,
			}),
		},
	]);
	const normalized = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
	try {
		const parsed: unknown = JSON.parse(normalized);
		if (typeof parsed === "object" && parsed !== null && "steps" in parsed && Array.isArray(parsed.steps)) {
			for (const step of parsed.steps) {
				if (typeof step === "object" && step !== null && "type" in step && step.type === "human-input") {
					step.type = "human_input";
				}
				if (typeof step === "object" && step !== null && "request" in step && typeof step.request === "object" && step.request !== null && "type" in step.request && step.request.type === "text") {
					step.request.type = "question";
				}
			}
		}
		const candidate =
			typeof parsed === "object" &&
			parsed !== null &&
			"id" in parsed &&
			"type" in parsed &&
			"description" in parsed
				? { steps: [parsed] }
				: parsed;
		return planSchema.parse(candidate);
	} catch {
		throw new Error(`Planner returned an invalid plan: ${normalized.slice(0, 500)}`);
	}
};
