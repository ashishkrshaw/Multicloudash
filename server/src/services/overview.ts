import { getCostSummary } from "./costExplorer.js";
import { listEc2Instances } from "./ec2.js";
import { listS3Buckets } from "./s3.js";
import { getAzureOverview } from "./azure/overview.js";
import { getGcpOverview } from "./gcp/overview.js";
import type { CostSummaryResult, CostSummaryTimeEntry } from "./costExplorer.js";
import type { AzureOverviewResult } from "./azure/overview.js";
import type { GcpOverviewResponse } from "./gcp/types.js";
import type { Ec2InstanceSummary } from "./ec2.js";

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

export interface UnifiedInsight {
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

export interface UnifiedOverview {
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
  insights: UnifiedInsight[];
  notes: Array<{ provider: "aws" | "azure" | "gcp"; message: string }>;
}

const toIsoDay = (date: Date): string => date.toISOString().slice(0, 10);

const sumRange = (series: CostSummaryTimeEntry[], days: number): number => {
  if (series.length === 0) return 0;
  const slice = series.slice(-days);
  return slice.reduce((total, entry) => total + entry.amount, 0);
};

const computeAwsChange = (series: CostSummaryTimeEntry[]): number | null => {
  if (series.length < 14) return null;
  const recent = sumRange(series, Math.min(30, series.length));
  const priorSeries = series.slice(0, Math.max(series.length - 30, 0));
  if (priorSeries.length === 0) return null;
  const prior = sumRange(priorSeries, Math.min(30, priorSeries.length));
  if (prior === 0) return null;
  return Number(((recent - prior) / prior).toFixed(4));
};

const mapAwsCostTimeline = (summary: CostSummaryResult | null): UnifiedCostTimelinePoint[] => {
  if (!summary) return [];
  return summary.timeSeries.map((entry) => ({
    date: entry.start,
    aws: entry.amount,
  }));
};

const mapAzureCostTimeline = (overview: AzureOverviewResult | null): UnifiedCostTimelinePoint[] => {
  const targetWindow = overview?.cost?.find((window) => window.label.toLowerCase().includes("month")) ?? overview?.cost?.[0];
  if (!targetWindow?.daily) return [];
  return targetWindow.daily.map((point) => ({
    date: point.date,
    azure: point.amount,
  }));
};

const mapGcpCostTimeline = (overview: GcpOverviewResponse | null): UnifiedCostTimelinePoint[] => {
  if (!overview?.cost?.daily) return [];
  return overview.cost.daily.map((point) => ({
    date: point.date,
    gcp: point.amount,
  }));
};

const mergeTimelines = (
  aws: UnifiedCostTimelinePoint[],
  azure: UnifiedCostTimelinePoint[],
  gcp: UnifiedCostTimelinePoint[],
): UnifiedCostTimelinePoint[] => {
  const map = new Map<string, UnifiedCostTimelinePoint>();
  const merge = (entries: UnifiedCostTimelinePoint[]) => {
    for (const entry of entries) {
      const current = map.get(entry.date) ?? { date: entry.date };
      map.set(entry.date, { ...current, ...entry });
    }
  };
  merge(aws);
  merge(azure);
  merge(gcp);
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
};

const summariseEc2 = (instances: Ec2InstanceSummary[] | null): ProviderComputeTotals | null => {
  if (!instances) return null;
  return instances.reduce(
    (acc, instance) => {
      acc.total += 1;
      switch (instance.state) {
        case "running":
          acc.running += 1;
          break;
        case "stopped":
        case "stopping":
        case "shutting-down":
          acc.stopped += 1;
          break;
        case "terminated":
          acc.terminated += 1;
          break;
        default:
          break;
      }
      return acc;
    },
    { total: 0, running: 0, stopped: 0, terminated: 0 },
  );
};

const summariseAzureCompute = (overview: AzureOverviewResult | null): ProviderComputeTotals | null => {
  if (!overview?.compute) return null;
  const totals = overview.compute.totals;
  return {
    total: totals.total ?? 0,
    running: totals.running ?? 0,
    stopped: (totals.stopped ?? 0) + (totals.deallocated ?? 0),
    terminated: totals.deallocated ?? 0,
  };
};

const summariseGcpCompute = (overview: GcpOverviewResponse | null): ProviderComputeTotals | null => {
  if (!overview?.compute) return null;
  return overview.compute.totals;
};

const toProviderCost = (timeline: UnifiedCostTimelinePoint[], key: "aws" | "azure" | "gcp", change: number | null, isMock = false): ProviderCostTotals => {
  const total = timeline.reduce((acc, point) => acc + (point[key] ?? 0), 0);
  return {
    total: Number(total.toFixed(2)),
    currency: "USD",
    changePercentage: change,
    isMock,
  };
};

const limitNumber = (value: number | null | undefined, fractionDigits = 2) => {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value.toFixed(fractionDigits));
};

