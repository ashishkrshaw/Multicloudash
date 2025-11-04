/**
 * Data Caching System with PostgreSQL
 * Caches cloud API responses per user with 24-hour TTL
 * Prevents continuous API calls and improves performance
 */
import { prisma } from './prisma.js';

export interface CachedData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  provider: 'aws' | 'azure' | 'gcp';
  userId: string;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const DAILY_REFRESH_HOUR = 8; // 8 AM

/**
 * Get cached data if valid
 */
export async function getCachedData<T>(
  userId: string,
  provider: 'aws' | 'azure' | 'gcp',
  dataType: string
): Promise<T | null> {
  const cached = await prisma.cacheEntry.findUnique({
    where: {
      userId_provider_dataType: {
        userId,
        provider,
        dataType,
      },
    },
  });

  if (!cached) {
    return null;
  }

  // Check if expired
  if (new Date() > cached.expiresAt) {
    await prisma.cacheEntry.delete({
      where: { id: cached.id },
    });
    console.log(`[Cache] Expired: ${userId}:${provider}:${dataType}`);
    return null;
  }

  console.log(`[Cache] Hit: ${userId}:${provider}:${dataType}`);
  return cached.data as T;
}

/**
 * Set cached data with TTL
 */
export async function setCachedData<T>(
  userId: string,
  provider: 'aws' | 'azure' | 'gcp',
  dataType: string,
  data: T
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_DURATION);

  await prisma.cacheEntry.upsert({
    where: {
      userId_provider_dataType: {
        userId,
        provider,
        dataType,
      },
    },
    update: {
      data: data as any,
      expiresAt,
      updatedAt: now,
    },
    create: {
      userId,
      provider,
      dataType,
      data: data as any,
      expiresAt,
    },
  });

  console.log(`[Cache] Set: ${userId}:${provider}:${dataType} (expires in 24h)`);
}

/**
 * Invalidate cache for specific provider
 */
export async function invalidateCache(
  userId: string,
  provider: 'aws' | 'azure' | 'gcp',
  dataType?: string
): Promise<void> {
  if (dataType) {
    await prisma.cacheEntry.deleteMany({
      where: { userId, provider, dataType },
    });
    console.log(`[Cache] Invalidated: ${userId}:${provider}:${dataType}`);
  } else {
    await prisma.cacheEntry.deleteMany({
      where: { userId, provider },
    });
    console.log(`[Cache] Invalidated all: ${userId}:${provider}:*`);
  }
}

/**
 * Invalidate all cache for a user
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await prisma.cacheEntry.deleteMany({
    where: { userId },
  });
  console.log(`[Cache] Invalidated all for user: ${userId}`);
}

/**
 * Get cache statistics for a user
 */
export async function getUserCacheStats(userId: string): Promise<{
  totalEntries: number;
  providers: { aws: number; azure: number; gcp: number };
  oldestEntry: number | null;
  newestEntry: number | null;
}> {
  const entries = await prisma.cacheEntry.findMany({
    where: { userId },
    select: {
      provider: true,
      createdAt: true,
    },
  });

  const providers = { aws: 0, azure: 0, gcp: 0 };
  let oldestEntry: number | null = null;
  let newestEntry: number | null = null;

  entries.forEach((entry) => {
    if (entry.provider === 'aws' || entry.provider === 'azure' || entry.provider === 'gcp') {
      providers[entry.provider]++;
    }

    const timestamp = entry.createdAt.getTime();
    if (!oldestEntry || timestamp < oldestEntry) {
      oldestEntry = timestamp;
    }
    if (!newestEntry || timestamp > newestEntry) {
      newestEntry = timestamp;
    }
  });

  return {
    totalEntries: entries.length,
    providers,
    oldestEntry,
    newestEntry,
  };
}

/**
 * Check if it's time for daily refresh (8 AM)
 */
export async function shouldDailyRefresh(userId: string, provider: 'aws' | 'azure' | 'gcp'): Promise<boolean> {
  const now = new Date();
  const currentHour = now.getHours();

  // Check if we're in the refresh window (8 AM - 9 AM)
  if (currentHour < DAILY_REFRESH_HOUR || currentHour >= DAILY_REFRESH_HOUR + 1) {
    return false;
  }

  // Check if we already refreshed today
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const lastRefresh = await prisma.refreshLog.findFirst({
    where: {
      userId,
      provider,
      refreshedAt: {
        gte: todayStart,
      },
    },
    orderBy: {
      refreshedAt: 'desc',
    },
  });

  return !lastRefresh;
}

/**
 * Mark daily refresh as complete
 */
export async function markDailyRefreshComplete(
  userId: string,
  provider: 'aws' | 'azure' | 'gcp'
): Promise<void> {
  await prisma.refreshLog.create({
    data: {
      userId,
      provider,
    },
  });
  console.log(`[Cache] Marked daily refresh complete: ${provider}`);
}

/**
 * Get time until next refresh
 */
export function getTimeUntilRefresh(userId: string, provider: 'aws' | 'azure' | 'gcp'): {
  hours: number;
  minutes: number;
  nextRefreshTime: Date;
} {
  const now = new Date();
  const nextRefresh = new Date(now);

  // Set to next 8 AM
  nextRefresh.setHours(DAILY_REFRESH_HOUR, 0, 0, 0);

  // If 8 AM already passed today, set to tomorrow
  if (now.getHours() >= DAILY_REFRESH_HOUR) {
    nextRefresh.setDate(nextRefresh.getDate() + 1);
  }

  const diff = nextRefresh.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return {
    hours,
    minutes,
    nextRefreshTime: nextRefresh,
  };
}

/**
 * Clear all cache (maintenance)
 */
export async function clearAllCache(): Promise<void> {
  await prisma.cacheEntry.deleteMany({});
  console.log('[Cache] Cleared all cache');
}

/**
 * Cleanup expired cache entries (run periodically)
 */
export async function cleanupExpiredCache(): Promise<number> {
  const result = await prisma.cacheEntry.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
  
  console.log(`[Cache] Cleaned up ${result.count} expired entries`);
  return result.count;
}
