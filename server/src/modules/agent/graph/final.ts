import { createOpenRouterClient } from "../client/openRouterClient";
import type { Plan } from "../schemas";
import { finalSystemPrompt } from "../prompts/final";

import type { AgentPerfTracker } from "../utils/perfLogger";

export const createFinalResponse = async (
	request: string,
	plan: Plan,
	stepResults: Record<string, unknown>,
	onChunk?: (chunk: string) => void,
	tracker?: AgentPerfTracker,
	signal?: AbortSignal
) => {
	const messages = [
		{ role: "system" as const, content: finalSystemPrompt },
		{ role: "user" as const, content: JSON.stringify({ request, plan, stepResults }) },
	];

	if (onChunk) {
		return createOpenRouterClient().stream(messages, onChunk, tracker, signal);
	}
	return createOpenRouterClient().invoke(messages, tracker, signal);
};

