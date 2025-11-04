import { DescribeVpcsCommand, EC2Client, Vpc } from "@aws-sdk/client-ec2";
import { getAwsClientConfig, getTargetRegions } from "../aws/config.js";

const vpcClientPromises = new Map<string, Promise<EC2Client>>();

async function getVpcClient(region?: string, userId?: string): Promise<EC2Client> {
  // Don't cache user-specific clients
  if (userId) {
    return new EC2Client(await getAwsClientConfig(region, userId));
  }
  
  const targetRegion = region ?? getTargetRegions()[0];
  const cached = vpcClientPromises.get(targetRegion);
  if (cached) {
    return cached;
  }
  const promise = (async () => new EC2Client(await getAwsClientConfig(targetRegion)))();
  vpcClientPromises.set(targetRegion, promise);
  return promise;
}

export interface VpcSummary {
  id: string;
  name: string | null;
  cidrBlock: string | null;
  state: string | null;
  isDefault: boolean;
  region: string;
}

function extractNameTag(vpc: Vpc): string | null {
  const tag = (vpc.Tags ?? []).find((item) => item.Key === "Name");
  return tag?.Value ?? null;
}

export async function listVpcs(userId?: string): Promise<VpcSummary[]> {
  const regions = getTargetRegions();
  const results = await Promise.all(
    regions.map(async (region) => {
      try {
        const client = await getVpcClient(region, userId);
        const response = await client.send(new DescribeVpcsCommand({}));
        const vpcs = response.Vpcs ?? [];
        return vpcs.map((vpc) => ({
          id: vpc.VpcId ?? "unknown",
          name: extractNameTag(vpc),
          cidrBlock: vpc.CidrBlock ?? null,
          state: vpc.State ?? null,
          isDefault: vpc.IsDefault ?? false,
          region,
        }));
      } catch (error) {
        console.warn(`Failed to list VPCs in region ${region}:`, error);
        return [];
      }
    }),
  );

  return results.flat();
}
