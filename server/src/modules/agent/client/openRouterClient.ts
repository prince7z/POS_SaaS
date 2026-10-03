import { ChatOpenAI } from "@langchain/openai";
import { env } from "../../../config/env";

const OPEN_ROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const createOpenRouterClient = () => {
	if (!env.agent.openRouterApiKey) {
		throw new Error("Agent model is not configured");
	}

	return new ChatOpenAI({
		apiKey: env.agent.openRouterApiKey,
		model: env.agent.model,
		temperature: 0,
		configuration: {
			baseURL: OPEN_ROUTER_BASE_URL,
			defaultHeaders: {
				"HTTP-Referer": env.agent.siteUrl,
				"X-Title": env.agent.siteName,
			},
		},
	});
};
