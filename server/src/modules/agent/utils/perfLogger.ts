export interface LogEntry {
	requestId: string;
	timestamp: string;
	elapsedMs: number;
	layer: "backend" | "langgraph" | "llm" | "sse";
	module: string;
	operation: string;
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

export class AgentPerfTracker {
	public requestId: string;
	public startWallTime: string;
	public startPerfTime: number;
	public conversationId?: string;
	private entries: LogEntry[] = [];

	constructor(requestId?: string, conversationId?: string) {
		this.requestId = requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
		this.conversationId = conversationId;
		this.startWallTime = new Date().toISOString();
		this.startPerfTime = performance.now();
	}

	public log(details: {
		layer: LogEntry["layer"];
		module: string;
		operation: string;
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

		const convStr = entry.conversationId ? ` | conv:${entry.conversationId}` : "";
		const evtStr = entry.eventType ? ` | evt:${entry.eventType}(${entry.eventId || ""})` : "";
		const chunkStr = entry.chunkIndex !== undefined ? ` | chunk #${entry.chunkIndex} (len:${entry.chunkLength})` : "";

		console.log(
			`[PERF][${entry.layer.toUpperCase()}] +${entry.elapsedMs.toFixed(1)}ms | req:${entry.requestId} | ${entry.module}::${entry.operation}${evtStr}${convStr}${chunkStr}`
		);

		return entry;
	}

	public getEntries(): LogEntry[] {
		return [...this.entries];
	}

	public printTimeline(): void {
		console.log(`\n=================== AGENT PERFORMANCE TIMELINE (req: ${this.requestId}) ===================`);
		console.log(`Start ISO: ${this.startWallTime}`);
		for (const entry of this.entries) {
			const elapsedStr = `${entry.elapsedMs.toFixed(1)}ms`.padEnd(10);
			const layerStr = `[${entry.layer}]`.padEnd(12);
			const opStr = `${entry.module}::${entry.operation}`;
			const evtStr = entry.eventType ? ` (${entry.eventType})` : "";
			const chunkStr = entry.chunkIndex !== undefined ? ` [chunk #${entry.chunkIndex}, len: ${entry.chunkLength}]` : "";
			console.log(`${elapsedStr} ${layerStr} ${opStr}${evtStr}${chunkStr}`);
		}
		console.log(`====================================================================================================\n`);
	}
}
