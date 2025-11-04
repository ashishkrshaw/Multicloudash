import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostAndUsageCommandInput,
  ResultByTime,
} from "@aws-sdk/client-cost-explorer";
import { getCostExplorerClient } from "../aws/client.js";

type Granularity = "DAILY" | "MONTHLY";

export interface CostSummaryInput {
  start?: string;
  end?: string;
  granularity: Granularity;
}

export interface CostSummaryTimeEntry {
  start: string;
  end: string;
  amount: number;
}

export interface CostSummaryServiceEntry {
  service: string;
  amount: number;
}

export interface CostSummaryResult {
  range: { start: string; end: string };
  granularity: Granularity;
  total: { amount: number; currency: string };
  timeSeries: CostSummaryTimeEntry[];
  topServices: CostSummaryServiceEntry[];
}

const COST_METRIC = "UnblendedCost";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

const parseIsoDate = (value: string): Date => {
  if (!ISO_DATE_REGEX.test(value)) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return parsed;
};

const addDays = (date: Date, days: number): Date => {
  const cloned = new Date(date);
  cloned.setUTCDate(cloned.getUTCDate() + days);
  return cloned;
};

const defaultStartForGranularity = (end: Date, granularity: Granularity): Date => {
  if (granularity === "DAILY") {
    return addDays(end, -30);
  }
  const sixMonthsAgo = addDays(end, -180);
  sixMonthsAgo.setUTCDate(1);
  return sixMonthsAgo;
};

export async function getCostSummary({
  start,
  end,
  granularity,
}: CostSummaryInput, userId?: string): Promise<CostSummaryResult> {
  const client: CostExplorerClient = await getCostExplorerClient(userId);

  const now = new Date();
  const endInclusive = end ? parseIsoDate(end) : now;
  const startDate = start ? parseIsoDate(start) : defaultStartForGranularity(endInclusive, granularity);
  const endExclusive = addDays(endInclusive, 1);

  const params: GetCostAndUsageCommandInput = {
    TimePeriod: {
      Start: toIsoDate(startDate),
      End: toIsoDate(endExclusive),
    },
    Granularity: granularity,
    Metrics: [COST_METRIC],
    GroupBy: [
      {
        Type: "DIMENSION",
        Key: "SERVICE",
      },
    ],
  };

  const response = await client.send(new GetCostAndUsageCommand(params));
  const results = response.ResultsByTime ?? [];

  const currency =
    results[0]?.Total?.[COST_METRIC]?.Unit || response.DimensionValueAttributes?.[0]?.Attributes?.unit || "USD";

  const timeSeries: CostSummaryTimeEntry[] = results.map((entry: ResultByTime) => ({
    start: entry.TimePeriod?.Start ?? "",
    end: entry.TimePeriod?.End ?? "",
    amount: parseFloat(entry.Total?.[COST_METRIC]?.Amount ?? "0"),
  }));

  const total = timeSeries.reduce((sum, item) => sum + item.amount, 0);

  const serviceTotals = new Map<string, number>();

  for (const entry of results) {
    const groups = entry.Groups ?? [];
    for (const group of groups) {
      const service = group.Keys?.[0] ?? "Other";
      const amount = parseFloat(group.Metrics?.[COST_METRIC]?.Amount ?? "0");
      serviceTotals.set(service, (serviceTotals.get(service) ?? 0) + amount);
    }
  }

  const topServices: CostSummaryServiceEntry[] = Array.from(serviceTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([service, amount]) => ({ service, amount }));

  return {
    range: {
      start: toIsoDate(startDate),
      end: toIsoDate(endInclusive),
    },
    granularity,
    total: {
      amount: Number(total.toFixed(2)),
      currency,
    },
    timeSeries: timeSeries.map((item) => ({
      ...item,
      amount: Number(item.amount.toFixed(2)),
    })),
    topServices: topServices.map((item) => ({
      ...item,
      amount: Number(item.amount.toFixed(2)),
    })),
  };
}
