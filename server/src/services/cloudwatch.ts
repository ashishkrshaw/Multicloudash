import { CloudWatchClient, DescribeAlarmsCommand } from "@aws-sdk/client-cloudwatch";
import { getAwsClientConfig, getTargetRegions } from "../aws/config.js";

const cloudWatchClientPromises = new Map<string, Promise<CloudWatchClient>>();

async function getCloudWatchClient(region?: string, userId?: string): Promise<CloudWatchClient> {
  // Don't cache user-specific clients
  if (userId) {
    return new CloudWatchClient(await getAwsClientConfig(region, userId));
  }
  
  const targetRegion = region ?? getTargetRegions()[0];
  const cached = cloudWatchClientPromises.get(targetRegion);
  if (cached) {
    return cached;
  }
  const promise = (async () => new CloudWatchClient(await getAwsClientConfig(targetRegion)))();
  cloudWatchClientPromises.set(targetRegion, promise);
  return promise;
}

export interface CloudWatchAlarmSummary {
  name: string;
  state: string;
  reason: string | null;
  updatedAt: string | null;
  metricName: string | null;
  namespace: string | null;
  region: string;
}

export async function listCloudWatchAlarms(userId?: string): Promise<CloudWatchAlarmSummary[]> {
  const regions = getTargetRegions();
  const results = await Promise.all(
    regions.map(async (region) => {
      try {
        const client = await getCloudWatchClient(region, userId);
        const summaries: CloudWatchAlarmSummary[] = [];
        let nextToken: string | undefined;

        do {
          const response = await client.send(
            new DescribeAlarmsCommand({ MaxRecords: 50, NextToken: nextToken ?? undefined }),
          );
          const alarms = response.MetricAlarms ?? [];
          summaries.push(
            ...alarms.map((alarm) => ({
              name: alarm.AlarmName ?? "unknown",
              state: alarm.StateValue ?? "UNKNOWN",
              reason: alarm.StateReason ?? null,
              updatedAt: alarm.StateUpdatedTimestamp?.toISOString() ?? null,
              metricName: alarm.MetricName ?? null,
              namespace: alarm.Namespace ?? null,
              region,
            })),
          );
          nextToken = response.NextToken;
        } while (nextToken);

        return summaries;
      } catch (error) {
        console.warn(`Failed to list CloudWatch alarms in region ${region}:`, error);
        return [];
      }
    }),
  );

  return results.flat();
}
