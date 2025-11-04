import { fromIni, fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";
import { getCredentials } from "../utils/credentialStore.js";

const defaultRegion = process.env.AWS_REGION || "us-east-1";

interface DecryptedAwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

/**
 * Decode credentials from base64 JSON
 * Note: Credentials are currently stored as base64-encoded JSON (not encrypted on backend)
 * Frontend handles encryption before sending to backend
 */
function decodeAwsCredentials(encoded: string): DecryptedAwsCredentials | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (parsed.accessKeyId && parsed.secretAccessKey) {
      return parsed;
    }
    return null;
  } catch (error) {
    console.error('[AWS Config] Failed to decode credentials:', error);
    return null;
  }
}
const regionListEnv = process.env.AWS_REGIONS;
const fallbackRegions = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "af-south-1",
  "ap-east-1",
  "ap-south-1",
  "ap-south-2",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-southeast-3",
  "ap-southeast-4",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-northeast-3",
  "ca-central-1",
  "ca-west-1",
  "eu-central-1",
  "eu-central-2",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-north-1",
  "eu-south-1",
  "eu-south-2",
  "il-central-1",
  "me-south-1",
  "me-central-1",
  "sa-east-1",
];

let credentialsPromise: Promise<AwsCredentialIdentityProvider | undefined> | null = null;

async function resolveCredentials(): Promise<AwsCredentialIdentityProvider | undefined> {
  if (credentialsPromise) {
    return credentialsPromise;
  }

  const profile = process.env.AWS_PROFILE;
  const roleArn = process.env.AWS_ROLE_ARN;

  if (roleArn) {
    credentialsPromise = Promise.resolve(
      fromTemporaryCredentials({
        params: {
          RoleArn: roleArn,
          RoleSessionName: "CloudCtrlDashboardSession",
        },
        ...(profile ? { masterCredentials: fromIni({ profile }) } : {}),
      }),
    );
    return credentialsPromise;
  }

  if (profile) {
    credentialsPromise = Promise.resolve(fromIni({ profile }));
    return credentialsPromise;
  }

  credentialsPromise = Promise.resolve(undefined);
  return credentialsPromise;
}

export interface AwsClientConfig {
  region: string;
  credentials?: AwsCredentialIdentityProvider | { accessKeyId: string; secretAccessKey: string };
}

export async function getAwsClientConfig(regionOverride?: string, userId?: string): Promise<AwsClientConfig> {
  // If userId provided, try to get credentials from database
  if (userId) {
    try {
      const storedCreds = await getCredentials(userId);
      if (storedCreds?.aws) {
        // Decode the base64-encoded credentials
        const decoded = decodeAwsCredentials(storedCreds.aws);
        if (decoded) {
          const region = regionOverride ?? decoded.region ?? defaultRegion;
          console.log(`[AWS Config] Using database credentials for user: ${userId}, region: ${region}`);
          return {
            region,
            credentials: {
              accessKeyId: decoded.accessKeyId,
              secretAccessKey: decoded.secretAccessKey,
            },
          };
        }
      }
      console.log(`[AWS Config] No database credentials found for user: ${userId}, falling back to env`);
    } catch (error) {
      console.error(`[AWS Config] Error fetching credentials for user ${userId}:`, error);
    }
  }

  // Fallback to env-based credentials
  const credentials = await resolveCredentials();
  const region = regionOverride ?? defaultRegion;
  return credentials ? { region, credentials } : { region };
}

export function getTargetRegions(): string[] {
  if (regionListEnv) {
    const regions = regionListEnv
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (regions.length > 0) {
      return Array.from(new Set(regions));
    }
  }
  return fallbackRegions;
}
