import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { getCredentials } from "../utils/credentialStore.js";

interface DecryptedGcpCredentials {
  projectId: string;
  serviceAccountEmail: string;
  privateKey: string;
}

function decodeGcpCredentials(encoded: string): DecryptedGcpCredentials | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    
    if (!parsed.projectId || !parsed.serviceAccountEmail || !parsed.privateKey) {
      console.warn('Invalid GCP credentials format');
      return null;
    }
    
    return {
      projectId: parsed.projectId,
      serviceAccountEmail: parsed.serviceAccountEmail,
      privateKey: parsed.privateKey
    };
  } catch (error) {
    console.error('Failed to decode GCP credentials:', error);
    return null;
  }
}

const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform.read-only",
  "https://www.googleapis.com/auth/compute.readonly",
  "https://www.googleapis.com/auth/devstorage.read_only",
  "https://www.googleapis.com/auth/sqlservice.admin",
  "https://www.googleapis.com/auth/monitoring.read",
  "https://www.googleapis.com/auth/cloud-billing.readonly",
];

const credentialPathFromEnv = () => {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  return path.resolve(raw.trim());
};

export const hasGcpCredentials = async (userId?: string): Promise<boolean> => {
  // Check database credentials first
  if (userId) {
    const dbCreds = await getCredentials(userId);
    if (dbCreds?.gcp) {
      const decoded = decodeGcpCredentials(dbCreds.gcp);
      if (decoded) {
        console.log('Using database GCP credentials for user:', userId);
        return true;
      }
    }
  }
  
  // Fallback to env credentials
  const resolved = credentialPathFromEnv();
  if (!resolved) {
    return false;
  }
  try {
    fs.accessSync(resolved, fs.constants.R_OK);
    return true;
  } catch (error) {
    console.warn("GCP credential file not readable", error);
    return false;
  }
};

export const createGoogleAuth = async (userId?: string): Promise<any> => {
  // Try database credentials first
  if (userId) {
    const dbCreds = await getCredentials(userId);
    if (dbCreds?.gcp) {
      const decoded = decodeGcpCredentials(dbCreds.gcp);
      if (decoded) {
        console.log('Using database GCP credentials for user:', userId);
        // Create auth with service account credentials
        return new google.auth.GoogleAuth({
          credentials: {
            client_email: decoded.serviceAccountEmail,
            private_key: decoded.privateKey,
          },
          scopes: DEFAULT_SCOPES,
        });
      }
    }
  }
  
  // Fallback to env credentials
  return new google.auth.GoogleAuth({
    keyFile: credentialPathFromEnv() ?? undefined,
    scopes: DEFAULT_SCOPES,
  });
};

export const resolveProjectId = async (userId?: string, auth?: any) => {
  // Try database credentials first
  if (userId) {
    const dbCreds = await getCredentials(userId);
    if (dbCreds?.gcp) {
      const decoded = decodeGcpCredentials(dbCreds.gcp);
      if (decoded?.projectId) {
        return decoded.projectId;
      }
    }
  }
  
  // Try env var
  if (process.env.GCP_PROJECT_ID) {
    return process.env.GCP_PROJECT_ID;
  }
  
  // Try from auth
  const authInstance = auth ?? await createGoogleAuth(userId);
  try {
    return await authInstance.getProjectId();
  } catch (error) {
    console.warn("Failed to resolve GCP project id", error);
    return null;
  }
};

export const getBillingAccountId = () => process.env.GCP_BILLING_ACCOUNT_ID ?? null;
