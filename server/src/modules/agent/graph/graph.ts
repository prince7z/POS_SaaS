import { END, START, StateGraph } from "@langchain/langgraph";
import { AgentState } from "./state";
import { createPlan } from "./planner";
import { createFinalResponse } from "./final";
import { executePlan } from "./executor";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

export const createAgentGraph = (checkpointer?: BaseCheckpointSaver) =>
	new StateGraph(AgentState)
		.addNode("planner", async (state) => ({ plan: await createPlan(state.request, state.user) }))
		.addNode("executor", executePlan)
		.addNode("final", async (state) => ({
			finalResponse: state.plan
				? await createFinalResponse(state.request, state.plan, state.stepResults)
				: "I could not create a plan for that request.",
		}))
		.addEdge(START, "planner")
		.addEdge("planner", "executor")
		.addEdge("executor", "final")
		.addEdge("final", END)
		.compile({ checkpointer });
