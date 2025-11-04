/**
 * AI Chat History Storage with PostgreSQL
 * Stores conversation history per user
 */
import { prisma } from './prisma.js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatConversation {
  userId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Add message to user's chat history
 */
export async function addChatMessage(
  userId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<ChatMessage> {
  const message = await prisma.chatMessage.create({
    data: {
      userId,
      role,
      content,
    },
  });

  console.log(`[ChatHistory] Added message for user: ${userId}`);

  // Keep only last 50 messages per user
  const messageCount = await prisma.chatMessage.count({
    where: { userId },
  });

  if (messageCount > 50) {
    const messagesToDelete = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: messageCount - 50,
      select: { id: true },
    });

    await prisma.chatMessage.deleteMany({
      where: {
        id: {
          in: messagesToDelete.map((m: { id: string }) => m.id),
        },
      },
    });
  }

  return {
    id: message.id,
    role: message.role as 'user' | 'assistant',
    content: message.content,
    timestamp: message.createdAt.getTime(),
  };
}

/**
 * Get user's chat history
 */
export async function getChatHistory(userId: string, limit?: number): Promise<ChatMessage[]> {
  const messages = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    timestamp: msg.createdAt.getTime(),
  }));
}

/**
 * Clear user's chat history
 */
export async function clearChatHistory(userId: string): Promise<boolean> {
  try {
    await prisma.chatMessage.deleteMany({
      where: { userId },
    });
    console.log(`[ChatHistory] Cleared for user: ${userId}`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get conversation metadata
 */
export async function getConversationMetadata(userId: string): Promise<{
  messageCount: number;
  createdAt: number | null;
  updatedAt: number | null;
  lastMessage: ChatMessage | null;
}> {
  const [messageCount, firstMessage, lastMessage] = await Promise.all([
    prisma.chatMessage.count({ where: { userId } }),
    prisma.chatMessage.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.chatMessage.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    messageCount,
    createdAt: firstMessage?.createdAt.getTime() || null,
    updatedAt: lastMessage?.createdAt.getTime() || null,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          role: lastMessage.role as 'user' | 'assistant',
          content: lastMessage.content,
          timestamp: lastMessage.createdAt.getTime(),
        }
      : null,
  };
}

/**
 * Delete old messages (cleanup)
 */
export async function cleanupOldMessages(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.chatMessage.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`[ChatHistory] Cleaned up ${result.count} old messages`);
  return result.count;
}

/**
 * Get all active conversations (admin)
 */
export async function getAllActiveConversations(): Promise<
  Array<{
    userId: string;
    messageCount: number;
    lastActivity: number;
  }>
> {
  const conversations = await prisma.chatMessage.groupBy({
    by: ['userId'],
    _count: {
      id: true,
    },
    _max: {
      createdAt: true,
    },
  });

  return conversations
    .map((conv) => ({
      userId: conv.userId,
      messageCount: conv._count.id,
      lastActivity: conv._max.createdAt?.getTime() || 0,
    }))
    .sort((a, b) => b.lastActivity - a.lastActivity);
}
