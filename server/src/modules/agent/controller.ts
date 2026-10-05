import type { RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { unauthorized, validationError } from "../../utils/errors";
import { sendSuccess } from "../../utils/apiResponse";
import { createAgentGraph } from "./graph/graph";
import { addMessage, createConversation, getConversation, getConversationHistory, listConversations } from "./persistence";
import { finishRun, registerRun, cancelRun } from "./runtime/run-manager";
import { startAgentStream, writeAgentEvent } from "./streaming/events";
import { getAgentCheckpointer } from "./checkpoint";
import { Command, isGraphInterrupt } from "@langchain/langgraph";
import { logger } from "../../lib/logger";

const routeParam = (value: string | string[] | undefined) => {
	if (typeof value !== "string" || !value) throw validationError("Invalid conversation identifier");
	return value;
};

import { AgentPerfTracker } from "./utils/perfLogger";

const trustedUser = async (request: Parameters<RequestHandler>[0], tracker?: AgentPerfTracker) => {
	if (!request.auth) throw unauthorized();
	tracker?.log({ layer: "backend", module: "controller.ts", operation: "trustedUser start" });

	const dbStart = performance.now();
	tracker?.log({ layer: "backend", module: "controller.ts", operation: "before prisma.user.findFirst()" });

	const user = await prisma.user.findFirst({
		where: { id: request.auth.userId, companyId: request.auth.companyId, isActive: true, deletedAt: null },
		select: { id: true, companyId: true, accesses: true },
	});

	const dbDurationMs = Math.round((performance.now() - dbStart) * 100) / 100;
	tracker?.log({
		layer: "backend",
		module: "controller.ts",
		operation: `after prisma.user.findFirst() (${dbDurationMs}ms)`,
	});

	if (!user) throw unauthorized();
	tracker?.log({ layer: "backend", module: "controller.ts", operation: "auth completed" });
	tracker?.log({ layer: "backend", module: "controller.ts", operation: "authorization completed" });
	return { id: user.id, companyId: user.companyId, permissions: user.accesses.map(String) };
};

export const create = async (request: Parameters<RequestHandler>[0], response: Parameters<RequestHandler>[1]) => {
	const user = await trustedUser(request);
	const body = request.body as { title?: unknown };
	const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : undefined;
	sendSuccess(response, await createConversation(user.id, user.companyId, title), 201);
};

export const list = async (request: Parameters<RequestHandler>[0], response: Parameters<RequestHandler>[1]) => {
	const user = await trustedUser(request);
	sendSuccess(response, await listConversations(user.id, user.companyId));
};

export const get = async (request: Parameters<RequestHandler>[0], response: Parameters<RequestHandler>[1]) => {
	const user = await trustedUser(request);
	sendSuccess(response, await getConversation(routeParam(request.params.conversationId), user.id, user.companyId));
};

function parseMarkdownTables(text: string): {
	cleanText: string;
	tables: Array<{
		title?: string;
		columns: Array<{ key: string; label: string }>;
		rows: Array<Record<string, string>>;
	}>;
} {
	const lines = text.split("\n");
	const tables: Array<{
		title?: string;
		columns: Array<{ key: string; label: string }>;
		rows: Array<Record<string, string>>;
	}> = [];

	const remainingLines: string[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];
		if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
			const tableLines: string[] = [];
			let title = "";
			if (remainingLines.length > 0) {
				const lastLine = remainingLines[remainingLines.length - 1].trim();
				if (lastLine.startsWith("#") || (lastLine.startsWith("**") && lastLine.endsWith("**"))) {
					title = lastLine.replace(/^#+\s*/, "").replace(/\*\*/g, "");
					remainingLines.pop();
				}
			}

			while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
				tableLines.push(lines[i].trim());
				i += 1;
			}

			if (tableLines.length >= 2) {
				const headerLine = tableLines[0];
				const headers = headerLine
					.slice(1, -1)
					.split("|")
					.map((h) => h.trim().replace(/\*\*/g, ""));

				const dataLines = tableLines.filter((l) => !l.includes("---"));
				const columns = headers.map((h, idx) => ({ key: `col_${idx}`, label: h }));
				const rows: Record<string, string>[] = [];

				for (let dIdx = 1; dIdx < dataLines.length; dIdx += 1) {
					const cells = dataLines[dIdx]
						.slice(1, -1)
						.split("|")
						.map((c) => c.trim().replace(/\*\*/g, ""));
					const row: Record<string, string> = {};
					columns.forEach((col, cIdx) => {
						row[col.key] = cells[cIdx] || "";
					});
					rows.push(row);
				}

				if (columns.length > 0 && rows.length > 0) {
					tables.push({ title: title || undefined, columns, rows });
				}
			}
			continue;
		}

		remainingLines.push(line);
		i += 1;
	}

	return {
		cleanText: remainingLines.join("\n").trim(),
		tables,
	};
}

