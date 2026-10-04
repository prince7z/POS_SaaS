import type { Response } from "express";
import { randomUUID } from "node:crypto";

export type AgentEventType =
	| "thinking"
	| "todo"
	| "text"
	| "chart"
	| "chart_batch"
	| "table"
	| "tool_call"
	| "tool_result"
	| "question"
	| "confirmation"
	| "upload_required"
	| "error"
	| "done";

export type AgentEvent<T = unknown> = {
	id?: string;
	type: AgentEventType;
	timestamp?: number;
	data: T;
};

import type { AgentPerfTracker } from "../utils/perfLogger";

export const writeAgentEvent = (response: Response, event: AgentEvent, tracker?: AgentPerfTracker) => {
	const envelope = {
		id: event.id || `evt_${Date.now()}_${randomUUID().slice(0, 8)}`,
		type: event.type,
		timestamp: event.timestamp || Date.now(),
		data: event.data,
	};

	tracker?.log({
		layer: "sse",
		module: "events.ts",
		operation: "event-created",
		eventId: envelope.id,
		eventType: envelope.type,
	});

	response.write(`data: ${JSON.stringify(envelope)}\n\n`);

	tracker?.log({
		layer: "sse",
		module: "events.ts",
		operation: "event-written",
		eventId: envelope.id,
		eventType: envelope.type,
	});
};

export const startAgentStream = (response: Response) => {
	response.status(200);
	response.setHeader("Content-Type", "text/event-stream");
	response.setHeader("Cache-Control", "no-cache");
	response.setHeader("Connection", "keep-alive");
	response.flushHeaders();
};
