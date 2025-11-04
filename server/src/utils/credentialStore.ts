/**
 * Database Credential Store
 * Stores encrypted credentials per user in PostgreSQL
 */
import { prisma } from './prisma.js';

export interface EncryptedCredentials {
  aws?: string; // Base64 encrypted JSON
  azure?: string;
  gcp?: string;
}

/**
 * Store encrypted credentials for a user
 * Note: User must already exist in database (created during auth)
 */
export async function storeCredentials(userId: string, credentials: EncryptedCredentials): Promise<void> {
  // Upsert credentials (user should already exist from auth)
  await prisma.credential.upsert({
    where: { userId },
    update: {
      awsEncrypted: credentials.aws || null,
      azureEncrypted: credentials.azure || null,
      gcpEncrypted: credentials.gcp || null,
      updatedAt: new Date(),
    },
    create: {
      userId,
      awsEncrypted: credentials.aws || null,
      azureEncrypted: credentials.azure || null,
      gcpEncrypted: credentials.gcp || null,
    },
  });

  console.log(`[CredentialStore] Stored credentials for user: ${userId}`);
}

/**
 * Get encrypted credentials for a user
 */
export async function getCredentials(userId: string): Promise<EncryptedCredentials | null> {
  const credential = await prisma.credential.findUnique({
    where: { userId },
  });

  if (!credential) {
    console.log(`[CredentialStore] No credentials found for user: ${userId}`);
    return null;
  }

  const result: EncryptedCredentials = {};
  if (credential.awsEncrypted) result.aws = credential.awsEncrypted;
  if (credential.azureEncrypted) result.azure = credential.azureEncrypted;
  if (credential.gcpEncrypted) result.gcp = credential.gcpEncrypted;

  return result;
}

/**
 * Delete credentials for a user
 */
export async function deleteCredentials(userId: string): Promise<boolean> {
  try {
    await prisma.credential.delete({
      where: { userId },
    });
    console.log(`[CredentialStore] Deleted credentials for user: ${userId}`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if user has credentials stored
 */
export async function hasCredentials(userId: string): Promise<boolean> {
  const count = await prisma.credential.count({
    where: { userId },
  });
  return count > 0;
}

/**
 * Get all users with credentials (admin only)
 */
export async function getAllUserIds(): Promise<string[]> {
  const credentials = await prisma.credential.findMany({
    select: { userId: true },
  });
  return credentials.map((c: { userId: string }) => c.userId);
}

/**
 * Clear all credentials (for testing/maintenance)
 */
export async function clearAllCredentials(): Promise<void> {
  await prisma.credential.deleteMany({});
  console.log('[CredentialStore] Cleared all credentials');
}
