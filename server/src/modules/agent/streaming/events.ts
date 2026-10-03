import type { Response } from "express";

export type AgentEvent =
	| { type: "run.started"; runId: string }
	| { type: "plan.created"; steps: Array<{ id: string; description: string; status: "pending" }> }
	| { type: "assistant.delta"; content: string }
	| { type: "human.input_required"; request: unknown }
	| { type: "upload.required"; uploadId: string; uploadUrl: string; purpose: string; contentTypes: string[] }
	| { type: "run.completed"; runId: string }
	| { type: "run.error"; message: string };

export const writeAgentEvent = (response: Response, event: AgentEvent) => {
	response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
};

export const startAgentStream = (response: Response) => {
	response.status(200);
	response.setHeader("Content-Type", "text/event-stream");
	response.setHeader("Cache-Control", "no-cache");
	response.setHeader("Connection", "keep-alive");
	response.flushHeaders();
};
