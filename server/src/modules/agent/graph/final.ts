import { createOpenRouterClient } from "../client/openRouterClient";
import type { Plan } from "../schemas";
import { finalSystemPrompt } from "../prompts/final";

export const createFinalResponse = async (
	request: string,
	plan: Plan,
	stepResults: Record<string, unknown>,
	onChunk?: (chunk: string) => void
) => {
	const messages = [
		{ role: "system" as const, content: finalSystemPrompt },
		{ role: "user" as const, content: JSON.stringify({ request, plan, stepResults }) },
	];

	if (onChunk) {
		return createOpenRouterClient().stream(messages, onChunk);
	}
	return createOpenRouterClient().invoke(messages);
};

