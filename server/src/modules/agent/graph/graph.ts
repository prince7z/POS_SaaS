import { END, START, StateGraph } from "@langchain/langgraph";
import { AgentState } from "./state";
import { createPlan } from "./planner";
import { createFinalResponse } from "./final";
import { executePlan } from "./executor";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

import type { AgentPerfTracker } from "../utils/perfLogger";

export const createAgentGraph = (checkpointer?: BaseCheckpointSaver) =>
	new StateGraph(AgentState)
		.addNode("planner", async (state, config) => {
			const tracker = config?.configurable?.tracker as AgentPerfTracker | undefined;
			tracker?.log({ layer: "langgraph", module: "planner.ts", operation: "planner start" });
			const pendingQuestion = state.plan?.steps.find((step) => step.type === "human_input");
			const answer = state.humanResponse === null
				? undefined
				: typeof state.humanResponse === "string"
					? state.humanResponse
					: JSON.stringify(state.humanResponse);
			const request = answer === undefined
				? state.request
				: [
					state.request,
					pendingQuestion?.type === "human_input" ? `Assistant's previous question: ${pendingQuestion.request.question}` : undefined,
					`User's answer: ${answer}`,
				].filter(Boolean).join("\n\n");
			const completedOperations = state.plan?.steps.flatMap((step) => {
				if (step.type !== "tool") return [];
				const result = state.stepResults[step.id];
				if (typeof result !== "object" || result === null || !("success" in result) || result.success !== true) return [];
				return [{ tool: step.tool, operation: step.operation, description: step.description }];
			}) ?? [];
			const plan = await createPlan(request, state.user, state.history, tracker, completedOperations);
			tracker?.log({ layer: "langgraph", module: "planner.ts", operation: "planner end" });
			return { plan, humanResponse: null };
		})
		.addNode("executor", async (state, config) => {
			const tracker = config?.configurable?.tracker as AgentPerfTracker | undefined;
			return executePlan(state, tracker);
		})
		.addNode("final", async (state, config) => {
			const onChunk = config?.configurable?.onChunk as ((chunk: string) => void) | undefined;
			const tracker = config?.configurable?.tracker as AgentPerfTracker | undefined;
			const signal = config?.signal as AbortSignal | undefined;
			const toolSteps = state.plan?.steps.filter((step) => step.type === "tool") ?? [];
			const failures = toolSteps.flatMap((step) => {
				const result = state.stepResults[step.id];
				if (typeof result !== "object" || result === null || !("success" in result) || result.success !== false) return [];
				const message = "safeMessage" in result && typeof result.safeMessage === "string"
					? result.safeMessage
					: `The ${step.tool} operation ${step.operation} failed.`;
				return [message];
			});
			const allToolsFailed = toolSteps.length > 0 && failures.length === toolSteps.length;
			const failureResponse = allToolsFailed
				? `I couldn't complete the requested data retrieval:\n\n${[...new Set(failures)].map((message) => `- ${message}`).join("\n")}`
				: undefined;
			return {
				finalResponse: state.plan
					? failureResponse ?? await createFinalResponse(state.request, state.plan, state.stepResults, state.history, onChunk, tracker, signal)
					: "I could not create a plan for that request.",
			};
		})
		.addEdge(START, "planner")
		.addEdge("planner", "executor")
		.addConditionalEdges(
			"executor",
			(state) => state.humanResponse === null ? "final" : "planner",
			["final", "planner"],
		)
		.addEdge("final", END)
		.compile({ checkpointer });