export const getUnifiedOverview = async (): Promise<UnifiedOverview> => {
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 59);
  const awsCostParams = {
    start: toIsoDay(start),
    end: toIsoDay(today),
    granularity: "DAILY" as const,
  };

  const [awsCostResult, awsInstancesResult, awsBucketsResult, azureResult, gcpResult] = await Promise.allSettled([
    getCostSummary(awsCostParams),
    listEc2Instances(),
    listS3Buckets(),
    getAzureOverview(),
    getGcpOverview(),
  ]);

  const awsCost = awsCostResult.status === "fulfilled" ? awsCostResult.value : null;
  const awsInstances = awsInstancesResult.status === "fulfilled" ? awsInstancesResult.value : null;
  const awsBuckets = awsBucketsResult.status === "fulfilled" ? awsBucketsResult.value : null;
  const azure = azureResult.status === "fulfilled" ? azureResult.value : null;
  const gcp = gcpResult.status === "fulfilled" ? gcpResult.value : null;

  const timelineAws = mapAwsCostTimeline(awsCost);
  const timelineAzure = mapAzureCostTimeline(azure);
  const timelineGcp = mapGcpCostTimeline(gcp);
  const mergedTimeline = mergeTimelines(timelineAws, timelineAzure, timelineGcp);

  const awsChange = computeAwsChange(awsCost?.timeSeries ?? []);
  const azureChange = (() => {
    if (!azure?.cost) return null;
    const current = azure.cost.find((window) => window.label.toLowerCase().includes("month"));
    const previous = azure.cost.find((window) => window.label.toLowerCase().includes("previous"));
    if (!current || !previous || previous.total.amount === 0) return null;
    return limitNumber((current.total.amount - previous.total.amount) / previous.total.amount, 4);
  })();

  const gcpChange = (() => {
    const percentage = gcp?.cost?.changePercentage;
    if (typeof percentage !== "number") return null;
    return limitNumber(percentage, 4);
  })();

  const costAws = awsCost ? toProviderCost(timelineAws, "aws", awsChange ?? null) : null;
  const azureMonthlyWindow = azure?.cost?.find((window) => window.label.toLowerCase().includes("month"));
  const costAzure = azureMonthlyWindow
    ? {
        total: Number(azureMonthlyWindow.total.amount.toFixed(2)),
        currency: azureMonthlyWindow.total.currency,
        changePercentage: azureChange,
        isMock: false,
      }
    : null;
  const costGcp = gcp?.cost
    ? {
        total: Number(gcp.cost.total.toFixed(2)),
        currency: gcp.cost.currency,
        changePercentage: gcpChange,
        isMock: gcp.cost.isMock,
      }
    : null;

  const computeAws = summariseEc2(awsInstances);
  const computeAzure = summariseAzureCompute(azure);
  const computeGcp = summariseGcpCompute(gcp);

  const combinedCompute: ProviderComputeTotals = {
    total: (computeAws?.total ?? 0) + (computeAzure?.total ?? 0) + (computeGcp?.total ?? 0),
    running: (computeAws?.running ?? 0) + (computeAzure?.running ?? 0) + (computeGcp?.running ?? 0),
    stopped: (computeAws?.stopped ?? 0) + (computeAzure?.stopped ?? 0) + (computeGcp?.stopped ?? 0),
    terminated: (computeAws?.terminated ?? 0) + (computeAzure?.terminated ?? 0) + (computeGcp?.terminated ?? 0),
  };

  const storageTotals = {
    aws: awsBuckets ? { buckets: awsBuckets.length } : null,
    azure: azure?.storage ? { accounts: azure.storage.accounts.length } : null,
    gcp: gcp?.storage ? { buckets: gcp.storage.totals.bucketCount, storageGb: gcp.storage.totals.storageGb ?? null } : null,
  } satisfies UnifiedOverview["storage"];

  const usageBreakdown: Array<{ provider: "aws" | "azure" | "gcp"; service: string; amount: number }> = [];
  if (awsCost?.topServices) {
    usageBreakdown.push(
      ...awsCost.topServices.slice(0, 5).map((service) => ({ provider: "aws" as const, service: service.service, amount: service.amount })),
    );
  }
  if (azureMonthlyWindow?.byService) {
    usageBreakdown.push(
      ...azureMonthlyWindow.byService.slice(0, 5).map((service) => ({ provider: "azure" as const, service: service.service, amount: service.amount })),
    );
  }
  if (gcp?.cost?.byService) {
    usageBreakdown.push(
      ...gcp.cost.byService.slice(0, 5).map((service) => ({ provider: "gcp" as const, service: service.service, amount: service.amount })),
    );
  }

  const insights: UnifiedInsight[] = [];
  if (awsChange && awsChange > 0.05) {
    insights.push({
      id: "aws-cost-trend",
      provider: "aws",
      title: "AWS spend trending upward",
      detail: `AWS cost increased ${(awsChange * 100).toFixed(1)}% over the previous period. Review EC2 and S3 usage for optimisation opportunities.
`,
      severity: "warning",
    });
  }
  if (computeAws && computeAws.stopped > 0) {
    insights.push({
      id: "aws-stopped-instances",
      provider: "aws",
      title: "Stopped EC2 instances detected",
      detail: `${computeAws.stopped} EC2 instances are stopped or stopping. Schedule terminations or re-use to avoid idle costs.`,
      severity: "info",
    });
  }
  if (computeAzure && computeAzure.stopped > 0) {
    insights.push({
      id: "azure-idle-vms",
      provider: "azure",
      title: "Azure VMs available to deallocate",
      detail: `${computeAzure.stopped} Azure virtual machines are not running. Consider deallocating to release compute capacity and cut spend.`,
      severity: "info",
    });
  }
  if (gcp?.alerts?.length) {
    for (const [index, alert] of gcp.alerts.entries()) {
      insights.push({
        id: `gcp-alert-${index}`,
        provider: "gcp",
        title: `GCP ${alert.type} alert`,
        detail: alert.message,
        severity: alert.severity,
      });
    }
  }

  const notes: UnifiedOverview["notes"] = [];
  
  // Add notes for failed provider fetches
  if (awsCostResult.status === "rejected") {
    notes.push({ 
      provider: "aws", 
      message: `Cost data unavailable: ${awsCostResult.reason?.message ?? "Unknown error"}` 
    });
  }
  if (azureResult.status === "rejected") {
    notes.push({ 
      provider: "azure", 
      message: `Overview unavailable: ${azureResult.reason?.message ?? "Unknown error"}` 
    });
  }
  if (gcpResult.status === "rejected") {
    notes.push({ 
      provider: "gcp", 
      message: `Overview unavailable: ${gcpResult.reason?.message ?? "Unknown error"}` 
    });
  }
  
  // Add specific error messages from successful fetches that have internal errors
  if (azure?.errors?.length) {
    for (const error of azure.errors.slice(0, 3)) {
      notes.push({ provider: "azure", message: `${error.section}: ${error.message}` });
    }
  }
  if (gcp?.errors?.length) {
    for (const error of gcp.errors.slice(0, 3)) {
      notes.push({ provider: "gcp", message: `${error.section}: ${error.message}` });
    }
  }

  const combinedTotal = Number(
    (
      (costAws?.total ?? 0) +
      (costAzure?.total ?? 0) +
      (costGcp?.total ?? 0)
    ).toFixed(2),
  );

  return {
    fetchedAt: new Date().toISOString(),
    costTimeline: mergedTimeline.slice(-30),
    costTotals: {
      aws: costAws,
      azure: costAzure,
      gcp: costGcp,
      combined: {
        total: combinedTotal,
        currency: "USD",
        changePercentage: null,
      },
    },
    computeTotals: {
      aws: computeAws,
      azure: computeAzure,
      gcp: computeGcp,
      combined: combinedCompute,
    },
    storage: storageTotals,
    usageBreakdown: usageBreakdown.sort((a, b) => b.amount - a.amount).slice(0, 12),
    insights: insights.slice(0, 6),
    notes,
  };
};
