export interface LogEntry {
	requestId: string;
	timestamp: string;
	elapsedMs: number;
	layer: "backend" | "langgraph" | "llm" | "sse";
	module: string;
	operation: string;
	llmCallId?: string;
	eventId?: string;
	eventType?: string;
	conversationId?: string;
	messageId?: string;
	toolCallId?: string;
	todoId?: string;
	chunkIndex?: number;
	chunkLength?: number;
	extra?: Record<string, unknown>;
}

export function estimateTokens(text: string | unknown): number {
	if (text === null || text === undefined) return 0;
	const str = typeof text === "string" ? text : JSON.stringify(text);
	return Math.ceil(str.length / 4);
}

export interface LLMCallMetrics {
	llmCallId: string;
	requestId: string;
	node: string;
	model: string;
	startTimestamp: string;
	endTimestamp?: string;
	elapsedFromPrevNodeMs: number;

	// Input metrics
	systemPromptChars: number;
	systemPromptTokens: number;
	userPromptChars: number;
	userPromptTokens: number;
	historyChars: number;
	historyTokens: number;
	stateChars: number;
	stateTokens: number;
	toolsChars: number;
	toolsTokens: number;
	messageCount: number;
	messageBreakdown: Array<{ role: string; charCount: number; estTokens: number }>;
	totalInputChars: number;
	totalInputTokens: number;

	// LangGraph state breakdown
	stateKeys: string[];
	stateFields: Array<{ name: string; type: string; charCount: number; estTokens: number }>;

	// Tool payload breakdown
	numToolCalls: number;
	toolNames: string[];
	toolResultChars: number;
	toolResultTokens: number;

	// Timings (Waiting vs Generation)
	timeBeforeLLMReqMs: number;
	ttftMs?: number;
	tokenGenDurationMs?: number;
	totalLLMDurationMs?: number;
	postProcessingMs?: number;

	// Stream stats
	chunkCount: number;
	avgInterChunkMs?: number;
	maxInterChunkGapMs?: number;

	// Output metrics
	totalOutputChars: number;
	totalOutputTokens: number;
	finishReason?: string;
	providerUsage?: {
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
	};
}

const colors = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	magenta: "\x1b[35m",
	yellow: "\x1b[33m",
	green: "\x1b[32m",
	blue: "\x1b[34m",
	red: "\x1b[31m",
	gray: "\x1b[90m",
	brightCyan: "\x1b[96m",
	brightYellow: "\x1b[93m",
	brightGreen: "\x1b[92m",
	brightMagenta: "\x1b[95m",
	brightBlue: "\x1b[94m",
	white: "\x1b[97m",
};

export class AgentPerfTracker {
	public requestId: string;
	public startWallTime: string;
	public startPerfTime: number;
	public conversationId?: string;
	private entries: LogEntry[] = [];
	private toolStartTimes: Record<string, number> = {};
	private lastNodeTime: number;

	constructor(requestId?: string, conversationId?: string) {
		this.requestId = requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
		this.conversationId = conversationId;
		this.startWallTime = new Date().toISOString();
		this.startPerfTime = performance.now();
		this.lastNodeTime = this.startPerfTime;
	}

	public getElapsedMs(): number {
		return Math.round((performance.now() - this.startPerfTime) * 100) / 100;
	}

