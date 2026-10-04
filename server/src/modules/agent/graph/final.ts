import { createOpenRouterClient } from "../client/openRouterClient";
import type { Plan } from "../schemas";
import { finalSystemPrompt } from "../prompts/final";

import type { AgentPerfTracker } from "../utils/perfLogger";

export const createFinalResponse = async (
	request: string,
	plan: Plan,
	stepResults: Record<string, unknown>,
	history: Array<{ role: string; content: string }> = [],
	onChunk?: (chunk: string) => void,
	tracker?: AgentPerfTracker,
	signal?: AbortSignal
) => {
	const historyContext = history.length > 0
		? history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")
		: "No previous messages.";

	const messages = [
		{ role: "system" as const, content: finalSystemPrompt },
		{ role: "user" as const, content: JSON.stringify({ currentRequest: request, conversationHistory: historyContext, plan, stepResults }) },
	];

	if (onChunk) {
		return createOpenRouterClient().stream(messages, onChunk, tracker, signal);
	}
	return createOpenRouterClient().invoke(messages, tracker, signal);
};

