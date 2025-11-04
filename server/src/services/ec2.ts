import {
  EC2Client,
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  Reservation,
  Instance,
} from "@aws-sdk/client-ec2";
import { getAwsClientConfig, getTargetRegions } from "../aws/config.js";

export type Ec2LifecycleState =
  | "pending"
  | "running"
  | "shutting-down"
  | "terminated"
  | "stopping"
  | "stopped"
  | "rebooting"
  | "unknown";

export interface Ec2InstanceSummary {
  id: string;
  name: string;
  type: string;
  state: Ec2LifecycleState;
  region: string;
  availabilityZone: string | null;
  publicIp: string | null;
  privateIp: string | null;
  launchTime: string | null;
}

const ec2ClientPromises = new Map<string, Promise<EC2Client>>();

async function getEc2Client(region?: string, userId?: string): Promise<EC2Client> {
  const targetRegion = region ?? getTargetRegions()[0];
  // Create unique cache key including userId if provided
  const cacheKey = userId ? `${targetRegion}-${userId}` : targetRegion;
  const cached = ec2ClientPromises.get(cacheKey);
  if (cached) {
    return cached;
  }
  const promise = (async () => new EC2Client(await getAwsClientConfig(targetRegion, userId)))();
  ec2ClientPromises.set(cacheKey, promise);
  return promise;
}

function extractNameTag(instance: Instance): string | undefined {
  const tags = instance.Tags ?? [];
  const nameTag = tags.find((tag) => tag.Key === "Name");
  return nameTag?.Value;
}

function normaliseState(state?: Instance["State"]): Ec2LifecycleState {
  const name = state?.Name;
  if (!name) return "unknown";
  const validStates: Ec2LifecycleState[] = [
    "pending",
    "running",
    "shutting-down",
    "terminated",
    "stopping",
    "stopped",
    "rebooting",
    "unknown",
  ];
  if ((validStates as string[]).includes(name)) {
    return name as Ec2LifecycleState;
  }
  return "unknown";
}

function toSummary(instance: Instance, region: string): Ec2InstanceSummary {
  return {
    id: instance.InstanceId ?? "unknown",
    name: extractNameTag(instance) ?? instance.InstanceId ?? "Unnamed instance",
    type: instance.InstanceType ?? "unknown",
    state: normaliseState(instance.State),
    region,
    availabilityZone: instance.Placement?.AvailabilityZone ?? null,
    publicIp: instance.PublicIpAddress ?? null,
    privateIp: instance.PrivateIpAddress ?? null,
    launchTime: instance.LaunchTime?.toISOString() ?? null,
  };
}

function flattenReservations(reservations: Reservation[] | undefined): Instance[] {
  if (!reservations) return [];
  return reservations.flatMap((reservation) => reservation.Instances ?? []);
}

export async function listEc2Instances(userId?: string): Promise<Ec2InstanceSummary[]> {
  const regions = getTargetRegions();
  const regionResults = await Promise.all(
    regions.map(async (region) => {
      try {
        const client = await getEc2Client(region, userId);
        const summaries: Ec2InstanceSummary[] = [];
        let nextToken: string | undefined;

        do {
          const response = await client.send(
            new DescribeInstancesCommand({
              NextToken: nextToken,
              MaxResults: 50,
            }),
          );

          const instances = flattenReservations(response.Reservations);
          summaries.push(...instances.map((instance) => toSummary(instance, region)));
          nextToken = response.NextToken;
        } while (nextToken);

        return summaries;
      } catch (error) {
        console.warn(`Failed to list EC2 instances in region ${region}:`, error);
        return [];
      }
    }),
  );

  return regionResults.flat();
}

async function getEc2InstanceInRegion(instanceId: string, region: string, userId?: string): Promise<Ec2InstanceSummary | null> {
  const client = await getEc2Client(region, userId);
  const response = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
  const instances = flattenReservations(response.Reservations);
  if (instances.length === 0) {
    return null;
  }
  return toSummary(instances[0], region);
}

export async function getEc2Instance(instanceId: string, userId?: string): Promise<Ec2InstanceSummary | null> {
  const regions = getTargetRegions();
  for (const region of regions) {
    try {
      const summary = await getEc2InstanceInRegion(instanceId, region, userId);
      if (summary) {
        return summary;
      }
    } catch (error) {
      console.warn(`Failed to describe EC2 instance ${instanceId} in region ${region}:`, error);
    }
  }
  return null;
}

async function ensureInstanceRegion(instanceId: string, hintRegion?: string, userId?: string): Promise<string | null> {
  if (hintRegion) {
    try {
      const summary = await getEc2InstanceInRegion(instanceId, hintRegion, userId);
      if (summary) {
        return hintRegion;
      }
    } catch (error) {
      console.warn(`Failed to confirm EC2 instance ${instanceId} in hinted region ${hintRegion}:`, error);
    }
  }

  const regions = getTargetRegions();
  for (const region of regions) {
    if (hintRegion && region === hintRegion) {
      continue;
    }
    try {
      const summary = await getEc2InstanceInRegion(instanceId, region, userId);
      if (summary) {
        return region;
      }
    } catch {
      // swallow, we try next region
    }
  }
  return null;
}

export async function startEc2Instance(instanceId: string, regionHint?: string, userId?: string): Promise<Ec2InstanceSummary | null> {
  const region = await ensureInstanceRegion(instanceId, regionHint, userId);
  if (!region) {
    return null;
  }
  const client = await getEc2Client(region, userId);
  await client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }));
  return getEc2InstanceInRegion(instanceId, region, userId);
}

export async function stopEc2Instance(instanceId: string, regionHint?: string, userId?: string): Promise<Ec2InstanceSummary | null> {
  const region = await ensureInstanceRegion(instanceId, regionHint, userId);
  if (!region) {
    return null;
  }
  const client = await getEc2Client(region, userId);
  await client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }));
  return getEc2InstanceInRegion(instanceId, region, userId);
}
