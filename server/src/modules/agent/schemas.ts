import { z } from "zod";
import type { Access } from "@prisma/client";

export const agentUserSchema = z.object({
	id: z.string().uuid(),
	companyId: z.string().uuid(),
	permissions: z.array(z.string()),
	userName: z.string().optional(),
	companyName: z.string().optional(),
	companyLogoUrl: z.string().nullable().optional(),
});

export type AgentUser = z.infer<typeof agentUserSchema>;

const toolStepSchema = z.object({
	id: z.string().optional().transform((val) => val || "step_tool"),
	type: z.literal("tool"),
	tool: z.string().optional().transform((val) => val || "unknown_tool"),
	operation: z.string().optional().transform((val) => val || "execute"),
	args: z.record(z.string(), z.unknown()).optional().transform((val) => val ?? {}),
	dependsOn: z.array(z.string()).optional().transform((val) => val ?? []),
	description: z.string().optional().transform((val) => val || "Execute tool step"),
	requiresConfirmation: z.boolean().optional(),
});

const optionItemSchema = z.union([
	z.string().transform((val) => ({ id: val, label: val, value: val })),
	z.number().transform((val) => ({ id: String(val), label: String(val), value: val })),
	z.boolean().transform((val) => ({ id: String(val), label: String(val), value: val })),
	z.object({
		id: z.unknown().optional(),
		label: z.unknown().optional(),
		value: z.unknown().optional(),
	}).transform((opt) => {
		const label = String(opt.label || opt.id || opt.value || "Option");
		const id = String(opt.id || opt.value || label);
		return {
			id,
			label,
			value: opt.value ?? id,
		};
	}),
]);

const humanStepSchema = z.object({
	id: z.string().optional().transform((val) => val || "step_human"),
	type: z.literal("human_input"),
	request: z.object({
		type: z.string().optional().transform((val) => {
			if (!val) return "question";
			const lower = val.toLowerCase();
			if (lower.includes("confirm") || lower.includes("approve")) return "confirmation";
			if (lower.includes("upload") || lower.includes("image")) return "upload";
			return "question";
		}),
		question: z.string().optional().transform((val) => val || "Please provide clarification."),
		options: z.array(optionItemSchema).optional(),
		allowOther: z.boolean().optional(),
	}),
	dependsOn: z.array(z.string()).optional().transform((val) => val ?? []),
});

const finalStepSchema = z.object({
	id: z.string().optional().transform((val) => val || "step_final"),
	type: z.literal("final"),
	description: z.string().optional().transform((val) => val || "Finalize response"),
	dependsOn: z.array(z.string()).optional().transform((val) => val ?? []),
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
