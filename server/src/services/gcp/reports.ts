import type { BaseExternalAccountClient, Compute, JWT, OAuth2Client, UserRefreshClient } from "google-auth-library";
import type { GcpCostBreakdown } from "./types.js";

const BILLING_BASE_URL = "https://cloudbilling.googleapis.com/v1beta";

const toDateStruct = (date: Date) => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
});

const parseMoney = (input?: { units?: string | number | null; nanos?: number | null }): number => {
  if (!input) {
    return 0;
  }
  const units = Number(input.units ?? 0);
  const nanos = Number(input.nanos ?? 0);
  return units + nanos / 1_000_000_000;
};

const roundCurrency = (value: number): number => (Number.isFinite(value) ? Number(value.toFixed(2)) : 0);

type GoogleAuthClient = OAuth2Client | JWT | Compute | UserRefreshClient | BaseExternalAccountClient;

type QueryDimensionValue = {
  dimension?: string | null;
  value?: string | null;
};

type QueryMoneyValue = {
  units?: string | number | null;
  nanos?: number | null;
};

type QueryMetricValue = {
  metric?: string | null;
  value?: QueryMoneyValue;
};

type QueryRow = {
  dimensionValues?: QueryDimensionValue[] | null;
  metricValues?: QueryMetricValue[] | null;
  timeInterval?: {
    startDate?: { year?: number; month?: number; day?: number } | null;
    endDate?: { year?: number; month?: number; day?: number } | null;
  } | null;
};

type QueryResponse = {
  rows?: QueryRow[] | null;
  total?: {
    metricValues?: QueryMetricValue[] | null;
  } | null;
  metadata?: {
    currencyCode?: string | null;
  } | null;
};

export interface FetchGcpCostAnalyticsInput {
  authClient: GoogleAuthClient | undefined;
  projectId: string;
  billingAccountId: string;
  lookbackDays?: number;
}

const buildFilter = (projectId: string) => `project="projects/${projectId}"`;

const normaliseDate = (input?: { year?: number; month?: number; day?: number } | null): string | null => {
  if (!input || input.year == null || input.month == null || input.day == null) {
    return null;
  }
  const month = String(input.month).padStart(2, "0");
  const day = String(input.day).padStart(2, "0");
  return `${input.year}-${month}-${day}`;
};

const extractMetric = (values: QueryMetricValue[] | null | undefined, metricName: string): number => {
  if (!values) {
    return 0;
  }
  const match = values.find((entry) => entry.metric === metricName);
  return parseMoney(match?.value);
};

export const fetchGcpCostAnalytics = async ({
  authClient,
  projectId,
  billingAccountId,
  lookbackDays = 60,
}: FetchGcpCostAnalyticsInput): Promise<GcpCostBreakdown> => {
  if (!authClient) {
    throw new Error("No Google auth client available for cost analytics.");
  }
  const authorizedClient = authClient;

  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(1, lookbackDays));

  const requestBase = {
    filter: buildFilter(projectId),
    dateRange: {
      startDate: toDateStruct(start),
      endDate: toDateStruct(end),
    },
  };

  const query = async <T extends QueryResponse>(body: Record<string, unknown>): Promise<T> => {
    const response = await authorizedClient.request<T>({
      url: `${BILLING_BASE_URL}/billingAccounts/${billingAccountId}/reports:query`,
      method: "POST",
      data: body,
    });
    return response.data;
  };

  const serviceResponse = await query<QueryResponse>({
    ...requestBase,
    groupBy: ["service"],
  });

  let dailyResponse: QueryResponse = { rows: [] };
  try {
    dailyResponse = await query<QueryResponse>({
      ...requestBase,
      groupBy: ["usage_start_time"],
    });
  } catch (error) {
    console.warn("GCP daily cost query failed", error);
  }

  const currency = serviceResponse.metadata?.currencyCode ?? "USD";

  const byService = (serviceResponse.rows ?? [])
    .map((row) => {
      const serviceName = row.dimensionValues?.find((dimension) => dimension.dimension === "service")?.value ?? "Other";
      const amount = extractMetric(row.metricValues, "cost");
      return amount > 0
        ? {
            service: serviceName,
            amount: roundCurrency(amount),
          }
        : null;
    })
    .filter((entry): entry is { service: string; amount: number } => entry !== null)
    .sort((a, b) => b.amount - a.amount);

  const totals = extractMetric(serviceResponse.total?.metricValues, "cost");

  const dailyMap = new Map<string, number>();
  for (const row of dailyResponse.rows ?? []) {
    const dateKey = normaliseDate(row.timeInterval?.startDate) ?? normaliseDate(row.timeInterval?.endDate);
    if (!dateKey) {
      continue;
    }
    const amount = extractMetric(row.metricValues, "cost");
    dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + amount);
  }

  const daily = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([date, amount]) => ({ date, amount: roundCurrency(amount) }));

  const last30 = daily.slice(-30);
  const previous30 = daily.slice(-60, -30);
  const sum = (series: typeof daily) => series.reduce((total, entry) => total + entry.amount, 0);
  const recentTotal = sum(last30);
  const priorTotal = sum(previous30);
  const changePercentage = priorTotal > 0 ? Number(((recentTotal - priorTotal) / priorTotal).toFixed(4)) : null;

  return {
    isMock: false,
    currency,
    total: roundCurrency(totals),
    changePercentage,
    byService: byService.slice(0, 12),
    daily: daily.slice(-90),
  };
};
