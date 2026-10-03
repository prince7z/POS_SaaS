import { z } from "zod";
import type { Access } from "@prisma/client";

export const agentUserSchema = z.object({
	id: z.string().uuid(),
	companyId: z.string().uuid(),
	permissions: z.array(z.string()),
});

export type AgentUser = z.infer<typeof agentUserSchema>;

const toolStepSchema = z.object({
	id: z.string().min(1),
	type: z.literal("tool"),
	tool: z.string().min(1),
	operation: z.string().min(1),
	args: z.record(z.string(), z.unknown()),
	dependsOn: z.array(z.string()),
	description: z.string().min(1),
	requiresConfirmation: z.boolean().optional(),
});

const humanStepSchema = z.object({
	id: z.string().min(1),
	type: z.literal("human_input"),
	request: z.object({
		type: z.enum(["question", "choice", "confirmation", "form", "upload"]),
		question: z.string().min(1),
		options: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
		allowOther: z.boolean().optional(),
	}),
	dependsOn: z.array(z.string()),
});

const finalStepSchema = z.object({
	id: z.string().min(1),
	type: z.literal("final"),
	description: z.string().min(1),
	dependsOn: z.array(z.string()),
});

export const planSchema = z.object({
	steps: z.array(z.discriminatedUnion("type", [toolStepSchema, humanStepSchema, finalStepSchema])),
});

export type Plan = z.infer<typeof planSchema>;
export type PlanStep = Plan["steps"][number];

export type AgentToolResult<T = unknown> =
	| { success: true; data: T; summary?: string }
	| { success: false; errorCode: string; safeMessage: string; retryable: boolean };

export type AgentToolDefinition = {
	name: string;
	description: string;
	operations: readonly string[];
	requiredAccessByOperation: Partial<Record<string, Access>>;
};

export const messageSchema = z.object({
	content: z.string().trim().min(1).max(10_000),
});

export const resumeSchema = z.object({
	response: z.record(z.string(), z.unknown()),
});