	public log(details: {
		layer: LogEntry["layer"];
		module: string;
		operation: string;
		llmCallId?: string;
		eventId?: string;
		eventType?: string;
		conversationId?: string;
		messageId?: string;
		toolCallId?: string;
		todoId?: string;
		chunkIndex?: number;
		chunkLength?: number;
		extra?: Record<string, unknown>;
	}): LogEntry {
		const nowPerf = performance.now();
		const elapsedMs = Math.round((nowPerf - this.startPerfTime) * 100) / 100;
		const timestamp = new Date().toISOString();

		const entry: LogEntry = {
			requestId: this.requestId,
			timestamp,
			elapsedMs,
			layer: details.layer,
			module: details.module,
			operation: details.operation,
			llmCallId: details.llmCallId,
			eventId: details.eventId,
			eventType: details.eventType,
			conversationId: details.conversationId || this.conversationId,
			messageId: details.messageId,
			toolCallId: details.toolCallId,
			todoId: details.todoId,
			chunkIndex: details.chunkIndex,
			chunkLength: details.chunkLength,
			extra: details.extra,
		};

		this.entries.push(entry);

		const convStr = entry.conversationId ? ` ${colors.gray}| conv:${entry.conversationId}${colors.reset}` : "";
		const evtStr = entry.eventType ? ` ${colors.gray}| evt:${entry.eventType}(${entry.eventId || ""})${colors.reset}` : "";
		const llmStr = entry.llmCallId ? ` ${colors.brightYellow}| llm:${entry.llmCallId}${colors.reset}` : "";
		const chunkStr = entry.chunkIndex !== undefined ? ` ${colors.cyan}| chunk #${entry.chunkIndex} (len:${entry.chunkLength})${colors.reset}` : "";

		const layerColor =
			entry.layer === "backend" ? colors.brightBlue :
			entry.layer === "langgraph" ? colors.brightMagenta :
			entry.layer === "llm" ? colors.brightYellow :
			colors.brightGreen;

		const timeStr = new Date(entry.timestamp).toLocaleTimeString();

		console.log(
			`${colors.gray}[${timeStr}]${colors.reset} ${layerColor}[PERF][${entry.layer.toUpperCase()}]${colors.reset} ${colors.cyan}+${entry.elapsedMs.toFixed(1)}ms${colors.reset} | ${colors.bold}req:${entry.requestId}${colors.reset}${llmStr} | ${colors.white}${entry.module}::${entry.operation}${colors.reset}${evtStr}${convStr}${chunkStr}`
		);

		return entry;
	}

	public logToolStart(optsOrId: string | { toolCallId: string; toolName: string }, toolNameParam?: string): void {
		const toolCallId = typeof optsOrId === "object" ? optsOrId.toolCallId : optsOrId;
		const toolName = typeof optsOrId === "object" ? optsOrId.toolName : toolNameParam || "";
		this.toolStartTimes[toolCallId] = performance.now();
		this.log({
			layer: "langgraph",
			module: "executor.ts",
			operation: `tool start (${toolName})`,
			toolCallId,
			extra: { toolName },
		});
	}

	public logToolEnd(
		optsOrId: string | { toolCallId: string; toolName: string; durationMs?: number; resultCharCount?: number; resultEstTokens?: number },
		toolNameParam?: string,
		resultDataParam?: unknown
	): number {
		let toolCallId: string;
		let toolName: string;
		let durationMs: number;
		let resultChars: number;
		let resultTokens: number;

		if (typeof optsOrId === "object") {
			toolCallId = optsOrId.toolCallId;
			toolName = optsOrId.toolName;
			const start = this.toolStartTimes[toolCallId] || performance.now();
			durationMs = optsOrId.durationMs ?? Math.round((performance.now() - start) * 100) / 100;
			resultChars = optsOrId.resultCharCount ?? 0;
			resultTokens = optsOrId.resultEstTokens ?? 0;
		} else {
			toolCallId = optsOrId;
			toolName = toolNameParam || "";
			const start = this.toolStartTimes[toolCallId] || performance.now();
			durationMs = Math.round((performance.now() - start) * 100) / 100;
			resultChars = resultDataParam ? JSON.stringify(resultDataParam).length : 0;
			resultTokens = estimateTokens(resultDataParam);
		}

		this.log({
			layer: "langgraph",
			module: "executor.ts",
			operation: `tool end (${toolName})`,
			toolCallId,
			extra: { toolName, durationMs, resultChars, resultTokens },
		});

		return durationMs;
	}

