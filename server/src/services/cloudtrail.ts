import { CloudTrailClient, DescribeTrailsCommand } from "@aws-sdk/client-cloudtrail";
import { getAwsClientConfig } from "../aws/config.js";

let cloudTrailClientPromise: Promise<CloudTrailClient> | null = null;

async function getCloudTrailClient(userId?: string): Promise<CloudTrailClient> {
  // Don't cache user-specific clients
  if (userId) {
    return new CloudTrailClient(await getAwsClientConfig(undefined, userId));
  }
  
  if (cloudTrailClientPromise) {
    return cloudTrailClientPromise;
  }
  cloudTrailClientPromise = (async () => new CloudTrailClient(await getAwsClientConfig()))();
  return cloudTrailClientPromise;
}

export interface CloudTrailSummary {
  name: string;
  arn: string;
  homeRegion: string | null;
  multiRegion: boolean;
  organizationTrail: boolean;
}

export async function listTrails(userId?: string): Promise<CloudTrailSummary[]> {
  const client = await getCloudTrailClient(userId);
  const response = await client.send(new DescribeTrailsCommand({ includeShadowTrails: true }));
  const trails = response.trailList ?? [];

  return trails.map((trail) => ({
    name: trail.Name ?? "unknown",
    arn: trail.TrailARN ?? "",
    homeRegion: trail.HomeRegion ?? null,
    multiRegion: trail.IsMultiRegionTrail ?? false,
    organizationTrail: trail.IsOrganizationTrail ?? false,
  }));
}
