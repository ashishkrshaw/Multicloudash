import { useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { CostChart } from "@/components/dashboard/CostChart";
import { ResourceTable } from "@/components/dashboard/ResourceTable";
import { UsageBreakdown } from "@/components/dashboard/UsageBreakdown";
import { MockDataBadge } from "@/components/ui/mock-data-badge";
import { handleOAuthCallback } from "@/lib/auth/google";
import {
  DollarSign,
  Server,
  AlertTriangle,
  TrendingUp,
  Cloud,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  Cpu,
  Clock,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { motion, type Variants, cubicBezier } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { useAwsCostSummary } from "@/hooks/use-aws-cost-summary";
import { useUnifiedOverview } from "@/hooks/use-unified-overview";
import type { ProviderCostTotals, UnifiedOverviewInsight } from "@/hooks/use-unified-overview";
import { useCurrency } from "@/context/CurrencyContext";

type HighlightCard = {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: string;
};

type MetricDefinition = {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
  provider?: "aws" | "azure" | "gcp" | "all";
};

type AwsServiceIntegration = {
  name: string;
  description: string;
  status: "connected" | "planned";
};

type FocusArea = {
  title: string;
  description: string;
  action: string;
  icon: LucideIcon;
  accent: string;
};

const DEFAULT_EASE = cubicBezier(0.16, 1, 0.3, 1);

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: DEFAULT_EASE },
  },
};

const staggerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: DEFAULT_EASE },
  },
};

const awsServiceIntegrations: AwsServiceIntegration[] = [
  {
    name: "AWS Cost Explorer",
    description: "Granular cost and usage metrics refreshed daily",
    status: "connected",
  },
  {
    name: "AWS CloudWatch",
    description: "Key operational alarms for compute and storage services",
    status: "connected",
  },
  {
    name: "AWS CloudTrail",
    description: "Audit trail ingestion for security and governance workflows",
    status: "connected",
  },
  {
    name: "AWS Trusted Advisor",
    description: "Checks for cost, performance, and resilience recommendations",
    status: "planned",
  },
  {
    name: "AWS Savings Plans",
    description: "Reservation coverage metrics for cost optimization",
    status: "planned",
  },
  {
    name: "AWS Security Hub",
    description: "Compliance signals across integrated workloads",
    status: "planned",
  },
];

const focusAreas: FocusArea[] = [
  {
    title: "Compute efficiency",
    description: "Right-size underutilized instances and consolidate burst workloads across regions.",
    action: "Review optimization",
    icon: Cpu,
    accent: "text-primary",
  },
  {
    title: "Cost anomaly watch",
    description: "Investigate services driving unexpected month-over-month spend increases.",
    action: "Inspect anomalies",
    icon: AlertTriangle,
    accent: "text-warning",
  },
  {
    title: "Operational resilience",
    description: "Validate failover coverage and security posture for critical applications.",
    action: "Open health view",
    icon: ShieldCheck,
    accent: "text-success",
  },
  {
    title: "Savings plan coverage",
    description: "Boost commitment coverage for steady-state compute to lock in discounts.",
    action: "Plan reservations",
    icon: Clock,
    accent: "text-azure",
  },
];

const PROVIDER_ACCENT_MAP: Record<UnifiedOverviewInsight["provider"], string> = {
  aws: "text-aws",
  azure: "text-azure",
  gcp: "text-gcp",
  multi: "text-primary",
};

const INSIGHT_TONE_MAP: Record<UnifiedOverviewInsight["severity"], string> = {
  info: "text-primary",
  warning: "text-warning",
  critical: "text-destructive",
};

