import { createOpenRouterClient } from "../client/openRouterClient";
import type { Plan } from "../schemas";
import { finalSystemPrompt } from "../prompts/final";

export const createFinalResponse = async (request: string, plan: Plan, stepResults: Record<string, unknown>) => {
	const model = createOpenRouterClient();
	const result = await model.invoke([
		{ role: "system", content: finalSystemPrompt },
		{ role: "user", content: JSON.stringify({ request, plan, stepResults }) },
	]);
	return typeof result.content === "string" ? result.content : JSON.stringify(result.content);
};