	public logLLMPreRequest(metrics: Partial<LLMCallMetrics> & { llmCallId: string; node: string; model: string }): void {
		const elapsedFromPrev = Math.round((performance.now() - this.lastNodeTime) * 100) / 100;
		const isDebug = process.env.AGENT_PERF_DEBUG === "true";

		const border = colors.cyan;
		const r = colors.reset;
		const b = colors.bold;
		const w = colors.white;
		const g = colors.gray;
		const y = colors.brightYellow;
		const m = colors.brightMagenta;

		console.log(`\n${border}┌─────────────────────────────────────────────────────────────────────────────┐${r}`);
		console.log(`${border}│${r} ${b}${y}⚡ LLM CALL PRE-REQUEST SUMMARY${r} ${g}[callId: ${metrics.llmCallId}]${r}`);
		console.log(`${border}├─────────────────────────────────────────────────────────────────────────────┤${r}`);
		console.log(`${border}│${r}  ${b}requestId:${r} ${colors.cyan}${this.requestId}${r}`);
		console.log(`${border}│${r}  ${b}node:${r}      ${m}${metrics.node}${r}`);
		console.log(`${border}│${r}  ${b}model:${r}     ${w}${metrics.model}${r}`);
		console.log(`${border}│${r}  ${b}messages:${r}  ${metrics.messageCount || 0} messages`);
		console.log(`${border}│${r}  ${b}prep delay:${r}${y}+${elapsedFromPrev}ms${r} from previous node`);
		console.log(`${border}├─────────────────────────────────────────────────────────────────────────────┤${r}`);
		console.log(`${border}│${r} ${b}${colors.brightCyan}📥 INPUT CONTEXT BREAKDOWN${r} ${g}(estimated @ ~4 chars/token)${r}`);
		console.log(`${border}│${r}  • system prompt : ${w}${(metrics.systemPromptChars || 0).toLocaleString().padStart(7)} chars${r} │ ${y}~${(metrics.systemPromptTokens || 0).toLocaleString().padStart(5)} tokens${r}`);
		console.log(`${border}│${r}  • user prompt   : ${w}${(metrics.userPromptChars || 0).toLocaleString().padStart(7)} chars${r} │ ${y}~${(metrics.userPromptTokens || 0).toLocaleString().padStart(5)} tokens${r}`);
		console.log(`${border}│${r}  • history       : ${w}${(metrics.historyChars || 0).toLocaleString().padStart(7)} chars${r} │ ${y}~${(metrics.historyTokens || 0).toLocaleString().padStart(5)} tokens${r}`);
		console.log(`${border}│${r}  • state context : ${w}${(metrics.stateChars || 0).toLocaleString().padStart(7)} chars${r} │ ${y}~${(metrics.stateTokens || 0).toLocaleString().padStart(5)} tokens${r}`);
		console.log(`${border}│${r}  • tools payload : ${w}${(metrics.toolsChars || 0).toLocaleString().padStart(7)} chars${r} │ ${y}~${(metrics.toolsTokens || 0).toLocaleString().padStart(5)} tokens${r}`);

		if (metrics.stateKeys && metrics.stateKeys.length > 0) {
			console.log(`${border}│${r}  ${g}├─ state keys:${r} [${metrics.stateKeys.join(", ")}]`);
		}
		if (metrics.numToolCalls && metrics.numToolCalls > 0) {
			console.log(`${border}│${r}  ${g}├─ tool calls:${r} ${metrics.numToolCalls} tools [${(metrics.toolNames || []).join(", ")}]`);
		}

		console.log(`${border}├─────────────────────────────────────────────────────────────────────────────┤${r}`);
		console.log(`${border}│${r}  ${b}${colors.brightGreen}TOTAL INPUT : ${(metrics.totalInputChars || 0).toLocaleString()} chars │ ~${(metrics.totalInputTokens || 0).toLocaleString()} tokens${r}`);
		console.log(`${border}│${r}  ${g}max output : 4000 tokens │ temp=0 │ reasoning={exclude:true}${r}`);
		console.log(`${border}└─────────────────────────────────────────────────────────────────────────────┘${r}\n`);

		this.log({
			layer: "llm",
			module: "openRouterClient.ts",
			operation: `LLM pre-request summary [${metrics.node}]`,
			llmCallId: metrics.llmCallId,
			extra: {
				node: metrics.node,
				model: metrics.model,
				totalInputTokens: metrics.totalInputTokens,
				systemPromptTokens: metrics.systemPromptTokens,
				userPromptTokens: metrics.userPromptTokens,
				historyTokens: metrics.historyTokens,
				stateTokens: metrics.stateTokens,
				toolsTokens: metrics.toolsTokens,
				...(isDebug ? { metrics } : {}),
			},
		});
	}

