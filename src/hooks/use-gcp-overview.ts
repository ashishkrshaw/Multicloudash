import { useQuery, type UseQueryResult } from "@tanstack/react-query";

export interface GcpComputeInstance {
  id: string;
  name: string;
  zone: string;
  region: string;
  machineType: string | null;
  resourceId?: string;
  status: "running" | "stopped" | "terminated" | "suspended" | "provisioning" | "unknown";
  internalIp?: string;
  externalIp?: string;
  labels?: Record<string, string>;
  lastStartTimestamp?: string;
  cpuUtilization?: number | null;
  monthlyCostEstimate?: number | null;
}

export interface GcpComputeSummary {
  instances: GcpComputeInstance[];
  totals: {
    total: number;
    running: number;
    stopped: number;
    terminated: number;
  };
}

export interface GcpStorageBucket {
  id: string;
  name: string;
  location: string;
  storageClass?: string;
  createdAt?: string;
  sizeGb?: number | null;
  versioning?: boolean;
  labels?: Record<string, string>;
}

export interface GcpStorageSummary {
  buckets: GcpStorageBucket[];
  totals: { bucketCount: number; storageGb: number | null };
}

export interface GcpSqlInstance {
  id: string;
  name: string;
  region: string;
  databaseVersion?: string;
  instanceType?: string;
  state?: string;
  storageSizeGb?: number | null;
  failoverReplica?: string | null;
}

export interface GcpSqlSummary {
  instances: GcpSqlInstance[];
  totals: { total: number; running: number };
}

export interface GcpCostBreakdown {
  isMock: boolean;
  currency: string;
  total: number;
  changePercentage?: number | null;
  byService: Array<{ service: string; amount: number }>;
  daily: Array<{ date: string; amount: number }>;
}

export interface GcpServiceUsageSnapshot {
  service: string;
  status: "enabled" | "disabled" | "unknown";
}

export interface GcpAlertInsight {
  type: "cost" | "compute" | "storage" | "sql" | "general";
  message: string;
  severity: "info" | "warning" | "critical";
}

export interface GcpOverviewResponse {
  isMock: boolean;
  projectId: string | null;
  fetchedAt: string;
  compute: GcpComputeSummary;
  storage: GcpStorageSummary;
  sql: GcpSqlSummary;
  cost: GcpCostBreakdown;
  services: GcpServiceUsageSnapshot[];
  alerts: GcpAlertInsight[];
  errors: Array<{ section: string; message: string }>;
}

async function fetchGcpOverview(): Promise<GcpOverviewResponse> {
  const response = await fetch("/api/gcp/overview", {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const fallback = await response.json().catch(() => ({}));
    const message = typeof fallback.error === "string" ? fallback.error : response.statusText;
    throw new Error(message || "Failed to load GCP overview");
  }

  return (await response.json()) as GcpOverviewResponse;
}

export const useGcpOverview = (): UseQueryResult<GcpOverviewResponse> => {
  return useQuery<GcpOverviewResponse>({
    queryKey: ["gcp-overview"],
    queryFn: fetchGcpOverview,
    staleTime: 1000 * 60 * 5,
  });
};
