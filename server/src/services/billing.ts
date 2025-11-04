import { GetCostAndUsageCommand, GetCostForecastCommand } from "@aws-sdk/client-cost-explorer";
import { getCostExplorerClient } from "../aws/client.js";

type CurrencyAmount = {
  amount: number;
  currency: string;
};

export interface BillingOverview {
  monthToDate: CurrencyAmount;
  forecast: CurrencyAmount & { confidence?: { p10?: number; p50?: number; p90?: number } };
  freeTier: {
    totalCredit: number;
    currency: string;
    services: Array<{ service: string; amount: number }>;
    note?: string;
  };
}

const COST_METRIC = "UnblendedCost";
const COST_FORECAST_METRIC = "UNBLENDED_COST";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function addDays(date: Date, days: number): Date {
  const clone = new Date(date);
  clone.setUTCDate(clone.getUTCDate() + days);
  return clone;
}

export async function getBillingOverview(userId?: string): Promise<BillingOverview> {
  const client = await getCostExplorerClient(userId);
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEndExclusive = addDays(now, 1);

  try {
    const monthToDateResponse = await client.send(
      new GetCostAndUsageCommand({
        TimePeriod: {
          Start: toIsoDate(monthStart),
          End: toIsoDate(monthEndExclusive),
        },
        Granularity: "DAILY",
        Metrics: [COST_METRIC],
      }),
    );

    const monthToDateCurrency =
      monthToDateResponse.ResultsByTime?.[0]?.Total?.[COST_METRIC]?.Unit ?? "USD";
    const monthToDateAmount = (monthToDateResponse.ResultsByTime ?? []).reduce((total, entry) => {
      const value = Number.parseFloat(entry.Total?.[COST_METRIC]?.Amount ?? "0");
      return total + (Number.isFinite(value) ? value : 0);
    }, 0);

    const nextMonthStart = startOfNextMonth(now);

    const forecastResponse = await client.send(
      new GetCostForecastCommand({
        Granularity: "DAILY",
        Metric: COST_FORECAST_METRIC,
        TimePeriod: {
          Start: toIsoDate(now),
          End: toIsoDate(nextMonthStart),
        },
      }),
    );

    const forecastCurrency = forecastResponse.Total?.Unit ?? monthToDateCurrency;
    const forecastResults = forecastResponse.ForecastResultsByTime ?? [];
    const forecastAmount = forecastResults.reduce((sum, entry) => {
      const value = Number.parseFloat(entry.MeanValue ?? "0");
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const p10 = forecastResults.reduce((sum, entry) => {
      const value = Number.parseFloat(entry.PredictionIntervalLowerBound ?? "0");
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const p90 = forecastResults.reduce((sum, entry) => {
      const value = Number.parseFloat(entry.PredictionIntervalUpperBound ?? "0");
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const freeTierResponse = await client.send(
      new GetCostAndUsageCommand({
        TimePeriod: {
          Start: toIsoDate(monthStart),
          End: toIsoDate(monthEndExclusive),
        },
        Granularity: "MONTHLY",
        Metrics: [COST_METRIC],
        Filter: {
          Dimensions: {
            Key: "USAGE_TYPE_GROUP",
            Values: ["AWS Free Tier"],
          },
        },
        GroupBy: [
          {
            Type: "DIMENSION",
            Key: "SERVICE",
          },
        ],
      }),
    );

    const freeTierCurrency =
      freeTierResponse.ResultsByTime?.[0]?.Total?.[COST_METRIC]?.Unit ?? monthToDateCurrency;
    const freeTierGroups = freeTierResponse.ResultsByTime?.[0]?.Groups ?? [];

    const freeTierServices = freeTierGroups
      .map((group) => {
        const amount = Number.parseFloat(group.Metrics?.[COST_METRIC]?.Amount ?? "0");
        return {
          service: group.Keys?.[0] ?? "Other",
          amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0,
        };
      })
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const freeTierTotal = freeTierServices.reduce((sum, entry) => sum + entry.amount, 0);

    return {
      monthToDate: {
        amount: Number(monthToDateAmount.toFixed(2)),
        currency: monthToDateCurrency,
      },
      forecast: {
        amount: Number(forecastAmount.toFixed(2)),
        currency: forecastCurrency,
        confidence: {
          p10: Number(p10.toFixed(2)),
          p50: Number(forecastAmount.toFixed(2)),
          p90: Number(p90.toFixed(2)),
        },
      },
      freeTier: {
        totalCredit: Number(freeTierTotal.toFixed(2)),
        currency: freeTierCurrency,
        services: freeTierServices,
        note: freeTierServices.length === 0 ? "No AWS Free Tier usage detected for the current month." : undefined,
      },
    };
  } catch (error) {
    if ((error as { name?: string })?.name === "DataUnavailableException") {
      const fallbackCurrency = "USD";
      return {
        monthToDate: {
          amount: 0,
          currency: fallbackCurrency,
        },
        forecast: {
          amount: 0,
          currency: fallbackCurrency,
          confidence: {
            p10: 0,
            p50: 0,
            p90: 0,
          },
        },
        freeTier: {
          totalCredit: 0,
          currency: fallbackCurrency,
          services: [],
          note: "AWS Cost Explorer does not have enough historical data yet.",
        },
      };
    }

    throw error;
  }
}
