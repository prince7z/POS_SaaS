import { createOpenRouterClient } from "../client/openRouterClient";
import { planSchema, type AgentUser, type Plan } from "../schemas";
import { plannerSystemPrompt } from "../prompts/planner";

export const createPlan = async (request: string, user: AgentUser): Promise<Plan> => {
	const planner = createOpenRouterClient().withStructuredOutput(planSchema);
	return planSchema.parse(
		await planner.invoke([
			{ role: "system", content: plannerSystemPrompt },
			{
				role: "user",
				content: JSON.stringify({
					request,
					availablePermissions: user.permissions,
					instruction: "Create an ordered plan using only capability tools. The server will enforce permissions.",
				}),
			},
		]),
	);
};
