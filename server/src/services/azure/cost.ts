import { getCostManagementClient, getAzureScope } from "../../azure/config.js";
import { safeNumber } from "../../azure/utils.js";

export interface AzureCostPoint {
  date: string;
  amount: number;
}

export interface AzureCostByService {
  service: string;
  amount: number;
}

export interface AzureCostWindow {
  label: string;
  range: { start: string; end: string };
  total: { amount: number; currency: string };
  byService: AzureCostByService[];
  daily: AzureCostPoint[];
}

const toDateString = (date: Date) => date.toISOString().slice(0, 10);

const buildCustomRequest = (from: Date, to: Date) => ({
  type: "ActualCost" as const,
  timeframe: "Custom" as const,
  timePeriod: {
    from,
    to,
  },
  dataset: {
    granularity: "Daily" as const,
    aggregation: {
      totalCost: {
        name: "Cost",
        function: "Sum" as const,
      },
    },
    grouping: [
      {
        type: "Dimension" as const,
        name: "ServiceName",
      },
    ],
  },
});

const parseCostResult = (rows: unknown[][] | undefined, columns: Array<{ name?: string }> | undefined) => {
  if (!rows || !columns) {
    return { totals: new Map<string, number>(), daily: [] as AzureCostPoint[] };
  }

  const serviceIndex = columns.findIndex((col) => col.name === "ServiceName");
  const costIndex = columns.findIndex((col) => col.name === "Cost");
  const dateIndex = columns.findIndex((col) => col.name === "UsageDate");

  const totals = new Map<string, number>();
  const dailyMap = new Map<string, number>();

  for (const row of rows) {
    const service = serviceIndex >= 0 ? String(row[serviceIndex] ?? "Other") : "Other";
    const amount = safeNumber(costIndex >= 0 ? row[costIndex] : 0, 0);
    const usageDate = dateIndex >= 0 ? String(row[dateIndex] ?? "") : "";

    totals.set(service, (totals.get(service) ?? 0) + amount);
    if (usageDate) {
      dailyMap.set(usageDate, (dailyMap.get(usageDate) ?? 0) + amount);
    }
  }

  const daily: AzureCostPoint[] = Array.from(dailyMap.entries())
    .map(([date, amount]) => ({ date, amount: Number(amount.toFixed(2)) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { totals, daily };
};

const buildWindowResult = (
  label: string,
  from: Date,
  to: Date,
  currency: string,
  totals: Map<string, number>,
  daily: AzureCostPoint[],
): AzureCostWindow => ({
  label,
  range: { start: toDateString(from), end: toDateString(to) },
  total: {
    amount: Number(Array.from(totals.values()).reduce((sum, value) => sum + value, 0).toFixed(2)),
    currency,
  },
  byService: Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([service, amount]) => ({ service, amount: Number(amount.toFixed(2)) })),
  daily,
});

export const getAzureCostWindows = async (userId?: string): Promise<AzureCostWindow[]> => {
  const costClient = await getCostManagementClient(userId);
  const scope = await getAzureScope(userId);

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const start30 = new Date(today);
  start30.setUTCDate(start30.getUTCDate() - 29);

  const start90 = new Date(today);
  start90.setUTCDate(start90.getUTCDate() - 89);

  const startMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const endMonth = new Date(today);

  const startPrevMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const endPrevMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));

  const requests = [
    { label: "Last 30 days", from: start30, to: today },
    { label: "Last 90 days", from: start90, to: today },
    { label: "Month to date", from: startMonth, to: endMonth },
    { label: "Previous month", from: startPrevMonth, to: endPrevMonth },
  ];

  const windows: AzureCostWindow[] = [];
  for (const request of requests) {
    try {
      const query = buildCustomRequest(request.from, request.to);
      const result = await costClient.query.usage(scope, query);
      const { currency, rows, columns } = ((result as { properties?: unknown })?.properties ?? result) as {
        currency?: string;
        rows?: unknown[][];
        columns?: Array<{ name?: string }>;
      };
      const parsed = parseCostResult(rows, columns);
      windows.push(
        buildWindowResult(request.label, request.from, request.to, currency ?? "USD", parsed.totals, parsed.daily),
      );
    } catch (error) {
      console.warn(`Azure cost query failed for window ${request.label}`, error);
      windows.push(
        buildWindowResult(request.label, request.from, request.to, "USD", new Map<string, number>(), []),
      );
    }
  }

  return windows;
};
