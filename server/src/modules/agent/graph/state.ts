import { Annotation } from "@langchain/langgraph";
import type { AgentUser, Plan } from "../schemas";

export const AgentState = Annotation.Root({
	request: Annotation<string>(),
	user: Annotation<AgentUser>(),
	history: Annotation<Array<{ role: string; content: string }>>({ reducer: (_previous, next) => next, default: () => [] }),
	plan: Annotation<Plan | null>({ reducer: (_previous, next) => next, default: () => null }),
	stepResults: Annotation<Record<string, unknown>>({ reducer: (_previous, next) => next, default: () => ({}) }),
	humanResponse: Annotation<Record<string, unknown> | null>({ reducer: (_previous, next) => next, default: () => null }),
	finalResponse: Annotation<string | null>({ reducer: (_previous, next) => next, default: () => null }),
});

export type AgentGraphState = typeof AgentState.State;
