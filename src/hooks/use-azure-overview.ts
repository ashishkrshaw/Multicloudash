import { useQuery, useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";

export interface AzureVirtualMachine {
  id: string;
  name: string;
  resourceGroup: string;
  location: string;
  size: string | null;
  osType: string | null;
  powerState: string;
  provisioningState: string | null;
  tags?: Record<string, string>;
  computerName: string | null;
  privateIps: string[];
  publicIps: string[];
}

export interface AzureNetworkSummary {
  virtualNetworks: Array<{
    id: string;
    name: string;
    location: string;
    addressSpace: string[];
    subnets: number;
    provisioningState?: string;
  }>;
  loadBalancers: Array<{
    id: string;
    name: string;
    location: string;
    sku?: string;
    frontendIps: number;
    backendPools: number;
  }>;
  publicIps: Array<{
    id: string;
    name: string;
    location: string;
    ipAddress?: string;
    allocationMethod?: string;
    sku?: string;
  }>;
  networkInterfaces: number;
}

export interface AzureStorageAccountSummary {
  id: string;
  name: string;
  location: string;
  kind?: string;
  sku?: string;
  accessTier?: string;
  tags?: Record<string, string>;
}

export interface AzureDatabaseSummary {
  sqlServers: Array<{
    id: string;
    name: string;
    resourceGroup: string;
    location: string;
    version?: string;
    databases: Array<{
      id: string;
      name: string;
      edition?: string;
      status?: string;
      sizeGb: number | null;
    }>;
  }>;
  mysqlServers: Array<{
    id: string;
    name: string;
    resourceGroup: string;
    location: string;
    engine: "MySQL" | "PostgreSQL";
    version?: string;
    state?: string;
  }>;
  postgresServers: Array<{
    id: string;
    name: string;
    resourceGroup: string;
    location: string;
    engine: "MySQL" | "PostgreSQL";
    version?: string;
    state?: string;
  }>;
}

export interface AzureMonitoringSummary {
  metricAlerts: number;
  activityLogAlerts: number;
  autoscaleSettings: number;
}

export interface AzureInventorySummary {
  resourceGroups: Array<{
    id: string;
    name: string;
    location: string;
    tags?: Record<string, string>;
  }>;
  resources: Array<{
    id: string;
    name: string;
    type: string;
    resourceGroup: string;
    location: string;
  }>;
  topTags: Array<{ key: string; count: number }>;
  totalResources: number;
}

export interface AzureCostWindow {
  label: string;
  range: { start: string; end: string };
  total: { amount: number; currency: string };
  byService: Array<{ service: string; amount: number }>;
  daily: Array<{ date: string; amount: number }>;
}

export interface AzureOverviewResponse {
  cost: AzureCostWindow[] | null;
  compute: { vms: AzureVirtualMachine[]; totals: Record<string, number> } | null;
  networking: AzureNetworkSummary | null;
  storage: { accounts: AzureStorageAccountSummary[] } | null;
  databases: AzureDatabaseSummary | null;
  monitoring: AzureMonitoringSummary | null;
  inventory: AzureInventorySummary | null;
  errors: Array<{ section: string; message: string }>;
}

async function fetchAzureOverview(): Promise<AzureOverviewResponse> {
  const response = await fetch("/api/azure/overview", { headers: { "Content-Type": "application/json" } });
  if (!response.ok) {
    const fallback = await response.json().catch(() => ({}));
    const message = typeof fallback.error === "string" ? fallback.error : response.statusText;
    throw new Error(message || "Failed to load Azure overview");
  }
  return (await response.json()) as AzureOverviewResponse;
}

export const useAzureOverview = (): UseQueryResult<AzureOverviewResponse> => {
  return useQuery<AzureOverviewResponse>({
    queryKey: ["azure-overview"],
    queryFn: fetchAzureOverview,
    staleTime: 1000 * 60 * 5,
  });
};

interface VmActionVariables {
  resourceGroup: string;
  vmName: string;
  action: "start" | "restart" | "poweroff" | "deallocate";
}

async function mutateVmAction({ resourceGroup, vmName, action }: VmActionVariables): Promise<AzureVirtualMachine> {
  const response = await fetch(
    `/api/azure/compute/virtual-machines/${encodeURIComponent(resourceGroup)}/${encodeURIComponent(vmName)}/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
  );

  if (!response.ok) {
    const fallback = await response.json().catch(() => ({}));
    const message = typeof fallback.error === "string" ? fallback.error : response.statusText;
    throw new Error(message || "Failed to update virtual machine state");
  }

  const body = (await response.json()) as { vm: AzureVirtualMachine };
  return body.vm;
}

export const useAzureVmAction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateVmAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["azure-overview"] });
      queryClient.invalidateQueries({ queryKey: ["azure-virtual-machines"] });
    },
  });
};

async function fetchAzureVirtualMachines(): Promise<{ vms: AzureVirtualMachine[] }> {
  const response = await fetch("/api/azure/compute/virtual-machines", { headers: { "Content-Type": "application/json" } });
  if (!response.ok) {
    const fallback = await response.json().catch(() => ({}));
    const message = typeof fallback.error === "string" ? fallback.error : response.statusText;
    throw new Error(message || "Failed to load virtual machines");
  }
  return (await response.json()) as { vms: AzureVirtualMachine[] };
}

export const useAzureVirtualMachines = () => {
  return useQuery({
    queryKey: ["azure-virtual-machines"],
    queryFn: fetchAzureVirtualMachines,
    staleTime: 1000 * 60 * 2,
  });
};
