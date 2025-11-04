import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useCredentials } from "@/context/CredentialsContext";
import { generateMockAwsCost, generateMockAzureOverview, generateMockGcpOverview } from "@/lib/mock-data";

export interface UnifiedOverviewInsight {
  id: string;
  provider: "aws" | "azure" | "gcp" | "multi";
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
}

export interface UnifiedCostTimelinePoint {
  date: string;
  aws?: number;
  azure?: number;
  gcp?: number;
}

export interface ProviderCostTotals {
  total: number;
  currency: string;
  changePercentage: number | null;
  isMock?: boolean;
}

export interface ProviderComputeTotals {
  total: number;
  running: number;
  stopped: number;
  terminated: number;
}

export interface ProviderStorageTotals {
  buckets?: number;
  accounts?: number;
  storageGb?: number | null;
}

export interface UnifiedOverviewResponse {
  fetchedAt: string;
  costTimeline: UnifiedCostTimelinePoint[];
  costTotals: {
    aws: ProviderCostTotals | null;
    azure: ProviderCostTotals | null;
    gcp: ProviderCostTotals | null;
    combined: ProviderCostTotals;
  };
  computeTotals: {
    aws: ProviderComputeTotals | null;
    azure: ProviderComputeTotals | null;
    gcp: ProviderComputeTotals | null;
    combined: ProviderComputeTotals;
  };
  storage: {
    aws: ProviderStorageTotals | null;
    azure: ProviderStorageTotals | null;
    gcp: ProviderStorageTotals | null;
  };
  usageBreakdown: Array<{ provider: "aws" | "azure" | "gcp"; service: string; amount: number }>;
  insights: UnifiedOverviewInsight[];
  notes: Array<{ provider: "aws" | "azure" | "gcp"; message: string }>;
}

async function fetchUnifiedOverview(): Promise<UnifiedOverviewResponse> {
  const response = await fetch("/api/overview", {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const fallback = await response.json().catch(() => ({}));
    const message = typeof fallback.error === "string" ? fallback.error : response.statusText;
    throw new Error(message || "Failed to load multi-cloud overview");
  }

  return (await response.json()) as UnifiedOverviewResponse;
}

export const useUnifiedOverview = (): UseQueryResult<UnifiedOverviewResponse> => {
  const { hasAwsCredentials, hasAzureCredentials, hasGcpCredentials } = useCredentials();
  const shouldFetchReal = hasAwsCredentials || hasAzureCredentials || hasGcpCredentials;

  return useQuery<UnifiedOverviewResponse>({
    queryKey: ["multi-cloud-overview", hasAwsCredentials, hasAzureCredentials, hasGcpCredentials],
    queryFn: async () => {
      // If no credentials at all, return fully mocked data
      if (!shouldFetchReal) {
        const mockAws = generateMockAwsCost();
        const mockAzure = generateMockAzureOverview();
        const mockGcp = generateMockGcpOverview();

        return {
          fetchedAt: new Date().toISOString(),
          costTimeline: mockAws.timeSeries.map(item => ({
            date: item.start,
            aws: item.amount,
            azure: 95,
            gcp: 60,
          })),
          costTotals: {
            aws: { total: mockAws.total.amount, currency: 'USD', changePercentage: 0.08, isMock: true },
            azure: { total: mockAzure.cost[0].total.amount, currency: 'USD', changePercentage: 0.05, isMock: true },
            gcp: { total: mockGcp.cost.total, currency: 'USD', changePercentage: 0.05, isMock: true },
            combined: { 
              total: mockAws.total.amount + mockAzure.cost[0].total.amount + mockGcp.cost.total, 
              currency: 'USD', 
              changePercentage: 0.06,
            },
          },
          computeTotals: {
            aws: { total: 4, running: 3, stopped: 1, terminated: 0 },
            azure: { total: mockAzure.compute.totals.total, running: mockAzure.compute.totals.running, stopped: mockAzure.compute.totals.stopped, terminated: 0 },
            gcp: mockGcp.compute.totals,
            combined: { total: 10, running: 7, stopped: 1, terminated: 2 },
          },
          storage: {
            aws: { buckets: 3 },
            azure: { accounts: mockAzure.storage.accounts.length },
            gcp: { buckets: mockGcp.storage.totals.bucketCount, storageGb: mockGcp.storage.totals.storageGb },
          },
          usageBreakdown: [
            ...mockAws.topServices.map(s => ({ provider: 'aws' as const, service: s.service, amount: s.amount })),
            ...mockAzure.cost[0].byService.slice(0, 3).map(s => ({ provider: 'azure' as const, service: s.service, amount: s.amount })),
            ...mockGcp.cost.byService.slice(0, 3).map(s => ({ provider: 'gcp' as const, service: s.service, amount: s.amount })),
          ],
          insights: [
            {
              id: 'mock-1',
              provider: 'multi',
              title: 'Mock data displayed',
              detail: 'Add your cloud credentials to see real data',
              severity: 'info',
            },
          ],
          notes: [
            { provider: 'aws', message: 'No AWS credentials configured - showing mock data' },
            { provider: 'azure', message: 'No Azure credentials configured - showing mock data' },
            { provider: 'gcp', message: 'No GCP credentials configured - showing mock data' },
          ],
        };
      }

      // Otherwise fetch real data (backend will handle partial mocks)
      return fetchUnifiedOverview();
    },
    staleTime: 1000 * 60 * 5,
  });
};
