import { env } from "../../../config/env";
import { AgentPerfTracker, estimateTokens } from "../utils/perfLogger";

const OPEN_ROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ChatMessage = {
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
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
	error?: {
		message?: string;
	};
};

function analyzeInputMessages(messages: ChatMessage[], stateObj?: Record<string, unknown>) {
	let systemPromptChars = 0;
	let userPromptChars = 0;
	let historyChars = 0;
	let stateChars = 0;
	let toolsChars = 0;
	let numToolCalls = 0;
	const toolNames: string[] = [];

	const messageBreakdown = messages.map((m) => {
		const len = (m.content || "").length;
		return {
			role: m.role,
			charCount: len,
			estTokens: estimateTokens(m.content),
		};
	});

	for (const msg of messages) {
		if (msg.role === "system") {
			systemPromptChars += (msg.content || "").length;
		} else if (msg.role === "user") {
			try {
				const parsed = JSON.parse(msg.content);
				if (typeof parsed === "object" && parsed !== null) {
					if (parsed.currentRequest || parsed.request) {
						userPromptChars += String(parsed.currentRequest || parsed.request).length;
					}
					if (parsed.conversationHistory) {
						historyChars += String(parsed.conversationHistory).length;
					}
					if (parsed.availableTools) {
						toolsChars += JSON.stringify(parsed.availableTools).length;
					}
					if (parsed.stepResults) {
						toolsChars += JSON.stringify(parsed.stepResults).length;
						const results = parsed.stepResults as Record<string, unknown>;
						numToolCalls = Object.keys(results).length;
						toolNames.push(...Object.keys(results));
					}
					if (parsed.plan) {
						stateChars += JSON.stringify(parsed.plan).length;
					}
				} else {
					userPromptChars += (msg.content || "").length;
				}
			} catch {
				userPromptChars += (msg.content || "").length;
			}
		}
	}

	const stateKeys = stateObj ? Object.keys(stateObj) : [];
	const stateSerialized = stateObj ? JSON.stringify(stateObj) : "";
	if (stateChars === 0 && stateObj) {
		stateChars = stateSerialized.length;
	}

	const stateFields = stateObj
		? Object.entries(stateObj).map(([k, v]) => ({
				name: k,
				type: Array.isArray(v) ? `array(${(v as unknown[]).length})` : typeof v,
				charCount: JSON.stringify(v ?? "").length,
				estTokens: estimateTokens(v),
		  }))
		: [];

	const totalInputChars = messages.reduce((acc, m) => acc + (m.content || "").length, 0);
	const totalInputTokens = estimateTokens(totalInputChars);

	return {
		systemPromptChars,
		systemPromptTokens: estimateTokens(systemPromptChars),
		userPromptChars,
		userPromptTokens: estimateTokens(userPromptChars),
		historyChars,
		historyTokens: estimateTokens(historyChars),
		stateChars,
		stateTokens: estimateTokens(stateChars),
		toolsChars,
		toolsTokens: estimateTokens(toolsChars),
		messageCount: messages.length,
		messageBreakdown,
		totalInputChars,
		totalInputTokens,
		stateKeys,
		stateFields,
		numToolCalls,
		toolNames,
		toolResultChars: toolsChars,
		toolResultTokens: estimateTokens(toolsChars),
	};
}

