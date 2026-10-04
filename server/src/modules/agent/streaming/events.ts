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

export const writeAgentEvent = (response: Response, event: AgentEvent) => {
	const envelope = {
		id: event.id || `evt_${Date.now()}_${randomUUID().slice(0, 8)}`,
		type: event.type,
		timestamp: event.timestamp || Date.now(),
		data: event.data,
	};
	response.write(`data: ${JSON.stringify(envelope)}\n\n`);
};

export const startAgentStream = (response: Response) => {
	response.status(200);
	response.setHeader("Content-Type", "text/event-stream");
	response.setHeader("Cache-Control", "no-cache");
	response.setHeader("Connection", "keep-alive");
	response.flushHeaders();
};
