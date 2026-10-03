import type { RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { unauthorized, validationError } from "../../utils/errors";
import { sendSuccess } from "../../utils/apiResponse";
import { createAgentGraph } from "./graph/graph";
import { messageSchema, resumeSchema } from "./schemas";
import { addMessage, createConversation, getConversation, listConversations } from "./persistence";
import { finishRun, registerRun, cancelRun } from "./runtime/run-manager";
import { startAgentStream, writeAgentEvent } from "./streaming/events";
import { getAgentCheckpointer } from "./checkpoint";
import { Command, isGraphInterrupt } from "@langchain/langgraph";

const routeParam = (value: string | string[] | undefined) => {
	if (typeof value !== "string" || !value) throw validationError("Invalid conversation identifier");
	return value;
};

const trustedUser = async (request: Parameters<RequestHandler>[0]) => {
	if (!request.auth) throw unauthorized();
	const user = await prisma.user.findFirst({
		where: { id: request.auth.userId, companyId: request.auth.companyId, isActive: true, deletedAt: null },
		select: { id: true, companyId: true, accesses: true },
	});
	if (!user) throw unauthorized();
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

export const message: RequestHandler = async (request, response, next) => {
	const runId = randomUUID();
	try {
		const user = await trustedUser(request);
		const conversation = await getConversation(routeParam(request.params.conversationId), user.id, user.companyId);
		const { content } = messageSchema.parse(request.body);
		await addMessage(conversation.id, "user", content);
		const controller = registerRun(runId);
		startAgentStream(response);
		writeAgentEvent(response, { type: "run.started", runId });
		const graph = createAgentGraph(await getAgentCheckpointer());
		const result = await graph.invoke(
			{ request: content, user },
			{ configurable: { thread_id: conversation.id }, signal: controller.signal },
		);
		if (controller.signal.aborted) {
			response.end();
			return;
		}
		if (result.plan) {
			writeAgentEvent(response, {
				type: "plan.created",
				steps: result.plan.steps.map((step) => ({
					id: step.id,
					description: "description" in step ? step.description : "Awaiting input",
					status: "pending",
				})),
			});
		}
		const finalResponse = result.finalResponse ?? "I could not complete that request.";
		await addMessage(conversation.id, "assistant", finalResponse);
		writeAgentEvent(response, { type: "assistant.delta", content: finalResponse });
		writeAgentEvent(response, { type: "run.completed", runId });
		response.end();
	} catch (error) {
		if (isGraphInterrupt(error) && response.headersSent) {
			const interruptValue = (error as { interrupts?: Array<{ value?: unknown }> }).interrupts?.[0]?.value;
			if (interruptValue && typeof interruptValue === "object" && "uploadId" in interruptValue) {
				writeAgentEvent(response, {
					type: "upload.required",
					uploadId: String((interruptValue as { uploadId: unknown }).uploadId),
					uploadUrl: String((interruptValue as unknown as { uploadUrl?: unknown }).uploadUrl ?? ""),
					purpose: String((interruptValue as unknown as { purpose?: unknown }).purpose ?? "image"),
					contentTypes: Array.isArray((interruptValue as unknown as { contentTypes?: unknown }).contentTypes)
						? (interruptValue as unknown as { contentTypes: unknown[] }).contentTypes.map(String)
						: [],
				});
			} else if (interruptValue && typeof interruptValue === "object") {
				writeAgentEvent(response, { type: "human.input_required", request: interruptValue as never });
			}
			response.end();
			return;
		}
		if (!response.headersSent) return next(error);
		writeAgentEvent(response, { type: "run.error", message: "The assistant could not complete this request." });
		response.end();
	} finally {
		finishRun(runId);
	}
};

export const resume: RequestHandler = async (request, response, next) => {
	const user = await trustedUser(request);
	const conversation = await getConversation(routeParam(request.params.conversationId), user.id, user.companyId);
	const { response: resumeResponse } = resumeSchema.parse(request.body);
	const runId = randomUUID();
	try {
		const controller = registerRun(runId);
		startAgentStream(response);
		writeAgentEvent(response, { type: "run.started", runId });
		const graph = createAgentGraph(await getAgentCheckpointer());
		const result = await graph.invoke(new Command({ resume: resumeResponse }), {
			configurable: { thread_id: conversation.id },
			signal: controller.signal,
		});
		const finalResponse = result.finalResponse;
		if (finalResponse) {
			await addMessage(conversation.id, "assistant", finalResponse);
			writeAgentEvent(response, { type: "assistant.delta", content: finalResponse });
		}
		writeAgentEvent(response, { type: "run.completed", runId });
		response.end();
	} catch (error) {
		if (isGraphInterrupt(error)) {
			const interruptValue = (error as { interrupts?: Array<{ value?: unknown }> }).interrupts?.[0]?.value;
			if (interruptValue && typeof interruptValue === "object") {
				writeAgentEvent(response, { type: "human.input_required", request: interruptValue as never });
			}
			response.end();
			return;
		}
		if (!response.headersSent) return next(error);
		writeAgentEvent(response, { type: "run.error", message: "The assistant could not resume this request." });
		response.end();
	} finally {
		finishRun(runId);
	}
};

export const cancel: RequestHandler = async (request, response) => {
	await trustedUser(request);
	sendSuccess(response, { cancelled: cancelRun(routeParam(request.params.runId)) });
};