const request = async (
	messages: ChatMessage[],
	responseFormat?: "json_object",
	tracker?: AgentPerfTracker,
	signal?: AbortSignal,
	options?: { nodeName?: string; state?: Record<string, unknown> }
) => {
	if (!env.agent.openRouterApiKey) {
		throw new Error("Agent model is not configured");
	}

	const llmCallId = `llm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
	const node = options?.nodeName || "llm_node";
	const analyzed = analyzeInputMessages(messages, options?.state);

	const preStartPerf = performance.now();

	tracker?.logLLMPreRequest({
		llmCallId,
		node,
		model: env.agent.model,
		...analyzed,
	});

	tracker?.log({
		layer: "llm",
		module: "openRouterClient.ts",
		operation: `LLM start [${node}]`,
		llmCallId,
	});

	const fetchStartPerf = performance.now();
	let lastFailure = "OpenRouter returned an empty response";

	const candidateModels = Array.from(new Set([
		env.agent.model,
		"google/gemini-2.0-flash-lite-preview-02-05:free",
		"meta-llama/llama-3.3-70b-instruct:free",
		"qwen/qwen-2.5-72b-instruct:free",
		"openai/gpt-4o-mini",
	]));

	for (const modelToTry of candidateModels) {
		for (let attempt = 0; attempt < 2; attempt += 1) {
			try {
				const response = await fetch(OPEN_ROUTER_BASE_URL, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${env.agent.openRouterApiKey}`,
						"Content-Type": "application/json",
						"HTTP-Referer": env.agent.siteUrl,
						"X-Title": env.agent.siteName,
					},
					body: JSON.stringify({
						model: modelToTry,
						messages,
						temperature: 0,
						max_tokens: 4000,
						...(responseFormat ? { response_format: { type: responseFormat } } : {}),
					}),
					signal,
				});

				const fetchEndPerf = performance.now();
				const payload = (await response.json()) as OpenRouterResponse;
				if (!response.ok) {
					lastFailure = payload.error?.message ?? `OpenRouter request failed (${response.status})`;
					continue;
				}

				const choice = payload.choices?.[0];
				const msgObj = choice?.message as (Record<string, unknown> & { content?: unknown }) | undefined;
				const rawContent =
					msgObj?.content ??
					msgObj?.reasoning ??
					msgObj?.reasoning_content ??
					msgObj?.thinking ??
					(choice as (Record<string, unknown> & { text?: unknown }) | undefined)?.text;

				const content =
					typeof rawContent === "string"
						? rawContent
						: Array.isArray(rawContent)
						? rawContent
								.map((part) => (typeof part === "object" && part !== null && "text" in part ? String(part.text) : ""))
								.join("")
						: "";

				if (content.trim()) {
					const postPerf = performance.now();
					const totalLLMDurationMs = Math.round((fetchEndPerf - fetchStartPerf) * 100) / 100;
					const postProcessingMs = Math.round((postPerf - fetchEndPerf) * 100) / 100;

					tracker?.logLLMPostRequest({
						llmCallId,
						requestId: tracker.requestId,
						node,
						model: modelToTry,
						startTimestamp: new Date(fetchStartPerf).toISOString(),
						endTimestamp: new Date(fetchEndPerf).toISOString(),
						elapsedFromPrevNodeMs: Math.round((fetchStartPerf - preStartPerf) * 100) / 100,
						...analyzed,
						timeBeforeLLMReqMs: Math.round((fetchStartPerf - (tracker?.startPerfTime || fetchStartPerf)) * 100) / 100,
						ttftMs: totalLLMDurationMs,
						tokenGenDurationMs: 0,
						totalLLMDurationMs,
						postProcessingMs,
						chunkCount: 1,
						totalOutputChars: content.length,
						totalOutputTokens: estimateTokens(content),
						finishReason: choice?.finish_reason || "stop",
						providerUsage: payload.usage
							? {
									promptTokens: payload.usage.prompt_tokens,
									completionTokens: payload.usage.completion_tokens,
									totalTokens: payload.usage.total_tokens,
							  }
							: undefined,
					});

					return content;
				}
				lastFailure = `Model ${modelToTry} returned no text content (finish reason: ${choice?.finish_reason ?? "unknown"})`;
			} catch (err) {
				lastFailure = err instanceof Error ? err.message : String(err);
			}
		}
	}
	throw new Error(lastFailure);
};

