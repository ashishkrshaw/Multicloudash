import { ClientSecretCredential } from "@azure/identity";
import { ComputeManagementClient } from "@azure/arm-compute";
import { NetworkManagementClient } from "@azure/arm-network";
import { StorageManagementClient } from "@azure/arm-storage";
import { SqlManagementClient } from "@azure/arm-sql";
import { MonitorClient } from "@azure/arm-monitor";
import { CostManagementClient } from "@azure/arm-costmanagement";
import { ResourceManagementClient } from "@azure/arm-resources";
import { MySQLManagementFlexibleServerClient } from "@azure/arm-mysql-flexible";
import { PostgreSQLManagementFlexibleServerClient } from "@azure/arm-postgresql-flexible";
import { getCredentials } from "../utils/credentialStore.js";

interface DecryptedAzureCredentials {
  subscriptionId: string;
  clientId: string;
  clientSecret: string;
  tenantId: string;
}

/**
 * Decode Azure credentials from base64 JSON
 */
function decodeAzureCredentials(encoded: string): DecryptedAzureCredentials | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (parsed.subscriptionId && parsed.clientId && parsed.clientSecret && parsed.tenantId) {
      return parsed;
    }
    return null;
  } catch (error) {
    console.error('[Azure Config] Failed to decode credentials:', error);
    return null;
  }
}

const ENV_ALIASES: Record<string, string[]> = {
  tenantId: ["TENANT_ID", "AZURE_TENANT_ID"],
  clientId: ["CLIENT_ID", "AZURE_CLIENT_ID"],
  clientSecret: ["CLIENT_SECRET", "AZURE_CLIENT_SECRET"],
  subscriptionId: ["SUBSCRIPTION_ID", "AZURE_SUBSCRIPTION_ID"],
};

const readEnv = (aliases: string[]): string => {
  for (const key of aliases) {
    const raw = process.env[key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.trim().replace(/^"|"$/g, "");
    }
  }
  return "";
};

const reportMissing = (label: string, aliases: string[]) => {
  throw new Error(`Missing required Azure environment variable. Set one of: ${aliases.join(", ")} (${label}).`);
};

const tenantId = readEnv(ENV_ALIASES.tenantId);
const clientId = readEnv(ENV_ALIASES.clientId);
const clientSecret = readEnv(ENV_ALIASES.clientSecret);
const subscriptionId = readEnv(ENV_ALIASES.subscriptionId);

export const hasAzureCredentials = Boolean(tenantId && clientId && clientSecret && subscriptionId);

const credential = hasAzureCredentials
  ? new ClientSecretCredential(tenantId, clientId, clientSecret)
  : null;

/**
 * Get Azure credentials from database or fallback to env
 */
async function getAzureCredential(userId?: string): Promise<{ credential: ClientSecretCredential; subscriptionId: string } | null> {
  // Try to get from database if userId provided
  if (userId) {
    try {
      const storedCreds = await getCredentials(userId);
      if (storedCreds?.azure) {
        const decoded = decodeAzureCredentials(storedCreds.azure);
        if (decoded) {
          console.log(`[Azure Config] Using database credentials for user: ${userId}`);
          const userCredential = new ClientSecretCredential(
            decoded.tenantId,
            decoded.clientId,
            decoded.clientSecret
          );
          return {
            credential: userCredential,
            subscriptionId: decoded.subscriptionId,
          };
        }
      }
      console.log(`[Azure Config] No database credentials found for user: ${userId}, falling back to env`);
    } catch (error) {
      console.error(`[Azure Config] Error fetching credentials for user ${userId}:`, error);
    }
  }

  // Fallback to env credentials
  if (credential && subscriptionId) {
    return { credential, subscriptionId };
  }
  
  return null;
}

const requireCredential = async (userId?: string) => {
  const creds = await getAzureCredential(userId);
  if (!creds) {
    if (!tenantId) {
      reportMissing("tenant", ENV_ALIASES.tenantId);
    }
    if (!clientId) {
      reportMissing("client", ENV_ALIASES.clientId);
    }
    if (!clientSecret) {
      reportMissing("secret", ENV_ALIASES.clientSecret);
    }
    reportMissing("subscription", ENV_ALIASES.subscriptionId);
  }
  return creds;
};

export const getComputeClient = async (userId?: string) => {
  const creds = await requireCredential(userId);
  if (!creds) throw new Error('Azure credentials not available');
  return new ComputeManagementClient(creds.credential, creds.subscriptionId);
};

export const getNetworkClient = async (userId?: string) => {
  const creds = await requireCredential(userId);
  if (!creds) throw new Error('Azure credentials not available');
  return new NetworkManagementClient(creds.credential, creds.subscriptionId);
};

export const getStorageClient = async (userId?: string) => {
  const creds = await requireCredential(userId);
  if (!creds) throw new Error('Azure credentials not available');
  return new StorageManagementClient(creds.credential, creds.subscriptionId);
};

export const getSqlClient = async (userId?: string) => {
  const creds = await requireCredential(userId);
  if (!creds) throw new Error('Azure credentials not available');
  return new SqlManagementClient(creds.credential, creds.subscriptionId);
};

export const getMonitorClient = async (userId?: string) => {
  const creds = await requireCredential(userId);
  if (!creds) throw new Error('Azure credentials not available');
  return new MonitorClient(creds.credential, creds.subscriptionId);
};

export const getCostManagementClient = async (userId?: string) => {
  const creds = await requireCredential(userId);
  if (!creds) throw new Error('Azure credentials not available');
  return new CostManagementClient(creds.credential);
};

export const getResourceClient = async (userId?: string) => {
  const creds = await requireCredential(userId);
  if (!creds) throw new Error('Azure credentials not available');
  return new ResourceManagementClient(creds.credential, creds.subscriptionId);
};

export const getMySqlClient = async (userId?: string) => {
  const creds = await requireCredential(userId);
  if (!creds) throw new Error('Azure credentials not available');
  return new MySQLManagementFlexibleServerClient(creds.credential, creds.subscriptionId);
};

export const getPostgresClient = async (userId?: string) => {
  const creds = await requireCredential(userId);
  if (!creds) throw new Error('Azure credentials not available');
  return new PostgreSQLManagementFlexibleServerClient(creds.credential, creds.subscriptionId);
};

export const getAzureScope = async (userId?: string) => {
  const creds = await requireCredential(userId);
  if (!creds) throw new Error('Azure credentials not available');
  return `subscriptions/${creds.subscriptionId}`;
};
