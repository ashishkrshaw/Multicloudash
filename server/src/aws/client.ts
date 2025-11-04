import { CostExplorerClient } from "@aws-sdk/client-cost-explorer";
import { getAwsClientConfig } from "./config.js";

// Cache for env-based client (when no userId provided)
let envClientPromise: Promise<CostExplorerClient> | null = null;

export async function getCostExplorerClient(userId?: string): Promise<CostExplorerClient> {
  // Don't cache user-specific clients
  if (userId) {
    return new CostExplorerClient(await getAwsClientConfig(undefined, userId));
  }
  
  // Cache env-based client
  if (envClientPromise) {
    return envClientPromise;
  }
  envClientPromise = (async () => new CostExplorerClient(await getAwsClientConfig()))();
  return envClientPromise;
}
