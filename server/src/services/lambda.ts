import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { getAwsClientConfig, getTargetRegions } from "../aws/config.js";

const lambdaClientPromises = new Map<string, Promise<LambdaClient>>();

async function getLambdaClient(region?: string, userId?: string): Promise<LambdaClient> {
  // Don't cache user-specific clients
  if (userId) {
    return new LambdaClient(await getAwsClientConfig(region, userId));
  }
  
  const targetRegion = region ?? getTargetRegions()[0];
  const cached = lambdaClientPromises.get(targetRegion);
  if (cached) {
    return cached;
  }
  const promise = (async () => new LambdaClient(await getAwsClientConfig(targetRegion)))();
  lambdaClientPromises.set(targetRegion, promise);
  return promise;
}

export interface LambdaFunctionSummary {
  name: string;
  runtime: string | null;
  lastModified: string | null;
  memorySizeMb: number | null;
  timeoutSeconds: number | null;
  version: string | null;
  region: string;
}

export async function listLambdaFunctions(userId?: string): Promise<LambdaFunctionSummary[]> {
  const regions = getTargetRegions();
  const results = await Promise.all(
    regions.map(async (region) => {
      try {
        const client = await getLambdaClient(region, userId);
        const summaries: LambdaFunctionSummary[] = [];
        let marker: string | undefined;

        do {
          const response = await client.send(new ListFunctionsCommand({ MaxItems: 100, Marker: marker }));
          const functions = response.Functions ?? [];
          summaries.push(
            ...functions.map((fn) => ({
              name: fn.FunctionName ?? "unknown",
              runtime: fn.Runtime ?? null,
              lastModified: fn.LastModified ?? null,
              memorySizeMb: fn.MemorySize ?? null,
              timeoutSeconds: fn.Timeout ?? null,
              version: fn.Version ?? null,
              region,
            })),
          );
          marker = response.NextMarker;
        } while (marker);

        return summaries;
      } catch (error) {
        console.warn(`Failed to list Lambda functions in region ${region}:`, error);
        return [];
      }
    }),
  );

  return results.flat();
}
