import { APIGatewayClient, GetRestApisCommand } from "@aws-sdk/client-api-gateway";
import { getAwsClientConfig, getTargetRegions } from "../aws/config.js";

const apiGatewayClientPromises = new Map<string, Promise<APIGatewayClient>>();

async function getApiGatewayClient(region?: string, userId?: string): Promise<APIGatewayClient> {
  // Don't cache user-specific clients
  if (userId) {
    return new APIGatewayClient(await getAwsClientConfig(region, userId));
  }
  
  const targetRegion = region ?? getTargetRegions()[0];
  const cached = apiGatewayClientPromises.get(targetRegion);
  if (cached) {
    return cached;
  }
  const promise = (async () => new APIGatewayClient(await getAwsClientConfig(targetRegion)))();
  apiGatewayClientPromises.set(targetRegion, promise);
  return promise;
}

export interface ApiGatewaySummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string | null;
  apiKeySource: string | null;
  region: string;
}

export async function listApiGateways(userId?: string): Promise<ApiGatewaySummary[]> {
  const regions = getTargetRegions();
  const results = await Promise.all(
    regions.map(async (region) => {
      try {
        const client = await getApiGatewayClient(region, userId);
        const summaries: ApiGatewaySummary[] = [];
        let position: string | undefined;

        do {
          const response = await client.send(new GetRestApisCommand({ limit: 50, position }));
          const items = response.items ?? [];
          summaries.push(
            ...items.map((api) => ({
              id: api.id ?? "unknown",
              name: api.name ?? api.id ?? "Unnamed API",
              description: api.description ?? null,
              createdAt: api.createdDate?.toISOString() ?? null,
              apiKeySource: api.apiKeySource ?? null,
              region,
            })),
          );
          position = response.position;
        } while (position);

        return summaries;
      } catch (error) {
        console.warn(`Failed to list API Gateway REST APIs in region ${region}:`, error);
        return [];
      }
    }),
  );

  return results.flat();
}
