/**
 * User Management Helper
 * Functions to create and manage users in the database
 */
import { prisma } from './prisma.js';

export interface UserData {
  email: string;
  name?: string;
  provider: 'google' | 'cognito';
  providerId: string;
}

/**
 * Create or update a user (called during authentication)
 */
export async function upsertUser(data: UserData): Promise<string> {
  const user = await prisma.user.upsert({
    where: { providerId: data.providerId },
    update: {
      email: data.email,
      name: data.name,
      updatedAt: new Date(),
    },
    create: {
      email: data.email,
      name: data.name,
      provider: data.provider,
      providerId: data.providerId,
    },
  });

  console.log(`[UserManager] Upserted user: ${user.email} (${user.id})`);
  return user.id;
}

/**
 * Get user by providerId
 */
export async function getUserByProviderId(providerId: string) {
  return await prisma.user.findUnique({
    where: { providerId },
    include: {
      credentials: true,
      _count: {
        select: {
          chatMessages: true,
          cacheEntries: true,
        },
      },
    },
  });
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  return await prisma.user.findUnique({
    where: { email },
    include: {
      credentials: true,
      _count: {
        select: {
          chatMessages: true,
          cacheEntries: true,
        },
      },
    },
  });
}

/**
 * Delete user and all related data (GDPR compliance)
 */
export async function deleteUser(userId: string): Promise<boolean> {
  try {
    // Cascade delete will automatically remove:
    // - credentials
    // - chat messages
    // - cache entries
    await prisma.user.delete({
      where: { id: userId },
    });
    
    console.log(`[UserManager] Deleted user: ${userId}`);
    return true;
  } catch (error) {
    console.error('[UserManager] Delete error:', error);
    return false;
  }
}

/**
 * Get user statistics
 */
export async function getUserStats(userId: string) {
  const [user, chatCount, cacheCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { credentials: true },
    }),
    prisma.chatMessage.count({
      where: { userId },
    }),
    prisma.cacheEntry.count({
      where: { userId },
    }),
  ]);

  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    provider: user.provider,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    hasCredentials: !!user.credentials,
    credentials: user.credentials
      ? {
          hasAws: !!user.credentials.awsEncrypted,
          hasAzure: !!user.credentials.azureEncrypted,
          hasGcp: !!user.credentials.gcpEncrypted,
        }
      : null,
    chatMessageCount: chatCount,
    cacheEntryCount: cacheCount,
  };
}

/**
 * List all users (admin only)
 */
export async function listAllUsers() {
  return await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      provider: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          chatMessages: true,
          cacheEntries: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}
