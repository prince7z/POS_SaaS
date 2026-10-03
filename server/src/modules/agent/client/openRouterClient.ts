import { env } from "../../../config/env";

const OPEN_ROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

type ChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

type OpenRouterResponse = {
	choices?: Array<{
		finish_reason?: string;
		message?: {
			content?: unknown;
		};
	}>;
	error?: {
		message?: string;
	};
};

const request = async (messages: ChatMessage[], responseFormat?: "json_object") => {
	if (!env.agent.openRouterApiKey) {
		throw new Error("Agent model is not configured");
	}

	let lastFailure = "OpenRouter returned an empty response";
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const response = await fetch(OPEN_ROUTER_BASE_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.agent.openRouterApiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": env.agent.siteUrl,
				"X-Title": env.agent.siteName,
			},
			body: JSON.stringify({
				model: env.agent.model,
				messages,
				temperature: 0,
				max_tokens: 4000,
				reasoning: { exclude: true },
				...(responseFormat ? { response_format: { type: responseFormat } } : {}),
			}),
		});

		const payload = (await response.json()) as OpenRouterResponse;
		if (!response.ok) {
			throw new Error(payload.error?.message ?? "OpenRouter request failed");
		}

		const choice = payload.choices?.[0];
		const rawContent = choice?.message?.content;
		const content = typeof rawContent === "string"
			? rawContent
			: Array.isArray(rawContent)
				? rawContent
					.map((part) => typeof part === "object" && part !== null && "text" in part ? String(part.text) : "")
					.join("")
				: "";
		if (content.trim()) return content;
		lastFailure = `OpenRouter returned no text content (finish reason: ${choice?.finish_reason ?? "unknown"})`;
	}
	throw new Error(lastFailure);
};

export const createOpenRouterClient = () => ({
	invoke: (messages: ChatMessage[]) => request(messages),
	invokeJson: (messages: ChatMessage[]) => request(messages, "json_object"),
});
