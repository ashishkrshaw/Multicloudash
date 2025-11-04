import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

type BreakdownItem = {
  name: string;
  value: number;
  color?: string;
};

const colorPalette = [
  "hsl(var(--aws))",
  "hsl(var(--azure))",
  "hsl(var(--gcp))",
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--warning))",
];

export interface UsageBreakdownProps {
  data?: BreakdownItem[];
  isLoading?: boolean;
  currency?: string;
}

export function UsageBreakdown({ data, isLoading = false, currency = "USD" }: UsageBreakdownProps) {
  const chartData = useMemo(
    () =>
      (data ?? []).map((item, index) => ({
        ...item,
        color: item.color ?? colorPalette[index % colorPalette.length],
      })),
    [data],
  );

  const hasData = chartData.length > 0 && chartData.some((item) => Number.isFinite(item.value) && item.value > 0);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }),
    [currency],
  );

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle>Cost Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {chartData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-semibold">{currencyFormatter.format(item.value)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            {isLoading ? "Loading cost distribution..." : "No usage breakdown available."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