	public logLLMPostRequest(metrics: LLMCallMetrics): void {
		this.lastNodeTime = performance.now();
		const isDebug = process.env.AGENT_PERF_DEBUG === "true";

		const border = colors.green;
		const r = colors.reset;
		const b = colors.bold;
		const w = colors.white;
		const g = colors.gray;
		const y = colors.brightYellow;
		const gr = colors.brightGreen;
		const m = colors.brightMagenta;
		const c = colors.brightCyan;

		console.log(`\n${border}┌─────────────────────────────────────────────────────────────────────────────┐${r}`);
		console.log(`${border}│${r} ${b}${gr}📊 LLM CALL POST-REQUEST SUMMARY${r} ${g}[callId: ${metrics.llmCallId}]${r}`);
		console.log(`${border}├─────────────────────────────────────────────────────────────────────────────┤${r}`);
		console.log(`${border}│${r}  ${b}requestId:${r} ${colors.cyan}${this.requestId}${r}`);
		console.log(`${border}│${r}  ${b}node:${r}      ${m}${metrics.node}${r}`);
		console.log(`${border}│${r}  ${b}model:${r}     ${w}${metrics.model}${r}`);
		console.log(`${border}├─────────────────────────────────────────────────────────────────────────────┤${r}`);
		console.log(`${border}│${r}  ${b}INPUT :${r}  ${w}${(metrics.totalInputChars || 0).toLocaleString().padStart(7)} chars${r} │ ${y}~${(metrics.totalInputTokens || 0).toLocaleString().padStart(5)} tokens${r}`);
		console.log(`${border}│${r}  ${b}OUTPUT:${r}  ${w}${(metrics.totalOutputChars || 0).toLocaleString().padStart(7)} chars${r} │ ${gr}~${(metrics.totalOutputTokens || 0).toLocaleString().padStart(5)} tokens${r}`);
		if (metrics.providerUsage) {
			console.log(`${border}│${r}  ${g}Provider Usage : prompt=${metrics.providerUsage.promptTokens ?? "N/A"}, completion=${metrics.providerUsage.completionTokens ?? "N/A"}, total=${metrics.providerUsage.totalTokens ?? "N/A"}${r}`);
		}
		console.log(`${border}├─────────────────────────────────────────────────────────────────────────────┤${r}`);
		console.log(`${border}│${r} ${b}${c}⏱️  TIMINGS & STREAMING${r}`);
		console.log(`${border}│${r}  • Node Prep Delay : ${colors.yellow}${metrics.timeBeforeLLMReqMs.toFixed(1)}ms${r}`);
		console.log(`${border}│${r}  • Provider TTFT   : ${y}${metrics.ttftMs ? metrics.ttftMs.toFixed(1) + "ms" : "N/A"}${r} ${g}(Time To First Token)${r}`);
		console.log(`${border}│${r}  • Token Generation: ${gr}${metrics.tokenGenDurationMs ? metrics.tokenGenDurationMs.toFixed(1) + "ms" : "N/A"}${r}`);
		console.log(`${border}│${r}  • Post Processing : ${g}${(metrics.postProcessingMs || 0).toFixed(1)}ms${r}`);
		console.log(`${border}│${r}  • Total LLM Time  : ${b}${c}${(metrics.totalLLMDurationMs || 0).toFixed(1)}ms${r}`);
		console.log(`${border}│${r}  • Stream Chunks   : ${metrics.chunkCount}`);
		if (metrics.avgInterChunkMs !== undefined) {
			console.log(`${border}│${r}  • Avg Chunk Gap   : ${metrics.avgInterChunkMs.toFixed(1)}ms`);
		}
		if (metrics.maxInterChunkGapMs !== undefined) {
			console.log(`${border}│${r}  • Max Chunk Gap   : ${metrics.maxInterChunkGapMs.toFixed(1)}ms`);
		}
		console.log(`${border}│${r}  • Finish Reason   : ${colors.cyan}${metrics.finishReason || "stop"}${r}`);
		console.log(`${border}└─────────────────────────────────────────────────────────────────────────────┘${r}\n`);

		this.log({
			layer: "llm",
			module: "openRouterClient.ts",
			operation: `LLM post-request summary [${metrics.node}]`,
			llmCallId: metrics.llmCallId,
			extra: {
				node: metrics.node,
				ttftMs: metrics.ttftMs,
				tokenGenDurationMs: metrics.tokenGenDurationMs,
				totalLLMDurationMs: metrics.totalLLMDurationMs,
				totalOutputTokens: metrics.totalOutputTokens,
				chunkCount: metrics.chunkCount,
				...(isDebug ? { metrics } : {}),
			},
		});
	}

