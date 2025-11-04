import { CloudFrontClient, ListDistributionsCommand } from "@aws-sdk/client-cloudfront";
import { getAwsClientConfig } from "../aws/config.js";

let cloudFrontClientPromise: Promise<CloudFrontClient> | null = null;

async function getCloudFrontClient(userId?: string): Promise<CloudFrontClient> {
  // Don't cache user-specific clients
  if (userId) {
    return new CloudFrontClient(await getAwsClientConfig(undefined, userId));
  }
  
  if (cloudFrontClientPromise) {
    return cloudFrontClientPromise;
  }
  cloudFrontClientPromise = (async () => new CloudFrontClient(await getAwsClientConfig()))();
  return cloudFrontClientPromise;
}

export interface CloudFrontDistributionSummary {
  id: string;
  domainName: string;
  status: string;
  enabled: boolean;
  comment: string | null;
}

export async function listCloudFrontDistributions(userId?: string): Promise<CloudFrontDistributionSummary[]> {
  const client = await getCloudFrontClient(userId);
  const response = await client.send(new ListDistributionsCommand({}));
  const list = response.DistributionList?.Items ?? [];

  return list.map((distribution) => ({
    id: distribution.Id ?? "unknown",
    domainName: distribution.DomainName ?? "unknown",
    status: distribution.Status ?? "unknown",
    enabled: distribution.Enabled ?? false,
    comment: distribution.Comment ?? null,
  }));
}
