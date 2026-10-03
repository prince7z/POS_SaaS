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
