import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../utils/errors";

export const getConversation = async (id: string, userId: string, companyId: string) => {
	const conversation = await prisma.agentConversation.findFirst({
		where: { id, userId, companyId },
		include: { messages: { orderBy: { createdAt: "asc" } } },
	});
	if (!conversation) throw new NotFoundError("Conversation not found");
	return conversation;
};

export const createConversation = (userId: string, companyId: string, title?: string) =>
	prisma.agentConversation.create({ data: { userId, companyId, title } });

export const listConversations = (userId: string, companyId: string) =>
	prisma.agentConversation.findMany({
		where: { userId, companyId },
		orderBy: { updatedAt: "desc" },
	});

export const addMessage = (conversationId: string, role: "user" | "assistant", content: string) =>
	prisma.agentMessage.create({ data: { conversationId, role, content } });

export const getConversationHistory = async (conversationId: string, limit = 10) => {
	const messages = await prisma.agentMessage.findMany({
		where: { conversationId },
		orderBy: { createdAt: "desc" },
		take: Math.min(limit, 8),
	});
	let remainingCharacters = 5_000;
	const recentFirst = messages.flatMap((message: { role: string; content: string }) => {
		if (remainingCharacters <= 0) return [];
		const content = message.content.slice(0, Math.min(1_200, remainingCharacters)).trim();
		remainingCharacters -= content.length;
		return content ? [{ role: message.role, content }] : [];
	});
	return recentFirst.reverse();
};
