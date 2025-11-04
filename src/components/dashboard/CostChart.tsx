import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export interface CostChartPoint {
  date: string;
  aws?: number;
  azure?: number;
  gcp?: number;
}

export interface CostChartProps {
  data?: CostChartPoint[];
  isLoading?: boolean;
}

const formatLabel = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function CostChart({ data, isLoading = false }: CostChartProps) {
  const chartData = useMemo(() => {
    const trimmed = (data ?? []).slice(-12);
    return trimmed.map((point) => ({
      label: formatLabel(point.date),
      AWS: Number((point.aws ?? 0).toFixed(2)),
      Azure: Number((point.azure ?? 0).toFixed(2)),
      GCP: Number((point.gcp ?? 0).toFixed(2)),
    }));
  }, [data]);

  const hasData = useMemo(
    () => chartData.some((point) => (point.AWS ?? 0) !== 0 || (point.Azure ?? 0) !== 0 || (point.GCP ?? 0) !== 0),
    [chartData],
  );

  const availableProviders = useMemo(() => {
    const providers = { aws: false, azure: false, gcp: false };
    chartData.forEach((point) => {
      if (point.AWS > 0) providers.aws = true;
      if (point.Azure > 0) providers.azure = true;
      if (point.GCP > 0) providers.gcp = true;
    });
    return providers;
  }, [chartData]);

  return (
    <Card className="col-span-full">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col gap-2">
          <CardTitle className="text-lg sm:text-xl">Cost Trend (Last 12 periods)</CardTitle>
          {hasData && (
            <div className="flex gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
              <span className={availableProviders.aws ? "text-aws font-medium" : "opacity-50"}>
                {availableProviders.aws ? "✓" : "✗"} AWS
              </span>
              <span className={availableProviders.azure ? "text-azure font-medium" : "opacity-50"}>
                {availableProviders.azure ? "✓" : "✗"} Azure
              </span>
              <span className={availableProviders.gcp ? "text-gcp font-medium" : "opacity-50"}>
                {availableProviders.gcp ? "✓" : "✗"} GCP
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-6">
        {hasData ? (
          <ResponsiveContainer width="100%" height={300} className="sm:h-[350px]">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" className="text-[10px] sm:text-xs" tick={{ fontSize: 10 }} />
              <YAxis className="text-[10px] sm:text-xs" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: "12px",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar dataKey="AWS" fill="hsl(var(--aws))" radius={[8, 8, 0, 0]} isAnimationActive={!isLoading} />
              <Bar dataKey="Azure" fill="hsl(var(--azure))" radius={[8, 8, 0, 0]} isAnimationActive={!isLoading} />
              <Bar dataKey="GCP" fill="hsl(var(--gcp))" radius={[8, 8, 0, 0]} isAnimationActive={!isLoading} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
            {isLoading ? "Loading cost history..." : "No cost data available."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