// Helper to format self-describing chart data according to event contract
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatSelfDescribingChartData(rawChart: any) {
	if (!rawChart || typeof rawChart !== "object") return rawChart;

	const data = Array.isArray(rawChart.data)
		? rawChart.data
		: Array.isArray(rawChart.rows)
		? rawChart.rows
		: Array.isArray(rawChart.items)
		? rawChart.items
		: Array.isArray(rawChart)
		? rawChart
		: [];

	const rawType = String(rawChart.chartType || rawChart.chart_type || rawChart.type || "").toLowerCase();
	const titleLower = String(rawChart.title || "").toLowerCase();

	let chartType: "line" | "bar" | "donut" | "pie" | "area" = "bar";
	if (rawType.includes("line") || titleLower.includes("line") || titleLower.includes("trend")) {
		chartType = "line";
	} else if (rawType.includes("donut") || rawType.includes("pie") || titleLower.includes("donut") || titleLower.includes("pie") || titleLower.includes("share")) {
		chartType = "donut";
	} else if (rawType.includes("area")) {
		chartType = "area";
	} else if (rawType.includes("bar") || titleLower.includes("bar")) {
		chartType = "bar";
	}

	const sample = data[0] || {};
	const keys = Object.keys(sample);
	const xKey = rawChart.xAxis?.key || rawChart.xKey || rawChart.xAxisKey || keys.find((k) => ["category", "name", "label", "date", "month", "week", "day"].includes(k.toLowerCase())) || keys[0] || "x";

	const series = Array.isArray(rawChart.series) && rawChart.series.length > 0
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		? rawChart.series.map((s: any) => ({
				key: String(s.key || s.dataKey || ""),
				label: String(s.label || s.key || s.dataKey || ""),
		  }))
		: keys.filter((k) => k !== xKey && typeof sample[k] === "number").map((k) => ({
				key: k,
				label: k.replace(/_/g, " ").toUpperCase(),
		  }));

	return {
		chartType,
		title: rawChart.title,
		xAxis: { key: xKey, label: rawChart.xAxis?.label },
		series,
		data,
	};
}

function emitFinalResponse(
	response: Parameters<RequestHandler>[1],
	finalResponse: unknown,
	textAlreadyStreamed = false,
	messageId = `msg_${Date.now()}`,
	tracker?: AgentPerfTracker
) {
	if (!finalResponse) {
		if (!textAlreadyStreamed) {
			writeAgentEvent(
				response,
				{
					type: "text",
					data: { messageId, delta: "I could not complete that request." },
				},
				tracker
			);
		}
		return;
	}

	const raw = typeof finalResponse === "string" ? finalResponse : JSON.stringify(finalResponse);

	// Extract chart blocks from text if model output embedded ```json { ... } ```
	const chartRegex = /```(?:json|chart)?\s*(\{[\s\S]*?"(?:type|chartType|charts)"[\s\S]*?\})\s*```/gi;
	const matches = [...raw.matchAll(chartRegex)];

	if (matches.length > 0) {
		for (const m of matches) {
			try {
				const parsedChart = JSON.parse(m[1]);
				if (parsedChart.type === "chart_batch" || Array.isArray(parsedChart.charts)) {
					const charts = Array.isArray(parsedChart.charts) ? parsedChart.charts : [];
					for (const c of charts) {
						writeAgentEvent(
							response,
							{
								type: "chart",
								data: formatSelfDescribingChartData(c),
							},
							tracker
						);
					}
				} else {
					writeAgentEvent(
						response,
						{
							type: "chart",
							data: formatSelfDescribingChartData(parsedChart),
						},
						tracker
					);
				}
			} catch {
				// ignore parse error
			}
		}
	}

	const { cleanText, tables } = parseMarkdownTables(raw);

	if (cleanText && !textAlreadyStreamed) {
		writeAgentEvent(
			response,
			{
				type: "text",
				data: { messageId, delta: cleanText },
			},
			tracker
		);
	}

	for (const tableData of tables) {
		writeAgentEvent(
			response,
			{
				type: "table",
				data: tableData,
			},
			tracker
		);
	}

	if (!textAlreadyStreamed && tables.length === 0 && !cleanText) {
		writeAgentEvent(
			response,
			{
				type: "text",
				data: { messageId, delta: raw },
			},
			tracker
		);
	}
}

