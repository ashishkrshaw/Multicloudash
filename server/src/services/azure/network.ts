import { getNetworkClient } from "../../azure/config.js";
import { extractNameFromId, formatAzureRegion } from "../../azure/utils.js";

export interface AzureVirtualNetworkSummary {
  id: string;
  name: string;
  location: string;
  addressSpace: string[];
  subnets: number;
  provisioningState: string | undefined;
}

export interface AzureLoadBalancerSummary {
  id: string;
  name: string;
  location: string;
  sku: string | undefined;
  frontendIps: number;
  backendPools: number;
}

export interface AzurePublicIpSummary {
  id: string;
  name: string;
  location: string;
  ipAddress: string | undefined;
  allocationMethod: string | undefined;
  sku: string | undefined;
}

export interface AzureNetworkSummary {
  virtualNetworks: AzureVirtualNetworkSummary[];
  loadBalancers: AzureLoadBalancerSummary[];
  publicIps: AzurePublicIpSummary[];
  networkInterfaces: number;
}

export const getNetworkSummary = async (userId?: string): Promise<AzureNetworkSummary> => {
  const client = await getNetworkClient(userId);

  const [vnets, lbs, publicIps, nics] = await Promise.all([
    (async () => {
      const items: AzureVirtualNetworkSummary[] = [];
      for await (const vnet of client.virtualNetworks.listAll()) {
        items.push({
          id: vnet.id ?? "",
          name: vnet.name ?? extractNameFromId(vnet.id ?? "") ?? "unknown",
          location: formatAzureRegion(vnet.location),
          addressSpace: vnet.addressSpace?.addressPrefixes ?? [],
          subnets: vnet.subnets?.length ?? 0,
          provisioningState: vnet.provisioningState,
        });
      }
      return items;
    })(),
    (async () => {
      const items: AzureLoadBalancerSummary[] = [];
      for await (const lb of client.loadBalancers.listAll()) {
        items.push({
          id: lb.id ?? "",
          name: lb.name ?? extractNameFromId(lb.id ?? "") ?? "unknown",
          location: formatAzureRegion(lb.location),
          sku: lb.sku?.name,
          frontendIps: lb.frontendIPConfigurations?.length ?? 0,
          backendPools: lb.backendAddressPools?.length ?? 0,
        });
      }
      return items;
    })(),
    (async () => {
      const items: AzurePublicIpSummary[] = [];
      for await (const ip of client.publicIPAddresses.listAll()) {
        items.push({
          id: ip.id ?? "",
          name: ip.name ?? extractNameFromId(ip.id ?? "") ?? "unknown",
          location: formatAzureRegion(ip.location),
          ipAddress: ip.ipAddress,
          allocationMethod: ip.publicIPAllocationMethod,
          sku: ip.sku?.name,
        });
      }
      return items;
    })(),
    (async () => {
      let count = 0;
      for await (const _nic of client.networkInterfaces.listAll()) {
        count += 1;
      }
      return count;
    })(),
  ]);

  return {
    virtualNetworks: vnets,
    loadBalancers: lbs,
    publicIps,
    networkInterfaces: nics,
  };
};
