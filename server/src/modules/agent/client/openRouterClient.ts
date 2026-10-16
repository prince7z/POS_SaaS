import { env } from "../../../config/env";
import { logger } from "../../../lib/logger";
import { AgentPerfTracker, estimateTokens, estimateTokensFromCharCount } from "../utils/perfLogger";
import { logDetailedAgentError } from "../utils/errorPrinter";

const OPEN_ROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const LLM_ATTEMPT_TIMEOUT_MS = 30_000;
const LLM_REQUEST_BUDGET_MS = 90_000;
const LLM_STREAM_TIMEOUT_MS = 30_000;
const LLM_STREAM_FALLBACK_BUDGET_MS = 45_000;

type LLMCallOptions = {
	nodeName?: string;
	state?: Record<string, unknown>;
	requestBudgetMs?: number;
};

const createTimeoutSignal = (parentSignal: AbortSignal | undefined, timeoutMs: number) => {
	const controller = new AbortController();
	const onParentAbort = () => controller.abort(parentSignal?.reason);
	if (parentSignal?.aborted) onParentAbort();
	else parentSignal?.addEventListener("abort", onParentAbort, { once: true });

	const timer = setTimeout(() => {
		controller.abort(new Error(`OpenRouter request timed out after ${timeoutMs}ms`));
	}, timeoutMs);

	return {
		signal: controller.signal,
		dispose: () => {
			clearTimeout(timer);
			parentSignal?.removeEventListener("abort", onParentAbort);
		},
	};
};

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
		delta?: {
			content?: string;
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
	const totalInputTokens = estimateTokensFromCharCount(totalInputChars);

	return {
		systemPromptChars,
		systemPromptTokens: estimateTokensFromCharCount(systemPromptChars),
		userPromptChars,
		userPromptTokens: estimateTokensFromCharCount(userPromptChars),
		historyChars,
		historyTokens: estimateTokensFromCharCount(historyChars),
		stateChars,
		stateTokens: estimateTokensFromCharCount(stateChars),
		toolsChars,
		toolsTokens: estimateTokensFromCharCount(toolsChars),
		messageCount: messages.length,
		messageBreakdown,
		totalInputChars,
		totalInputTokens,
		stateKeys,
		stateFields,
		numToolCalls,
		toolNames,
		toolResultChars: toolsChars,
		toolResultTokens: estimateTokensFromCharCount(toolsChars),
	};
}