	public getEntries(): LogEntry[] {
		return [...this.entries];
	}

	public printTimeline(): void {
		const border = colors.brightBlue;
		const r = colors.reset;
		const b = colors.bold;
		const c = colors.cyan;
		const g = colors.gray;
		const y = colors.brightYellow;

		console.log(`\n${border}┌─────────────────────────────────────────────────────────────────────────────┐${r}`);
		console.log(`${border}│${r} ${b}${c}🌊 AGENT PERFORMANCE WATERFALL${r} ${g}[req: ${this.requestId}]${r}`);
		console.log(`${border}├─────────────────────────────────────────────────────────────────────────────┤${r}`);
		console.log(`${border}│${r}  ${g}Start ISO:${r} ${this.startWallTime}`);
		console.log(`${border}├─────────────────────────────────────────────────────────────────────────────┤${r}`);

		let lastMs = 0;
		for (const entry of this.entries) {
			const stepDeltaMs = entry.elapsedMs - lastMs;
			lastMs = entry.elapsedMs;

			const elapsedStr = `${entry.elapsedMs.toFixed(1)}ms`.padStart(9);
			const deltaStr = `(+${stepDeltaMs.toFixed(1)}ms)`.padStart(11);

			const layerColor =
				entry.layer === "backend" ? colors.brightBlue :
				entry.layer === "langgraph" ? colors.brightMagenta :
				entry.layer === "llm" ? colors.brightYellow :
				colors.brightGreen;

			const layerStr = `${layerColor}[${entry.layer.toUpperCase()}]${r}`.padEnd(24);
			const llmStr = entry.llmCallId ? `${y}[${entry.llmCallId}]${r} ` : "";
			const opStr = `${colors.white}${entry.module}::${entry.operation}${r}`;
			const evtStr = entry.eventType ? ` ${g}(${entry.eventType})${r}` : "";
			const chunkStr = entry.chunkIndex !== undefined ? ` ${c}#${entry.chunkIndex}${r}` : "";

			console.log(`${border}│${r} ${c}${elapsedStr}${r} ${g}${deltaStr}${r} ${layerStr} ${llmStr}${opStr}${evtStr}${chunkStr}`);
		}
		console.log(`${border}└─────────────────────────────────────────────────────────────────────────────┘${r}\n`);
	}
}
