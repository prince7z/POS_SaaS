import { prisma } from "../../../lib/prisma";
import { createOpenRouterClient } from "../client/openRouterClient";

const MAX_TITLE_LENGTH = 60;

export const fallbackConversationTitle = (message: string) => {
	const text = message.replace(/\s+/g, " ").trim();
	return text.length > MAX_TITLE_LENGTH ? `${text.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…` : text;
};

const cleanTitle = (raw: string) =>
	raw
		.split("\n")[0]
		.replace(/^(title|conversation title)\s*:\s*/i, "")
		.replace(/^["'`*#\s]+|["'`*.\s]+$/g, "")
		.slice(0, MAX_TITLE_LENGTH)
		.trim();

/**
 * Gives an untitled conversation an immediate fallback name, then upgrades it
 * with a short LLM-written title. Never throws; titling must not break a chat.
 */
export const ensureConversationTitle = async (conversationId: string, firstMessage: string) => {
	try {
		const fallback = fallbackConversationTitle(firstMessage);
		const claimed = await prisma.agentConversation.updateMany({
			where: { id: conversationId, OR: [{ title: null }, { title: "" }] },
			data: { title: fallback },
		});
		if (claimed.count === 0) return;

		const raw = await createOpenRouterClient().invoke(
			[
				{
					role: "system",
					content:
						"Write a concise 2-6 word title for a chat that starts with the user message. Reply with the title only: no quotes, no punctuation at the end, no emojis.",
				},
				{ role: "user", content: firstMessage.slice(0, 500) },
			],
			undefined,
			undefined,
			{ nodeName: "conversation_title" },
		);
		const title = cleanTitle(typeof raw === "string" ? raw : "");
		if (title.length < 3) return;
		await prisma.agentConversation.updateMany({
			where: { id: conversationId, title: fallback },
			data: { title },
		});
	} catch {
		// The fallback title is already stored.
	}
};
