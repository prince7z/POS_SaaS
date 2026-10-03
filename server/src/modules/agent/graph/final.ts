import { createOpenRouterClient } from "../client/openRouterClient";
import type { Plan } from "../schemas";
import { finalSystemPrompt } from "../prompts/final";

export const createFinalResponse = async (request: string, plan: Plan, stepResults: Record<string, unknown>) => {
	const result = await createOpenRouterClient().invoke([
		{ role: "system", content: finalSystemPrompt },
		{ role: "user", content: JSON.stringify({ request, plan, stepResults }) },
	]);
	return result;
};