const streamRequest = async (
	messages: ChatMessage[],
	onChunk: (chunk: string) => void,
	responseFormat?: "json_object",
	tracker?: AgentPerfTracker,
	signal?: AbortSignal,
	options?: { nodeName?: string; state?: Record<string, unknown> }
): Promise<string> => {
	if (!env.agent.openRouterApiKey) {
		throw new Error("Agent model is not configured");
	}

	const llmCallId = `llm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
	const node = options?.nodeName || "llm_node";
	const analyzed = analyzeInputMessages(messages, options?.state);

	const preStartPerf = performance.now();

	tracker?.logLLMPreRequest({
		llmCallId,
		node,
		model: env.agent.model,
		...analyzed,
	});

	tracker?.log({
		layer: "llm",
		module: "openRouterClient.ts",
		operation: `LLM start [${node}]`,
		llmCallId,
	});

	const fetchStartPerf = performance.now();

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
			stream: true,
			...(responseFormat ? { response_format: { type: responseFormat } } : {}),
		}),
		signal,
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => ({}))) as OpenRouterResponse;
		throw new Error(payload.error?.message ?? "OpenRouter stream request failed");
	}

	if (!response.body) {
		throw new Error("Response body is null");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder("utf-8");
	let accumulated = "";
	let buffer = "";
	let chunkIndex = 0;

	let firstChunkPerf: number | undefined;
	let lastChunkPerf: number | undefined;
	let maxInterChunkGapMs = 0;
	let totalInterChunkMs = 0;
	let finishReason = "stop";
	let providerUsage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		const nowChunk = performance.now();
		if (!firstChunkPerf) {
			firstChunkPerf = nowChunk;
			const ttftMs = Math.round((firstChunkPerf - fetchStartPerf) * 100) / 100;
			tracker?.log({
				layer: "llm",
				module: "openRouterClient.ts",
				operation: `LLM first token (TTFT: ${ttftMs}ms)`,
				llmCallId,
			});
		} else if (lastChunkPerf) {
			const gap = nowChunk - lastChunkPerf;
			totalInterChunkMs += gap;
			if (gap > maxInterChunkGapMs) maxInterChunkGapMs = gap;
		}
		lastChunkPerf = nowChunk;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() || "";

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith(":")) continue;
			if (trimmed === "data: [DONE]") continue;

			if (trimmed.startsWith("data: ")) {
				try {
					const jsonStr = trimmed.slice(6);
					const parsed = JSON.parse(jsonStr);
					if (parsed.usage) {
						providerUsage = {
							promptTokens: parsed.usage.prompt_tokens,
							completionTokens: parsed.usage.completion_tokens,
							totalTokens: parsed.usage.total_tokens,
						};
					}
					const choice = parsed.choices?.[0];
					if (choice?.finish_reason) {
						finishReason = choice.finish_reason;
					}
					const delta = choice?.delta?.content;
					if (delta) {
						accumulated += delta;
						chunkIndex += 1;

						if (chunkIndex === 1 || chunkIndex % 10 === 0) {
							tracker?.log({
								layer: "llm",
								module: "openRouterClient.ts",
								operation: `LLM stream chunk #${chunkIndex} (len:${delta.length})`,
								llmCallId,
								chunkIndex,
								chunkLength: delta.length,
							});
						}

						onChunk(delta);
					}
				} catch {
					// Ignore partial JSON chunks
				}
			}
		}
	}

	const endPerf = performance.now();
	const ttftMs = firstChunkPerf ? Math.round((firstChunkPerf - fetchStartPerf) * 100) / 100 : Math.round((endPerf - fetchStartPerf) * 100) / 100;
	const tokenGenDurationMs = firstChunkPerf ? Math.round((endPerf - firstChunkPerf) * 100) / 100 : 0;
	const totalLLMDurationMs = Math.round((endPerf - fetchStartPerf) * 100) / 100;
	const avgInterChunkMs = chunkIndex > 1 ? Math.round((totalInterChunkMs / (chunkIndex - 1)) * 100) / 100 : 0;

	tracker?.logLLMPostRequest({
		llmCallId,
		requestId: tracker?.requestId || `req_${Date.now()}`,
		node,
		model: env.agent.model,
		startTimestamp: new Date(fetchStartPerf).toISOString(),
		endTimestamp: new Date(endPerf).toISOString(),
		elapsedFromPrevNodeMs: Math.round((fetchStartPerf - preStartPerf) * 100) / 100,
		...analyzed,
		timeBeforeLLMReqMs: Math.round((fetchStartPerf - (tracker?.startPerfTime || fetchStartPerf)) * 100) / 100,
		ttftMs,
		tokenGenDurationMs,
		totalLLMDurationMs,
		postProcessingMs: 0,
		chunkCount: chunkIndex,
		avgInterChunkMs,
		maxInterChunkGapMs: Math.round(maxInterChunkGapMs * 100) / 100,
		totalOutputChars: accumulated.length,
		totalOutputTokens: estimateTokens(accumulated),
		finishReason,
		providerUsage,
	});

	return accumulated;
};

export const createOpenRouterClient = () => ({
	invoke: (messages: ChatMessage[], tracker?: AgentPerfTracker, signal?: AbortSignal, options?: { nodeName?: string; state?: Record<string, unknown> }) =>
		request(messages, undefined, tracker, signal, options),
	invokeJson: (messages: ChatMessage[], tracker?: AgentPerfTracker, signal?: AbortSignal, options?: { nodeName?: string; state?: Record<string, unknown> }) =>
		request(messages, "json_object", tracker, signal, options),
	stream: (messages: ChatMessage[], onChunk: (chunk: string) => void, tracker?: AgentPerfTracker, signal?: AbortSignal, options?: { nodeName?: string; state?: Record<string, unknown> }) =>
		streamRequest(messages, onChunk, undefined, tracker, signal, options),
});
