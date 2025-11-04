import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: ComponentType<{ className?: string }>;
  provider?: "aws" | "azure" | "gcp" | "all";
}

export function MetricCard({ title, value, change, trend, icon: Icon, provider = "all" }: MetricCardProps) {
  const providerColors = {
    aws: "border-aws/30 bg-[hsl(var(--aws)/0.12)] text-aws",
    azure: "border-azure/30 bg-[hsl(var(--azure)/0.12)] text-azure",
    gcp: "border-gcp/30 bg-[hsl(var(--gcp)/0.12)] text-gcp",
    all: "border-primary/30 bg-[hsl(var(--primary)/0.12)] text-primary",
  };

  const trendColors = {
    up: "text-destructive",
    down: "text-success",
    neutral: "text-muted-foreground",
  };

  return (
    <Card className="group relative overflow-hidden border border-border/60 bg-card/80 p-4 sm:p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <span className="pointer-events-none absolute inset-x-4 sm:inset-x-6 top-2 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 sm:space-y-2 flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">{value}</p>
          {change && trend && (
            <p className={cn("flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium", trendColors[trend])}>
              <span className="rounded-full bg-current/10 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs uppercase tracking-widest">
                {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
              </span>
              <span className="truncate">{change}</span>
            </p>
          )}
        </div>
        <div
          className={cn(
            "relative overflow-hidden rounded-lg sm:rounded-xl border-2 p-2 sm:p-3 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-2 flex-shrink-0",
            providerColors[provider]
          )}
        >
          <span className="pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-60" />
          <Icon className="relative z-10 h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </div>
    </Card>
  );
}
