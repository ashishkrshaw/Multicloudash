import { getUnifiedOverview } from "../overview.js";
import type { UnifiedOverview } from "../overview.js";
import { getCostSummary } from "../costExplorer.js";
import type { CostSummaryResult } from "../costExplorer.js";
import { listEc2Instances, type Ec2InstanceSummary } from "../ec2.js";
import { listS3Buckets, type S3BucketSummary } from "../s3.js";
import { getAzureOverview } from "../azure/overview.js";
import type { AzureOverviewResult } from "../azure/overview.js";
import { getGcpOverview } from "../gcp/overview.js";
import type { GcpOverviewResponse } from "../gcp/types.js";

const toIsoDay = (date: Date): string => date.toISOString().slice(0, 10);

const createAwsCostParams = () => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 59);
  return {
    start: toIsoDay(start),
    end: toIsoDay(end),
    granularity: "DAILY" as const,
  };
};

export interface AssistantSnapshot {
  generatedAt: string;
  overview: Pick<UnifiedOverview, "costTotals" | "computeTotals" | "usageBreakdown" | "insights" | "notes" | "costTimeline"> | null;
  aws: {
    costSummary: CostSummaryResult | null;
    ec2: Ec2InstanceSummary[] | null;
    s3: S3BucketSummary[] | null;
  };
  azure: AzureOverviewResult | null;
  gcp: GcpOverviewResponse | null;
  errors: string[];
}

export const buildAssistantSnapshot = async (): Promise<AssistantSnapshot> => {
  const errors: string[] = [];

  let unified: UnifiedOverview | null = null;
  try {
    unified = await getUnifiedOverview();
  } catch (error) {
    errors.push(
      `Unified overview unavailable: ${error instanceof Error ? error.message : "Unknown error retrieving multi-cloud overview"}`,
    );
  }

  const [awsCostResult, ec2Result, s3Result, azureResult, gcpResult] = await Promise.allSettled([
    getCostSummary(createAwsCostParams()),
    listEc2Instances(),
    listS3Buckets(),
    getAzureOverview(),
    (async () => {
      try {
        return await getGcpOverview();
      } catch (error) {
        errors.push(`GCP overview failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        return null;
      }
    })(),
  ]);

  const awsCostSummary = awsCostResult.status === "fulfilled" ? awsCostResult.value : null;
  if (awsCostResult.status === "rejected") {
    errors.push(`AWS cost summary failed: ${awsCostResult.reason instanceof Error ? awsCostResult.reason.message : String(awsCostResult.reason)}`);
  }

  const ec2Instances = ec2Result.status === "fulfilled" ? ec2Result.value : null;
  if (ec2Result.status === "rejected") {
    errors.push(`AWS EC2 inventory failed: ${ec2Result.reason instanceof Error ? ec2Result.reason.message : String(ec2Result.reason)}`);
  }

  const s3Buckets = s3Result.status === "fulfilled" ? s3Result.value : null;
  if (s3Result.status === "rejected") {
    errors.push(`AWS S3 inventory failed: ${s3Result.reason instanceof Error ? s3Result.reason.message : String(s3Result.reason)}`);
  }

  const azureOverview = azureResult.status === "fulfilled" ? azureResult.value : null;
  if (azureResult.status === "rejected") {
    errors.push(`Azure overview failed: ${azureResult.reason instanceof Error ? azureResult.reason.message : String(azureResult.reason)}`);
  }

  const gcpOverview = gcpResult.status === "fulfilled" ? gcpResult.value : null;

  return {
    generatedAt: new Date().toISOString(),
    overview: unified
      ? {
          costTotals: unified.costTotals,
          computeTotals: unified.computeTotals,
          usageBreakdown: unified.usageBreakdown,
          insights: unified.insights,
          notes: unified.notes,
          costTimeline: unified.costTimeline.slice(-60),
        }
      : null,
    aws: {
      costSummary: awsCostSummary,
      ec2: ec2Instances,
      s3: s3Buckets,
    },
    azure: azureOverview,
    gcp: gcpOverview,
    errors,
  };
};
