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
			const plan = await createPlan(state.request, state.user, tracker);
			tracker?.log({ layer: "langgraph", module: "planner.ts", operation: "planner end" });
			return { plan };
		})
		.addNode("executor", async (state, config) => {
			const tracker = config?.configurable?.tracker as AgentPerfTracker | undefined;
			return executePlan(state, tracker);
		})
		.addNode("final", async (state, config) => {
			const onChunk = config?.configurable?.onChunk as ((chunk: string) => void) | undefined;
			const tracker = config?.configurable?.tracker as AgentPerfTracker | undefined;
			return {
				finalResponse: state.plan
					? await createFinalResponse(state.request, state.plan, state.stepResults, onChunk, tracker)
					: "I could not create a plan for that request.",
			};
		})
		.addEdge(START, "planner")
		.addEdge("planner", "executor")
		.addEdge("executor", "final")
		.addEdge("final", END)
		.compile({ checkpointer });
