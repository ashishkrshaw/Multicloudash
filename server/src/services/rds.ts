import { DescribeDBInstancesCommand, RDSClient } from "@aws-sdk/client-rds";
import { getAwsClientConfig, getTargetRegions } from "../aws/config.js";

const rdsClientPromises = new Map<string, Promise<RDSClient>>();

async function getRdsClient(region?: string, userId?: string): Promise<RDSClient> {
  // Don't cache user-specific clients
  if (userId) {
    return new RDSClient(await getAwsClientConfig(region, userId));
  }
  
  const targetRegion = region ?? getTargetRegions()[0];
  const cached = rdsClientPromises.get(targetRegion);
  if (cached) {
    return cached;
  }
  const promise = (async () => new RDSClient(await getAwsClientConfig(targetRegion)))();
  rdsClientPromises.set(targetRegion, promise);
  return promise;
}

export interface RdsInstanceSummary {
  identifier: string;
  engine: string | null;
  engineVersion: string | null;
  instanceClass: string | null;
  status: string | null;
  endpoint: string | null;
  allocatedStorageGb: number | null;
  multiAz: boolean;
  region: string;
}

export async function listRdsInstances(userId?: string): Promise<RdsInstanceSummary[]> {
  const regions = getTargetRegions();
  const results = await Promise.all(
    regions.map(async (region) => {
      try {
        const client = await getRdsClient(region, userId);
        const summaries: RdsInstanceSummary[] = [];
        let marker: string | undefined;

        do {
          const response = await client.send(new DescribeDBInstancesCommand({ Marker: marker }));
          const instances = response.DBInstances ?? [];
          summaries.push(
            ...instances.map((instance) => ({
              identifier: instance.DBInstanceIdentifier ?? "unknown",
              engine: instance.Engine ?? null,
              engineVersion: instance.EngineVersion ?? null,
              instanceClass: instance.DBInstanceClass ?? null,
              status: instance.DBInstanceStatus ?? null,
              endpoint: instance.Endpoint?.Address ?? null,
              allocatedStorageGb: instance.AllocatedStorage ?? null,
              multiAz: instance.MultiAZ ?? false,
              region,
            })),
          );
          marker = response.Marker;
        } while (marker);

        return summaries;
      } catch (error) {
        console.warn(`Failed to list RDS instances in region ${region}:`, error);
        return [];
      }
    }),
  );

  return results.flat();
}