const Index = () => {
  const navigate = useNavigate();
  const { format: formatCurrency, convert, currency: selectedCurrency } = useCurrency();
  const overviewQuery = useUnifiedOverview();
  const overview = overviewQuery.data;

  // Handle OAuth callback from backend
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('token') || params.has('error')) {
      handleOAuthCallback()
        .then((user) => {
          if (user) {
            // Remove query params and reload to show logged-in state
            window.history.replaceState({}, document.title, window.location.pathname);
            window.location.reload();
          }
        })
        .catch((error) => {
          console.error('OAuth error:', error);
          // Could show a toast notification here
        });
    }
  }, []);
  const awsCostSummary = useAwsCostSummary({ granularity: "MONTHLY" });

  const awsCurrency = awsCostSummary.data?.total.currency ?? "USD";

  const formatAmount = useCallback(
    (amount: number | null | undefined, baseCurrency?: string, maximumFractionDigits?: number) =>
      formatCurrency(amount ?? null, { from: baseCurrency, maximumFractionDigits }),
    [formatCurrency],
  );

  const convertAmount = useCallback(
    (amount: number | null | undefined, baseCurrency?: string) => {
      if (typeof amount !== "number" || Number.isNaN(amount)) {
        return null;
      }
      return convert(amount, { from: baseCurrency });
    },
    [convert],
  );

  const fallbackValue = awsCostSummary.isLoading ? "Loading..." : awsCostSummary.isError ? "Unavailable" : "—";
  const fallbackChangeLabel = awsCostSummary.isLoading ? "Loading..." : "Awaiting data";
  const fallbackHelper = awsCostSummary.isLoading
    ? "Fetching AWS billing data"
    : awsCostSummary.isError
      ? "Check API server logs"
      : "Waiting for Cost Explorer";

  const formatCurrencyValue = useCallback(
    (amount?: number) => {
      if (typeof amount === "number" && Number.isFinite(amount)) {
        return formatAmount(amount, awsCurrency);
      }
      return fallbackValue;
    },
    [awsCurrency, formatAmount, fallbackValue],
  );

  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }),
    [],
  );

  const awsLatestPeriod = useMemo(() => {
    const series = awsCostSummary.data?.timeSeries;
    if (!series || series.length === 0) {
      return null;
    }
    return series[series.length - 1];
  }, [awsCostSummary.data]);

  const awsPreviousPeriod = useMemo(() => {
    const series = awsCostSummary.data?.timeSeries;
    if (!series || series.length < 2) {
      return null;
    }
    return series[series.length - 2];
  }, [awsCostSummary.data]);

  const awsLatestDisplay = formatCurrencyValue(awsLatestPeriod?.amount);
  const awsMonthLabel = awsLatestPeriod ? monthFormatter.format(new Date(awsLatestPeriod.start)) : null;

  const awsChangePercent = useMemo(() => {
    if (!awsLatestPeriod || !awsPreviousPeriod || awsPreviousPeriod.amount === 0) {
      return null;
    }
    const change = ((awsLatestPeriod.amount - awsPreviousPeriod.amount) / awsPreviousPeriod.amount) * 100;
    return Number.isFinite(change) ? change : null;
  }, [awsLatestPeriod, awsPreviousPeriod]);

  const awsChangeLabel = useMemo(() => {
    if (awsChangePercent == null) {
      return fallbackChangeLabel;
    }
    const sign = awsChangePercent > 0 ? "+" : "";
    return `${sign}${awsChangePercent.toFixed(1)}% vs prior month`;
  }, [awsChangePercent, fallbackChangeLabel]);

  const awsTrend = useMemo<"up" | "down" | "neutral">(() => {
    if (awsChangePercent == null) {
      return "neutral";
    }
    if (awsChangePercent > 1) return "up";
    if (awsChangePercent < -1) return "down";
    return "neutral";
  }, [awsChangePercent]);

  const awsTopService = useMemo(() => {
    const top = awsCostSummary.data?.topServices;
    if (!top || top.length === 0) {
      return null;
    }
    return top[0];
  }, [awsCostSummary.data]);

  const awsTopServiceValue = awsTopService ? formatCurrencyValue(awsTopService.amount) : fallbackValue;
  const awsTopServiceHelper = awsTopService ? awsTopService.service : fallbackHelper;
  const awsForecastValue = awsChangePercent != null ? `${awsChangePercent > 0 ? "+" : ""}${awsChangePercent.toFixed(1)}%` : fallbackValue;
  const awsForecastHelper = awsChangePercent != null ? "Projected vs prior month" : fallbackHelper;

  const overviewFallbackValue = overviewQuery.isLoading ? "Loading..." : overviewQuery.isError ? "Unavailable" : "—";
  const overviewFallbackChange = overviewQuery.isLoading ? "Loading..." : overviewQuery.isError ? "Awaiting data" : "No comparison available";

  const providerCurrencyMap = useMemo(
    () => ({
      aws: overview?.costTotals.aws?.currency,
      azure: overview?.costTotals.azure?.currency,
      gcp: overview?.costTotals.gcp?.currency,
    }),
    [overview?.costTotals?.aws?.currency, overview?.costTotals?.azure?.currency, overview?.costTotals?.gcp?.currency],
  );

  const buildChangeLabel = useCallback(
    (totals?: ProviderCostTotals | null) => {
      if (!totals || totals.changePercentage == null) {
        return overviewFallbackChange;
      }
      const sign = totals.changePercentage > 0 ? "+" : "";
      return `${sign}${totals.changePercentage.toFixed(1)}% vs prior period`;
    },
    [overviewFallbackChange],
  );

  const getTrend = useCallback((totals?: ProviderCostTotals | null): "up" | "down" | "neutral" => {
    if (!totals || totals.changePercentage == null) {
      return "neutral";
    }
    if (totals.changePercentage > 1) return "up";
    if (totals.changePercentage < -1) return "down";
    return "neutral";
  }, []);

  const fetchedAtLabel = overview?.fetchedAt ? new Date(overview.fetchedAt).toLocaleString() : null;

  const combinedTotals = overview?.costTotals.combined ?? null;
  const awsTotals = overview?.costTotals.aws ?? null;
  const azureTotals = overview?.costTotals.azure ?? null;
  const gcpTotals = overview?.costTotals.gcp ?? null;

  const combinedValue = combinedTotals ? formatAmount(combinedTotals.total, combinedTotals.currency) : overviewFallbackValue;
  const combinedChangeLabel = buildChangeLabel(combinedTotals);
  const combinedTrend = getTrend(combinedTotals);
  
  // Build helper text for combined costs showing which providers contributed
  const combinedHelper = useMemo(() => {
    if (!combinedTotals || !fetchedAtLabel) return overviewFallbackChange;
    const providers = [];
    if (awsTotals) providers.push("AWS");
    if (azureTotals) providers.push("Azure");
    if (gcpTotals) providers.push("GCP");
    
    if (providers.length === 0) return overviewFallbackChange;
    if (providers.length === 3) return `Synced ${fetchedAtLabel}`;
    
    return `${providers.join(" + ")} data · Synced ${fetchedAtLabel}`;
  }, [combinedTotals, fetchedAtLabel, awsTotals, azureTotals, gcpTotals, overviewFallbackChange]);

  const awsOverviewValue = awsTotals ? formatAmount(awsTotals.total, awsTotals.currency) : overviewFallbackValue;
  const awsOverviewChange = buildChangeLabel(awsTotals);
  const awsOverviewTrend = getTrend(awsTotals);

  const azureValue = azureTotals ? formatAmount(azureTotals.total, azureTotals.currency) : overviewFallbackValue;
  const azureChangeLabel = buildChangeLabel(azureTotals);
  const azureTrend = getTrend(azureTotals);

  const gcpValue = gcpTotals ? formatAmount(gcpTotals.total, gcpTotals.currency) : overviewFallbackValue;
  const gcpChangeLabel = buildChangeLabel(gcpTotals);
  const gcpTrend = getTrend(gcpTotals);
  const gcpChangeLabelDisplay = gcpTotals?.isMock ? `${gcpChangeLabel} · mock data` : gcpChangeLabel;

  const combinedCompute = overview?.computeTotals.combined ?? null;
  const combinedComputeValue = combinedCompute ? combinedCompute.running.toString() : overviewFallbackValue;
  const combinedComputeHelper = combinedCompute
    ? `${combinedCompute.running} running · ${combinedCompute.stopped ?? 0} stopped · ${combinedCompute.terminated ?? 0} terminated`
    : overviewFallbackChange;

  const awsCompute = overview?.computeTotals.aws ?? null;
  const awsComputeValue = awsCompute ? awsCompute.running.toString() : overviewFallbackValue;
  const awsComputeHelper = awsCompute ? `${awsCompute.total} total · ${awsCompute.stopped ?? 0} stopped` : overviewFallbackChange;

  const azureCompute = overview?.computeTotals.azure ?? null;
  const azureComputeValue = azureCompute ? azureCompute.running.toString() : overviewFallbackValue;
  const azureComputeHelper = azureCompute ? `${azureCompute.total} total · ${azureCompute.stopped ?? 0} stopped` : overviewFallbackChange;

  const storage = overview?.storage;
  const combinedStorageCount = (storage?.aws?.buckets ?? 0) + (storage?.azure?.accounts ?? 0) + (storage?.gcp?.buckets ?? 0);
  const storageValue = combinedStorageCount > 0 ? combinedStorageCount.toString() : overviewFallbackValue;
  const storageHelper = storage
    ? `${storage.aws?.buckets ?? 0} AWS buckets · ${storage.azure?.accounts ?? 0} Azure accounts · ${storage.gcp?.buckets ?? 0} GCP buckets`
    : overviewFallbackChange;

  const usageBreakdownData = useMemo(() => {
    if (!overview?.usageBreakdown || overview.usageBreakdown.length === 0) {
      return undefined;
    }

    const providerColors: Record<"aws" | "azure" | "gcp", string> = {
      aws: "hsl(var(--aws))",
      azure: "hsl(var(--azure))",
      gcp: "hsl(var(--gcp))",
    };

    const items = overview.usageBreakdown
      .map((item) => {
        const fromCurrency = providerCurrencyMap[item.provider];
        const converted = convertAmount(item.amount ?? null, fromCurrency);
        const value = converted ?? item.amount ?? null;
        if (value == null || !Number.isFinite(value) || value <= 0) {
          return null;
        }
        return {
          name: `${item.provider.toUpperCase()} · ${item.service}`,
          value,
          color: providerColors[item.provider],
        };
      })
      .filter((entry): entry is { name: string; value: number; color: string } => entry !== null);

    return items.length > 0 ? items : undefined;
  }, [convertAmount, overview?.usageBreakdown, providerCurrencyMap]);

  const costChartData = useMemo(() => {
    if (!overview?.costTimeline || overview.costTimeline.length === 0) {
      return undefined;
    }

    return overview.costTimeline.map((point) => {
      const awsValue =
        point.aws != null ? convertAmount(point.aws, providerCurrencyMap.aws) ?? point.aws ?? undefined : undefined;
      const azureValuePoint =
        point.azure != null ? convertAmount(point.azure, providerCurrencyMap.azure) ?? point.azure ?? undefined : undefined;
      const gcpValuePoint =
        point.gcp != null ? convertAmount(point.gcp, providerCurrencyMap.gcp) ?? point.gcp ?? undefined : undefined;

      return {
        date: point.date,
        aws: typeof awsValue === "number" ? awsValue : undefined,
        azure: typeof azureValuePoint === "number" ? azureValuePoint : undefined,
        gcp: typeof gcpValuePoint === "number" ? gcpValuePoint : undefined,
      };
    });
  }, [convertAmount, overview?.costTimeline, providerCurrencyMap]);

  const topInsight = overview?.insights?.[0] ?? null;

  const heroHighlights = useMemo<HighlightCard[]>(() => {
    const highlights: HighlightCard[] = [
      {
        label: "Multi-cloud spend",
        value: combinedValue,
        helper: combinedHelper,
        icon: Activity,
        tone: "text-primary",
      },
      {
        label: "Top AWS service",
        value: awsTopServiceValue,
        helper: awsTopServiceHelper,
        icon: ShieldCheck,
        tone: "text-success",
      },
      {
        label: "Azure spend",
        value: azureValue,
        helper: azureChangeLabel,
        icon: Cloud,
        tone: "text-azure",
      },
    ];

    if (topInsight) {
      const InsightIcon = topInsight.severity === "info" ? Sparkles : AlertTriangle;
      highlights.push({
        label: `Insight · ${topInsight.provider.toUpperCase()}`,
        value: topInsight.title,
        helper: topInsight.detail,
        icon: InsightIcon,
        tone: INSIGHT_TONE_MAP[topInsight.severity],
      });
    } else {
      highlights.push({
        label: "Forecast",
        value: awsForecastValue,
        helper: awsForecastHelper,
        icon: TrendingUp,
        tone: "text-azure",
      });
    }

    return highlights;
  }, [
    azureChangeLabel,
    azureValue,
    awsForecastHelper,
    awsForecastValue,
    awsTopServiceHelper,
    awsTopServiceValue,
    combinedHelper,
    combinedValue,
    topInsight,
  ]);

  const primaryMetrics = useMemo<MetricDefinition[]>(
    () => [
      {
        title: "Total Monthly Cost",
        value: combinedValue,
        change: combinedChangeLabel,
        trend: combinedTrend,
        icon: DollarSign,
      },
      {
        title: "Active Compute Resources",
        value: combinedComputeValue,
        change: combinedComputeHelper,
        trend: "neutral" as const,
        icon: Server,
        provider: "all" as const,
      },
      {
        title: "Top AWS Service Spend",
        value: awsTopServiceValue,
        change: awsTopServiceHelper,
        trend: "neutral" as const,
        icon: ShieldCheck,
        provider: "aws" as const,
      },
      {
        title: "Storage Coverage",
        value: storageValue,
        change: storageHelper,
        trend: "neutral" as const,
        icon: Activity,
        provider: "all" as const,
      },
    ],
    [
      awsTopServiceHelper,
      awsTopServiceValue,
      combinedChangeLabel,
      combinedComputeHelper,
      combinedComputeValue,
      combinedTrend,
      combinedValue,
      storageHelper,
      storageValue,
    ],
  );

  const providerMetrics = useMemo<MetricDefinition[]>(
    () => [
      {
        title: "AWS Monthly Cost",
        value: awsOverviewValue,
        change: awsOverviewChange,
        trend: awsOverviewTrend,
        icon: Cloud,
        provider: "aws" as const,
      },
      {
        title: "Azure Monthly Cost",
        value: azureValue,
        change: azureChangeLabel,
        trend: azureTrend,
        icon: Cloud,
        provider: "azure" as const,
      },
      {
        title: "GCP Monthly Cost",
        value: gcpValue,
        change: gcpChangeLabelDisplay,
        trend: gcpTrend,
        icon: Cloud,
        provider: "gcp" as const,
      },
    ],
    [awsOverviewChange, awsOverviewTrend, awsOverviewValue, azureChangeLabel, azureTrend, azureValue, gcpChangeLabelDisplay, gcpTrend, gcpValue],
  );

  const providerNotes = useMemo(() => overview?.notes ?? [], [overview?.notes]);

  // Check if any provider is showing mock data
  const hasMockData = useMemo(() => {
    return overview?.notes.some(note => note.message.toLowerCase().includes('mock')) || false;
  }, [overview?.notes]);

  // Check if providers have errors
  const hasAwsError = useMemo(() => !overview?.costTotals.aws && !overviewQuery.isLoading, [overview?.costTotals.aws, overviewQuery.isLoading]);
  const hasAzureError = useMemo(() => !overview?.costTotals.azure && !overviewQuery.isLoading, [overview?.costTotals.azure, overviewQuery.isLoading]);
  const hasGcpError = useMemo(() => !overview?.costTotals.gcp && !overviewQuery.isLoading, [overview?.costTotals.gcp, overviewQuery.isLoading]);

  // Button handlers
  const handleViewOptimization = useCallback(() => {
    // Navigate to AWS page with optimization focus
    navigate("/aws");
  }, [navigate]);

  const handleComputeEfficiency = useCallback(() => {
    navigate("/aws");
  }, [navigate]);

  const handleCostAnomalies = useCallback(() => {
    navigate("/aws");
  }, [navigate]);

  const handleOperationalResilience = useCallback(() => {
    navigate("/aws");
  }, [navigate]);

  const handleSavingsPlan = useCallback(() => {
    navigate("/aws");
  }, [navigate]);

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.28),transparent_72%)] opacity-80 blur-3xl" />
        <div className="absolute bottom-[-14rem] right-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle_at_top_left,hsl(var(--azure)/0.25),transparent_68%)] opacity-60 blur-3xl" />
        <div className="absolute bottom-[-16rem] left-[-12rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_top_right,hsl(var(--gcp)/0.24),transparent_68%)] opacity-40 blur-3xl" />
      </div>
      <Header />

      <motion.main
        className="container relative z-10 mx-auto px-3 sm:px-6 py-6 sm:py-10"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: {
            transition: {
              staggerChildren: 0.16,
            },
          },
        }}
      >
        <motion.section
          variants={sectionVariants}
          className="rounded-2xl sm:rounded-3xl border border-border/60 bg-card/75 p-4 sm:p-8 shadow-lg backdrop-blur"
        >
          <motion.div variants={staggerVariants} className="space-y-4 sm:space-y-6">
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground"
            >
              <Badge className="bg-primary/10 text-primary ring-1 ring-primary/20 text-xs">Realtime overview</Badge>
              {hasMockData && <MockDataBadge />}
              <span className="flex items-center gap-1 sm:gap-2">
                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                <span className="hidden sm:inline">AI-assisted insights refreshed 5m ago</span>
                <span className="sm:hidden">Updated 5m ago</span>
              </span>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-end md:justify-between"
            >
              <div className="max-w-2xl space-y-2 sm:space-y-3">
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight md:text-4xl">
                  Unified visibility into your multi-cloud spend
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Prioritize actions that protect your budget while keeping mission-critical workloads online.
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleViewOptimization}
                className="group w-full justify-center gap-2 rounded-xl border-primary/30 bg-primary/5 text-primary transition hover:bg-primary/10 md:w-auto text-sm sm:text-base"
              >
                View optimization plan
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
              </Button>
            </motion.div>

            <motion.div variants={staggerVariants} className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {heroHighlights.map((highlight) => (
                <motion.div
                  key={highlight.label}
                  variants={itemVariants}
                  className="rounded-xl sm:rounded-2xl border border-border/50 bg-card/80 p-4 sm:p-5 shadow-sm backdrop-blur transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between gap-2 sm:gap-3">
                    <span className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">
                      {highlight.label}
                    </span>
                    <highlight.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${highlight.tone}`} />
                  </div>
                  <p className="mt-2 sm:mt-3 text-xl sm:text-2xl font-semibold">{highlight.value}</p>
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-muted-foreground">{highlight.helper}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </motion.section>

        <motion.section variants={sectionVariants} className="mt-6 sm:mt-10 space-y-4 sm:space-y-6">
          <motion.div variants={staggerVariants} className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {primaryMetrics.map((metric) => (
              <motion.div key={metric.title} variants={itemVariants}>
                <MetricCard {...metric} />
              </motion.div>
            ))}
          </motion.div>

          <motion.div variants={staggerVariants} className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {providerMetrics.map((metric) => (
              <motion.div key={metric.title} variants={itemVariants}>
                <MetricCard {...metric} />
              </motion.div>
            ))}
          </motion.div>

          {/* Provider Notes/Warnings Section */}
          {providerNotes.length > 0 && (
            <motion.div variants={itemVariants} className="mt-4 sm:mt-6">
              <Card className="border-warning/40 bg-warning/5">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-warning" />
                    <div className="space-y-1 sm:space-y-2">
                      <p className="text-xs sm:text-sm font-semibold text-foreground">
                        Some cloud providers reported errors
                      </p>
                      <div className="space-y-1">
                        {providerNotes.map((note, index) => (
                          <p key={index} className="text-xs text-muted-foreground">
                            <Badge variant="outline" className="mr-2 border-warning/40 text-warning">
                              {note.provider.toUpperCase()}
                            </Badge>
                            {note.message}
                          </p>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Data shown is aggregated from available providers. Check credentials and permissions for affected clouds.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.section>

        <motion.section variants={sectionVariants} className="mt-10">
          <Card className="border border-border/60 bg-card/80 shadow-sm">
            <CardContent className="p-6">
              <motion.div variants={staggerVariants} className="space-y-6">
                <motion.div variants={itemVariants} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    AWS service integrations
                  </div>
                  <p className="text-xl font-semibold">Confirming coverage for key managed services</p>
                  <p className="text-sm text-muted-foreground">
                    The dashboard currently ingests spend, utilization, and compliance signals from the following AWS platforms.
                  </p>
                </motion.div>
                <motion.div
                  variants={itemVariants}
                  className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                >
                  {awsServiceIntegrations.map((service) => (
                    <div
                      key={service.name}
                      className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-lg"
                    >
                      {service.status === "connected" ? (
                        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-success" />
                      ) : (
                        <Clock3 className="mt-1 h-5 w-5 shrink-0 text-warning" />
                      )}
                      <div className="space-y-1">
                        <p className="text-sm font-semibold leading-snug">{service.name}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{service.description}</p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section variants={sectionVariants} className="mt-10">
          <motion.div variants={staggerVariants} className="grid gap-6 lg:grid-cols-3">
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <CostChart data={costChartData} isLoading={overviewQuery.isLoading} />
            </motion.div>
            <motion.div variants={itemVariants}>
              <UsageBreakdown
                data={usageBreakdownData}
                isLoading={overviewQuery.isLoading}
                currency={selectedCurrency}
              />
            </motion.div>
          </motion.div>
        </motion.section>

        <motion.section variants={sectionVariants} className="mt-10">
          <motion.div variants={staggerVariants} className="grid gap-6 md:grid-cols-3">
            {focusAreas.map((item, index) => {
              const handlers = [
                handleComputeEfficiency,
                handleCostAnomalies,
                handleOperationalResilience,
                handleSavingsPlan,
              ];
              return (
                <motion.div key={item.title} variants={itemVariants}>
                  <Card className="h-full border border-border/60 bg-card/80 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                    <CardContent className="flex h-full flex-col gap-4 p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="rounded-xl bg-secondary/70 p-3 text-foreground">
                          <item.icon className={`h-5 w-5 ${item.accent}`} />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handlers[index]}
                          className="group gap-1 text-primary hover:bg-primary/10"
                        >
                          {item.action}
                          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-base font-semibold leading-snug">{item.title}</h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.section>

        <motion.section variants={sectionVariants} className="mt-10">
          <motion.div variants={itemVariants}>
            <ResourceTable />
          </motion.div>
        </motion.section>
      </motion.main>
    </div>
  );
};

export default Index;