export const stream: RequestHandler = async (request, response, next) => {
	const runId = randomUUID();
	const reqHeader = request.headers["x-request-id"];
	const bodyObj = request.body as { requestId?: string; message?: string; conversationId?: string; content?: string };
	const requestId = (typeof reqHeader === "string" ? reqHeader : bodyObj?.requestId) || `req_${Date.now()}_${randomUUID().slice(0, 6)}`;
	const tracker = new AgentPerfTracker(requestId);

	try {
		tracker.log({ layer: "backend", module: "controller.ts", operation: "HTTP request received" });
		const user = await trustedUser(request, tracker);
		const content = (bodyObj.message || bodyObj.content || "").trim();
		if (!content) throw validationError("Message content is required");

		let conversationId = bodyObj.conversationId || (request.params.conversationId ? routeParam(request.params.conversationId) : undefined);
		const convDbStart = performance.now();
		tracker.log({ layer: "backend", module: "controller.ts", operation: "before conversation DB lookup" });
		if (conversationId) {
			await getConversation(conversationId, user.id, user.companyId);
		} else {
			const newConv = await createConversation(user.id, user.companyId, content.slice(0, 40));
			conversationId = newConv.id;
		}
		const convDbDurationMs = Math.round((performance.now() - convDbStart) * 100) / 100;
		tracker.log({ layer: "backend", module: "controller.ts", operation: `after conversation DB lookup (${convDbDurationMs}ms)` });

		tracker.conversationId = conversationId;
		const msgDbStart = performance.now();
		tracker.log({ layer: "backend", module: "controller.ts", operation: "before addMessage DB query" });
		await addMessage(conversationId, "user", content);
		const msgDbDurationMs = Math.round((performance.now() - msgDbStart) * 100) / 100;
		tracker.log({ layer: "backend", module: "controller.ts", operation: `after addMessage DB query (${msgDbDurationMs}ms)` });
		const controller = registerRun(runId);
		startAgentStream(response);

		request.on("close", () => {
			if (!response.writableEnded) {
				tracker.log({ layer: "backend", module: "controller.ts", operation: "Client disconnected - aborting run" });
				controller.abort();
				cancelRun(runId);
			}
		});

		writeAgentEvent(
			response,
			{
				type: "thinking",
				data: { status: "running", message: "Analyzing query & planning response..." },
			},
			tracker
		);

		const messageId = `msg_${Date.now()}`;
		let accumulatedText = "";
		let isChartBlock = false;

		const onChunk = (chunk: string) => {
			accumulatedText += chunk;

			if (/(?:```(?:json|chart)?\s*\{|\{\s*"(?:type|chartType|charts)")/i.test(accumulatedText)) {
				isChartBlock = true;
			}

			const trimmed = accumulatedText.trimStart();
			if (isChartBlock || (trimmed.startsWith("{") && !trimmed.includes("\n\n"))) {
				return;
			}

			writeAgentEvent(
				response,
				{
					type: "text",
					data: { messageId, delta: chunk },
				},
				tracker
			);
		};

		tracker.log({ layer: "backend", module: "controller.ts", operation: "LangGraph started" });
		const history = await getConversationHistory(conversationId, 10);
		const graph = createAgentGraph(await getAgentCheckpointer());
		const eventStream = await graph.stream(
			{ request: content, user, history },
			{
				configurable: { thread_id: conversationId, onChunk, tracker },
				signal: controller.signal,
				streamMode: "updates",
			},
		);

		let finalResponsePayload: unknown = null;

		for await (const update of eventStream) {
			if (controller.signal.aborted) break;

			// Planner node completed
			if (update.planner?.plan) {
				writeAgentEvent(
					response,
					{
						type: "thinking",
						data: { status: "completed", message: "Plan created" },
					},
					tracker
				);

				if (Array.isArray(update.planner.plan.steps)) {
					for (const step of update.planner.plan.steps) {
						const desc = "description" in step ? step.description : "Step processing";
						writeAgentEvent(
							response,
							{
								type: "todo",
								data: { id: step.id, title: desc, status: "running" },
							},
							tracker
						);
					}
				}
			}

			// Executor node completed
			if (update.executor?.stepResults) {
				const stepResults = update.executor.stepResults as Record<string, unknown>;
				for (const [stepId, res] of Object.entries(stepResults)) {
					const resMsg = typeof res === "object" && res !== null && "summary" in res ? String((res as { summary: unknown }).summary) : "Step finished";
					writeAgentEvent(
						response,
						{
							type: "tool_call",
							data: { toolCallId: stepId, name: stepId, label: stepId, status: "completed" },
						},
						tracker
					);
					writeAgentEvent(
						response,
						{
							type: "tool_result",
							data: { toolCallId: stepId, status: "completed", message: resMsg },
						},
						tracker
					);
					writeAgentEvent(
						response,
						{
							type: "todo",
							data: { id: stepId, title: stepId, status: "completed" },
						},
						tracker
					);
				}
			}

			// Final node completed
			if (update.final?.finalResponse) {
				finalResponsePayload = update.final.finalResponse;
			}
		}

		tracker.log({ layer: "backend", module: "controller.ts", operation: "stream completed" });

		const stateSnapshot = await graph.getState({ configurable: { thread_id: conversationId } });
		const pendingInterrupts = stateSnapshot.tasks?.flatMap((t) => t.interrupts || []) || [];

		if (pendingInterrupts.length > 0) {
			const activeInterrupt = pendingInterrupts[0];
			tracker.log({ layer: "backend", module: "controller.ts", operation: "Graph interrupt detected after stream" });
			handleInterruptPayload(response, activeInterrupt.value, tracker);
			writeAgentEvent(response, { type: "done", data: null }, tracker);
			response.end();
			tracker.log({ layer: "backend", module: "controller.ts", operation: "HTTP request completed (interrupted)" });
			tracker.printTimeline();
			return;
		}

		if (finalResponsePayload) {
			await addMessage(conversationId, "assistant", typeof finalResponsePayload === "string" ? finalResponsePayload : JSON.stringify(finalResponsePayload));
			emitFinalResponse(response, finalResponsePayload, !isChartBlock && accumulatedText.length > 0, messageId, tracker);
		} else {
			writeAgentEvent(
				response,
				{
					type: "text",
					data: { messageId, delta: "I could not complete that request." },
				},
				tracker
			);
		}

		writeAgentEvent(response, { type: "done", data: null }, tracker);
		response.end();
		tracker.log({ layer: "backend", module: "controller.ts", operation: "HTTP request completed" });
		tracker.printTimeline();
	} catch (error) {
		if (isGraphInterrupt(error) && response.headersSent) {
			handleInterrupt(response, error);
			tracker.printTimeline();
			return;
		}
		if (!response.headersSent) return next(error);
		logger.error("Agent run failed", error);
		writeAgentEvent(
			response,
			{
				type: "error",
				data: { code: "AGENT_ERROR", message: "The assistant could not complete this request." },
			},
			tracker
		);
		writeAgentEvent(response, { type: "done", data: null }, tracker);
		response.end();
		tracker.log({ layer: "backend", module: "controller.ts", operation: "HTTP request completed (failed)" });
		tracker.printTimeline();
	} finally {
		finishRun(runId);
	}
};

// Interaction response handler for POST /api/agent/respond
export const respond: RequestHandler = async (request, response, next) => {
	const runId = randomUUID();
	const reqHeader = request.headers["x-request-id"];
	const requestId = (typeof reqHeader === "string" ? reqHeader : undefined) || `req_${Date.now()}_${randomUUID().slice(0, 6)}`;
	const tracker = new AgentPerfTracker(requestId);

	try {
		tracker.log({ layer: "backend", module: "controller.ts", operation: "HTTP respond request received" });
		const user = await trustedUser(request, tracker);
		const body = request.body as {
			conversationId?: string;
			questionId?: string;
			confirmationId?: string;
			uploadId?: string;
			response?: unknown;
		};

		const conversationId = body.conversationId || (request.params.conversationId ? routeParam(request.params.conversationId) : undefined);
		if (!conversationId) throw validationError("Conversation identifier required");
		await getConversation(conversationId, user.id, user.companyId);
		tracker.conversationId = conversationId;

		const resumeValue =
			body.response && typeof body.response === "object" && "value" in body.response
				? (body.response as { value: unknown }).value
				: body.response;

		const controller = registerRun(runId);
		startAgentStream(response);

		writeAgentEvent(
			response,
			{
				type: "thinking",
				data: { status: "running", message: "Processing response and continuing..." },
			},
			tracker
		);

		let messageId = `msg_${Date.now()}`;
		let accumulatedText = "";
		let isChartBlock = false;

		const onChunk = (chunk: string) => {
			accumulatedText += chunk;
			if (/(?:```(?:json|chart)?\s*\{|\{\s*"(?:type|chartType|charts)")/i.test(accumulatedText)) {
				isChartBlock = true;
			}
			const trimmed = accumulatedText.trimStart();
			if (isChartBlock || (trimmed.startsWith("{") && !trimmed.includes("\n\n"))) {
				return;
			}
			writeAgentEvent(
				response,
				{
					type: "text",
					data: { messageId, delta: chunk },
				},
				tracker
			);
		};

		tracker.log({ layer: "backend", module: "controller.ts", operation: "LangGraph resume started" });
		const graph = createAgentGraph(await getAgentCheckpointer());
		const eventStream = await graph.stream(new Command({ resume: resumeValue }), {
			configurable: { thread_id: conversationId, onChunk, tracker },
			signal: controller.signal,
			streamMode: "updates",
		});

		let finalResponsePayload: unknown = null;

		for await (const update of eventStream) {
			if (controller.signal.aborted) break;

			if (update.executor?.stepResults) {
				const stepResults = update.executor.stepResults as Record<string, unknown>;
				for (const [stepId] of Object.entries(stepResults)) {
					writeAgentEvent(
						response,
						{
							type: "todo",
							data: { id: stepId, title: stepId, status: "completed" },
						},
						tracker
					);
				}
			}

			if (update.final?.finalResponse) {
				finalResponsePayload = update.final.finalResponse;
			}
		}

		tracker.log({ layer: "backend", module: "controller.ts", operation: "resume stream completed" });

		const stateSnapshot = await graph.getState({ configurable: { thread_id: conversationId } });
		const pendingInterrupts = stateSnapshot.tasks?.flatMap((t) => t.interrupts || []) || [];

		if (pendingInterrupts.length > 0) {
			const activeInterrupt = pendingInterrupts[0];
			tracker.log({ layer: "backend", module: "controller.ts", operation: "Graph interrupt detected after resume stream" });
			handleInterruptPayload(response, activeInterrupt.value, tracker);
			writeAgentEvent(response, { type: "done", data: null }, tracker);
			response.end();
			tracker.log({ layer: "backend", module: "controller.ts", operation: "HTTP respond request completed (interrupted)" });
			tracker.printTimeline();
			return;
		}

		writeAgentEvent(
			response,
			{
				type: "thinking",
				data: { status: "completed", message: "Task update complete" },
			},
			tracker
		);

		if (finalResponsePayload) {
			await addMessage(conversationId, "assistant", typeof finalResponsePayload === "string" ? finalResponsePayload : JSON.stringify(finalResponsePayload));
			emitFinalResponse(response, finalResponsePayload, !isChartBlock && accumulatedText.length > 0, messageId, tracker);
		}

		writeAgentEvent(response, { type: "done", data: null }, tracker);
		response.end();
		tracker.log({ layer: "backend", module: "controller.ts", operation: "HTTP respond request completed" });
		tracker.printTimeline();
	} catch (error) {
		if (isGraphInterrupt(error)) {
			handleInterrupt(response, error);
			tracker.printTimeline();
			return;
		}
		if (!response.headersSent) return next(error);
		logger.error("Agent resume failed", error);
		writeAgentEvent(
			response,
			{
				type: "error",
				data: { code: "AGENT_RESUME_ERROR", message: "The assistant could not resume this request." },
			},
			tracker
		);
		writeAgentEvent(response, { type: "done", data: null }, tracker);
		response.end();
		tracker.log({ layer: "backend", module: "controller.ts", operation: "HTTP respond request completed (failed)" });
		tracker.printTimeline();
	} finally {
		finishRun(runId);
	}
};

function handleInterrupt(response: Parameters<RequestHandler>[1], error: unknown) {
	const interruptValue = (error as { interrupts?: Array<{ value?: unknown }> }).interrupts?.[0]?.value;
	handleInterruptPayload(response, interruptValue);
	response.end();
}

function handleInterruptPayload(response: Parameters<RequestHandler>[1], interruptValue: unknown, tracker?: AgentPerfTracker) {
	if (interruptValue && typeof interruptValue === "object" && "uploadId" in interruptValue) {
		const val = interruptValue as { uploadId: unknown; uploadUrl?: unknown; purpose?: unknown; contentTypes?: unknown[] };
		writeAgentEvent(
			response,
			{
				type: "upload_required",
				data: {
					uploadId: String(val.uploadId),
					uploadUrl: String(val.uploadUrl ?? ""),
					purpose: String(val.purpose ?? "product_image"),
					contentTypes: Array.isArray(val.contentTypes) ? val.contentTypes.map(String) : ["image/jpeg", "image/png", "image/webp"],
				},
			},
			tracker
		);
	} else if (interruptValue && typeof interruptValue === "object" && "confirmationId" in interruptValue) {
		const val = interruptValue as { confirmationId: unknown; message?: unknown; action?: unknown; options?: unknown[] };
		writeAgentEvent(
			response,
			{
				type: "confirmation",
				data: {
					confirmationId: String(val.confirmationId),
					message: String(val.message ?? "Please confirm this operation."),
					action: val.action && typeof val.action === "object" ? (val.action as { label: string }) : undefined,
					options: (val.options as Array<{ id: string; label: string; value: boolean }>) || [
						{ id: "approve", label: "Approve", value: true },
						{ id: "reject", label: "Cancel", value: false },
					],
				},
			},
			tracker
		);
	} else if (interruptValue && typeof interruptValue === "object" && "questionId" in interruptValue) {
		const val = interruptValue as { questionId: unknown; message?: unknown; options?: unknown[]; allowTextInput?: boolean };
		writeAgentEvent(
			response,
			{
				type: "question",
				data: {
					questionId: String(val.questionId),
					message: String(val.message ?? "Please clarify your request."),
					options: val.options as Array<{ id: string; label: string; value: string }> | undefined,
					allowTextInput: Boolean(val.allowTextInput ?? true),
				},
			},
			tracker
		);
	} else {
		// Generic interrupt fallback
		writeAgentEvent(
			response,
			{
				type: "question",
				data: {
					questionId: `q_${Date.now()}`,
					message: typeof interruptValue === "string" ? interruptValue : "Human input required to proceed.",
					allowTextInput: true,
				},
			},
			tracker
		);
	}
}

// Aliases for backward compatibility
export const message = stream;
export const resume = respond;

export const cancel: RequestHandler = async (request, response) => {
	await trustedUser(request);
	sendSuccess(response, { cancelled: cancelRun(routeParam(request.params.runId)) });
};
