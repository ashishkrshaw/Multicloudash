import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, type TooltipProps } from "recharts";

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

// Custom tooltip component for better formatting
const CustomTooltip = ({ active, payload, currency }: TooltipProps<number, string> & { currency: string }) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0];
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });

  // Calculate percentage from the payload
  const percentage = data.payload?.percent ? (data.payload.percent * 100).toFixed(1) : "0.0";
  const value = typeof data.value === "number" ? data.value : 0;

  return (
    <div className="rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
      <p className="text-sm font-semibold text-foreground mb-1">{data.name}</p>
      <p className="text-base font-bold text-primary">{currencyFormatter.format(value)}</p>
      <p className="text-xs text-muted-foreground mt-1">{percentage}% of total</p>
    </div>
  );
};

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

  // Calculate total for percentage display
  const total = useMemo(
    () => chartData.reduce((sum, item) => sum + (item.value || 0), 0),
    [chartData]
  );

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Cost Distribution</CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {hasData ? (
          <>
            <ResponsiveContainer width="100%" height={280} className="sm:h-[300px]">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent, cx, cy, midAngle, innerRadius, outerRadius }) => {
                    // Hide labels on very small screens or small percentages
                    if (percent < 0.05) return null;
                    
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="white"
                        textAnchor={x > cx ? "start" : "end"}
                        dominantBaseline="central"
                        className="text-xs font-semibold"
                        style={{ pointerEvents: "none" }}
                      >
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    );
                  }}
                  outerRadius="70%"
                  innerRadius="0%"
                  fill="#8884d8"
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={800}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      className="hover:opacity-80 transition-opacity cursor-pointer"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Legend 
                  wrapperStyle={{ 
                    fontSize: "12px",
                    paddingTop: "16px"
                  }}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => {
                    // Truncate long names on mobile
                    if (typeof value === "string" && value.length > 30) {
                      return `${value.substring(0, 27)}...`;
                    }
                    return value;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2 max-h-[200px] overflow-y-auto">
              {chartData.map((item) => {
                const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";
                return (
                  <div 
                    key={item.name} 
                    className="flex items-center justify-between gap-2 text-xs sm:text-sm py-1 px-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div 
                        className="w-2 h-2 rounded-full shrink-0" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold tabular-nums">{currencyFormatter.format(item.value)}</span>
                      <span className="text-muted-foreground text-xs">({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex h-[280px] sm:h-[300px] items-center justify-center text-sm text-muted-foreground">
            {isLoading ? "Loading cost distribution..." : "No usage breakdown available."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