const request = async (
	messages: ChatMessage[],
	responseFormat?: "json_object",
	tracker?: AgentPerfTracker,
	signal?: AbortSignal,
	options?: LLMCallOptions
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

	const requestBudgetMs = options?.requestBudgetMs ?? LLM_REQUEST_BUDGET_MS;
	const requestDeadline = Date.now() + requestBudgetMs;
	let lastFailure = "OpenRouter returned an empty response";

	const candidateModels = Array.from(new Set([
		env.agent.model,
		"google/gemini-2.0-flash-lite-preview-02-05:free",
		"meta-llama/llama-3.3-70b-instruct:free",
		"qwen/qwen-2.5-72b-instruct:free",
		"openai/gpt-4o-mini",
	]));

	modelLoop: for (const modelToTry of candidateModels) {
		for (let attempt = 0; attempt < 2; attempt += 1) {
			if (signal?.aborted) throw signal.reason ?? new Error("OpenRouter request aborted");
			const remainingBudgetMs = requestDeadline - Date.now();
			if (remainingBudgetMs <= 0) {
				lastFailure = `OpenRouter request exceeded the ${requestBudgetMs}ms time budget`;
				break modelLoop;
			}
			const attemptTimeoutMs = Math.min(LLM_ATTEMPT_TIMEOUT_MS, remainingBudgetMs);
			const timeout = createTimeoutSignal(signal, attemptTimeoutMs);
			const attemptStartPerf = performance.now();
			const attemptStartTimestamp = new Date().toISOString();
			tracker?.log({
				layer: "llm",
				module: "openRouterClient.ts",
				operation: `LLM attempt started [${node}]`,
				llmCallId,
				extra: { model: modelToTry, attempt: attempt + 1, timeoutMs: attemptTimeoutMs },
			});
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
					signal: timeout.signal,
				});

				const payload = (await response.json()) as OpenRouterResponse;
				if (!response.ok) {
					lastFailure = payload.error?.message ?? `OpenRouter request failed (${response.status})`;
					logger.warn("[Agent LLM] OpenRouter rejected request", {
						requestId: tracker?.requestId,
						node,
						model: modelToTry,
						attempt: attempt + 1,
						status: response.status,
						message: lastFailure.slice(0, 300),
					});
					tracker?.log({
						layer: "llm",
						module: "openRouterClient.ts",
						operation: `LLM provider response failed [${node}]`,
						llmCallId,
						extra: { model: modelToTry, attempt: attempt + 1, status: response.status, message: lastFailure.slice(0, 300) },
					});
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
					const fetchEndPerf = performance.now();
					const postPerf = performance.now();
					const totalLLMDurationMs = Math.round((fetchEndPerf - attemptStartPerf) * 100) / 100;
					const postProcessingMs = Math.round((postPerf - fetchEndPerf) * 100) / 100;

					tracker?.logLLMPostRequest({
						llmCallId,
						requestId: tracker.requestId,
						node,
						model: modelToTry,
						startTimestamp: attemptStartTimestamp,
						endTimestamp: new Date(fetchEndPerf).toISOString(),
						elapsedFromPrevNodeMs: Math.round((attemptStartPerf - preStartPerf) * 100) / 100,
						...analyzed,
						timeBeforeLLMReqMs: Math.round((attemptStartPerf - (tracker?.startPerfTime || attemptStartPerf)) * 100) / 100,
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
				logDetailedAgentError(`OpenRouter Model Call Empty Response [${node}]`, lastFailure, { modelToTry, attempt }, tracker);
			} catch (err) {
				if (signal?.aborted) throw err;
				const formatted = logDetailedAgentError(`OpenRouter Model Call Failed [${node}]`, err, { modelToTry, attempt }, tracker);
				lastFailure = formatted.summary;
				if (timeout.signal.aborted) {
					tracker?.log({
						layer: "llm",
						module: "openRouterClient.ts",
						operation: `LLM attempt timed out; trying next model [${node}]`,
						llmCallId,
						extra: { model: modelToTry, attempt: attempt + 1 },
					});
					break;
				}
			} finally {
				timeout.dispose();
			}
		}
	}
	logDetailedAgentError(`All OpenRouter Candidate Models Exhausted [${node}]`, lastFailure, { candidateModels, node }, tracker);
	throw new Error(lastFailure);
};

