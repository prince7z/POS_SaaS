import { prisma } from "../../../lib/prisma";

const MAX_TITLE_LENGTH = 60;

export const fallbackConversationTitle = (message: string) => {
	const text = message.replace(/\s+/g, " ").trim();
	return text.length > MAX_TITLE_LENGTH ? `${text.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…` : text;
};

/** Assigns a compact title without spending an LLM call or depending on provider availability. */
export const ensureConversationTitle = async (conversationId: string, firstMessage: string) => {
	const title = fallbackConversationTitle(firstMessage);
	if (!title) return;
	await prisma.agentConversation.updateMany({
		where: { id: conversationId, OR: [{ title: null }, { title: "" }] },
		data: { title },
	});
};
