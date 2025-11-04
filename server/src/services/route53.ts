import { ListHostedZonesCommand, Route53Client } from "@aws-sdk/client-route-53";
import { getAwsClientConfig } from "../aws/config.js";

let route53ClientPromise: Promise<Route53Client> | null = null;

async function getRoute53Client(userId?: string): Promise<Route53Client> {
  // Don't cache user-specific clients
  if (userId) {
    return new Route53Client(await getAwsClientConfig(undefined, userId));
  }
  
  if (route53ClientPromise) {
    return route53ClientPromise;
  }
  route53ClientPromise = (async () => new Route53Client(await getAwsClientConfig()))();
  return route53ClientPromise;
}

export interface Route53HostedZoneSummary {
  id: string;
  name: string;
  recordSetCount: number;
  privateZone: boolean;
}

function normaliseHostedZoneId(id?: string): string {
  if (!id) return "unknown";
  return id.replace(/^\/(hosted)?zone\//, "");
}

export async function listRoute53HostedZones(userId?: string): Promise<Route53HostedZoneSummary[]> {
  const client = await getRoute53Client(userId);
  const response = await client.send(new ListHostedZonesCommand({}));
  const zones = response.HostedZones ?? [];

  return zones.map((zone) => ({
    id: normaliseHostedZoneId(zone.Id),
    name: zone.Name?.replace(/\.$/, "") ?? "unknown",
    recordSetCount: zone.ResourceRecordSetCount ?? 0,
    privateZone: zone.Config?.PrivateZone ?? false,
  }));
}