const streamRequest = async (
	messages: ChatMessage[],
	onChunk: (chunk: string) => void,
	modelToTry: string,
	responseFormat?: "json_object",
	tracker?: AgentPerfTracker,
	signal?: AbortSignal,
	options?: LLMCallOptions
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
		model: modelToTry,
		...analyzed,
	});

	tracker?.log({
		layer: "llm",
		module: "openRouterClient.ts",
		operation: `LLM start [${node}]`,
		llmCallId,
	});

	const fetchStartPerf = performance.now();
	const timeout = createTimeoutSignal(signal, LLM_STREAM_TIMEOUT_MS);

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
			reasoning: { exclude: true },
			stream: true,
			...(responseFormat ? { response_format: { type: responseFormat } } : {}),
		}),
		signal: timeout.signal,
	}).catch((error: unknown) => {
		timeout.dispose();
		if (!signal?.aborted) {
			logDetailedAgentError(`OpenRouter Stream Request Failed [${node}]`, error, { model: modelToTry }, tracker);
		}
		throw error;
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => ({}))) as OpenRouterResponse;
		const message = payload.error?.message ?? `OpenRouter stream request failed (${response.status})`;
		timeout.dispose();
		logger.warn("[Agent LLM] OpenRouter stream rejected request", {
			requestId: tracker?.requestId,
			node,
			model: modelToTry,
			status: response.status,
			message: message.slice(0, 300),
		});
		throw new Error(message);
	}

	if (!response.body) {
		timeout.dispose();
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

	try {
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
					let parsed: OpenRouterResponse;
					try {
						const jsonStr = trimmed.slice(6);
						parsed = JSON.parse(jsonStr) as OpenRouterResponse;
					} catch (error) {
						if (error instanceof SyntaxError) continue;
						throw error;
					}
					if (parsed.error?.message) {
						throw new Error(String(parsed.error.message));
					}
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
				}
			}
		}
	} catch (error) {
		if (!signal?.aborted) {
			logDetailedAgentError(`OpenRouter Stream Failed [${node}]`, error, { model: modelToTry, chunkIndex }, tracker);
		}
		throw error;
	} finally {
		timeout.dispose();
	}

	if (!accumulated.trim()) {
		const error = new Error(`OpenRouter stream returned no text content (finish reason: ${finishReason})`);
		logDetailedAgentError(`OpenRouter Stream Empty Response [${node}]`, error, { model: modelToTry }, tracker);
		throw error;
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
		model: modelToTry,
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
	invoke: (messages: ChatMessage[], tracker?: AgentPerfTracker, signal?: AbortSignal, options?: LLMCallOptions) =>
		request(messages, undefined, tracker, signal, options),
	invokeJson: (messages: ChatMessage[], tracker?: AgentPerfTracker, signal?: AbortSignal, options?: LLMCallOptions) =>
		request(messages, "json_object", tracker, signal, options),
	stream: async (messages: ChatMessage[], onChunk: (chunk: string) => void, tracker?: AgentPerfTracker, signal?: AbortSignal, options?: LLMCallOptions) => {
		const node = options?.nodeName ?? "llm_node";
		const streamingModels = Array.from(new Set([env.agent.model, "openai/gpt-4o-mini"]));
		let lastStreamError: unknown;

		for (const modelToTry of streamingModels) {
			let emittedText = false;
			try {
				return await streamRequest(
					messages,
					(chunk) => {
						emittedText = true;
						onChunk(chunk);
					},
					modelToTry,
					undefined,
					tracker,
					signal,
					options,
				);
			} catch (streamError) {
				if (signal?.aborted || emittedText) throw streamError;
				lastStreamError = streamError;
				tracker?.log({
					layer: "llm",
					module: "openRouterClient.ts",
					operation: `LLM stream candidate failed before text [${node}]`,
					extra: {
						model: modelToTry,
						error: streamError instanceof Error ? streamError.message : String(streamError),
					},
				});
			}
		}

		tracker?.log({
			layer: "llm",
			module: "openRouterClient.ts",
			operation: `All streaming candidates failed; using non-streaming fallback [${node}]`,
			extra: { error: lastStreamError instanceof Error ? lastStreamError.message : String(lastStreamError) },
		});
		logger.warn("[Agent LLM] Streaming candidates failed; retrying with non-streaming response", {
			requestId: tracker?.requestId,
			node,
			error: lastStreamError instanceof Error ? lastStreamError.message : String(lastStreamError),
		});
		try {
			return await request(messages, undefined, tracker, signal, {
				...options,
				requestBudgetMs: LLM_STREAM_FALLBACK_BUDGET_MS,
			});
		} catch (fallbackError) {
			const streamMessage = lastStreamError instanceof Error ? lastStreamError.message : String(lastStreamError);
			const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
			throw new Error(`OpenRouter streaming failed before producing text (${streamMessage}); non-stream fallback failed (${fallbackMessage})`);
		}
	},
});
