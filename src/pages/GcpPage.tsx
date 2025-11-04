import { useCallback, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { UsageBreakdown } from "@/components/dashboard/UsageBreakdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Cloud,
  Cpu,
  Database,
  HardDrive,
  Power,
  Server,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { useCurrency } from "@/context/CurrencyContext";
import { useGcpOverview } from "@/hooks/use-gcp-overview";

type GcpErrorGroup = {
  message: string;
  sections: string[];
  occurrences: number;
};

const formatStorage = (sizeGb: number | null | undefined) => {
  if (typeof sizeGb !== "number" || Number.isNaN(sizeGb)) {
    return "—";
  }
  if (sizeGb >= 1024) {
    return `${(sizeGb / 1024).toFixed(1)} TB`;
  }
  return `${sizeGb.toFixed(0)} GB`;
};

const statusLabel = (status: string) => {
  switch (status) {
    case "running":
      return "Running";
    case "stopped":
    case "suspended":
      return "Stopped";
    case "terminated":
      return "Terminated";
    case "provisioning":
      return "Provisioning";
    default:
      return status;
  }
};

const GcpPage = () => {
  const { format: formatCurrency, convert, currency: selectedCurrency } = useCurrency();
  const overviewQuery = useGcpOverview();
  const overview = overviewQuery.data;

  const gcpCurrency = overview?.cost?.currency ?? "USD";
  const computeInstances = overview?.compute?.instances ?? [];
  const storageBuckets = overview?.storage?.buckets ?? [];
  const sqlInstances = overview?.sql?.instances ?? [];
  const costByService = overview?.cost?.byService ?? [];
  const costDaily = overview?.cost?.daily ?? [];
  const alerts = overview?.alerts ?? [];

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

  const totalCostDisplay = formatAmount(overview?.cost?.total, gcpCurrency);
  const projectId = overview?.projectId ?? "unknown project";
  const fetchedLabel = overview?.fetchedAt ? new Date(overview.fetchedAt).toLocaleString() : null;

  const costChangeLabel = useMemo(() => {
    if (overview?.cost?.changePercentage == null) {
      if (overview?.cost?.isMock) return "Mock data";
      return overviewQuery.isLoading ? "Loading cost delta" : "Awaiting comparison";
    }
    const delta = overview.cost.changePercentage * 100;
    const prefix = delta > 0 ? "+" : "";
    return `${prefix}${delta.toFixed(1)}% vs prior period`;
  }, [overview?.cost, overviewQuery.isLoading]);

  const computeTotals = overview?.compute?.totals ?? { total: 0, running: 0, stopped: 0, terminated: 0 };
  const storageTotals = overview?.storage?.totals ?? { bucketCount: storageBuckets.length, storageGb: null };
  const sqlTotals = overview?.sql?.totals ?? { total: sqlInstances.length, running: sqlInstances.length };

  const usageBreakdownData = useMemo(() => {
    if (!costByService.length) return undefined;
    return costByService
      .map((entry) => {
        const value = convertAmount(entry.amount ?? null, gcpCurrency) ?? entry.amount ?? null;
        if (value == null || !Number.isFinite(value) || value <= 0) {
          return null;
        }
        return {
          name: entry.service,
          value,
        };
      })
      .filter((entry): entry is { name: string; value: number } => entry !== null);
  }, [convertAmount, costByService, gcpCurrency]);

  const costTimeline = useMemo(() => {
    if (!costDaily.length) return [];
    return costDaily.slice(-30).map((point) => ({
      date: point.date,
      amount: convertAmount(point.amount, gcpCurrency) ?? point.amount,
    }));
  }, [convertAmount, costDaily, gcpCurrency]);

  const gcpErrorGroups = useMemo<GcpErrorGroup[]>(() => {
    const rawErrors = [...(overview?.errors ?? [])];
    if (overviewQuery.isError) {
      const message = overviewQuery.error instanceof Error ? overviewQuery.error.message : String(overviewQuery.error);
      rawErrors.push({ section: "overview", message });
    }
    if (rawErrors.length === 0) {
      return [];
    }
    const map = new Map<string, GcpErrorGroup>();
    for (const error of rawErrors) {
      const existing = map.get(error.message);
      if (existing) {
        existing.sections = Array.from(new Set([...existing.sections, error.section]));
        existing.occurrences += 1;
      } else {
        map.set(error.message, { message: error.message, sections: [error.section], occurrences: 1 });
      }
    }
    return Array.from(map.values());
  }, [overview?.errors, overviewQuery.error, overviewQuery.isError]);

  const highPriorityAlert = alerts[0] ?? null;

  const costChartData = useMemo(
    () =>
      costTimeline.map((point) => ({
        date: point.date,
        amount: typeof point.amount === "number" ? Number(point.amount.toFixed(2)) : 0,
      })),
    [costTimeline],
  );

  const metricCards = useMemo(
    () => [
      {
        title: "Monthly Cost",
        value: totalCostDisplay,
        change: costChangeLabel,
        trend:
          overview?.cost?.changePercentage == null
            ? "neutral"
            : overview.cost.changePercentage > 0
              ? "up"
              : overview.cost.changePercentage < 0
                ? "down"
                : "neutral",
        icon: BarChart3,
        provider: "gcp" as const,
      },
      {
        title: "Compute Instances",
        value: computeTotals.total.toString(),
        change: `${computeTotals.running} running · ${computeTotals.stopped} stopped`,
        trend: "neutral" as const,
        icon: Server,
        provider: "gcp" as const,
      },
      {
        title: "Storage Buckets",
        value: storageTotals.bucketCount.toString(),
        change:
          storageTotals.storageGb != null
            ? `${formatStorage(storageTotals.storageGb)}`
            : overviewQuery.isLoading
              ? "Loading storage footprint"
              : "Size metrics coming soon",
        trend: "neutral" as const,
        icon: HardDrive,
        provider: "gcp" as const,
      },
      {
        title: "Cloud SQL",
        value: sqlTotals.total.toString(),
        change: `${sqlTotals.running} runnable`,
        trend: "neutral" as const,
        icon: Database,
        provider: "gcp" as const,
      },
    ],
    [computeTotals, costChangeLabel, overview?.cost?.changePercentage, overviewQuery.isLoading, sqlTotals, storageTotals, totalCostDisplay],
  );

  const servicesSnapshot = (overview?.services ?? []).slice(0, 10);

  const handleInstanceAction = (instanceName: string, action: "start" | "stop") => {
    toast.success(`${action === "start" ? "Started" : "Stopped"} ${instanceName}`);
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_rgba(52,211,153,0.14),transparent_60%)]" />
      </div>

      <Header />

      <main className="container mx-auto flex max-w-7xl flex-col gap-10 px-6 pb-20 pt-10">
        {gcpErrorGroups.length > 0 && (
          <Card className="border-destructive/40 bg-destructive/10 shadow-lg">
            <CardContent className="space-y-3 p-6 text-sm text-destructive-foreground">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/15">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-base font-semibold">Some GCP data failed to load</p>
                    <p className="text-xs text-destructive-foreground/80">Verify service account roles and API enablement.</p>
                  </div>
                  <ul className="space-y-2">
                    {gcpErrorGroups.map((group) => (
                      <li key={group.message} className="rounded-2xl border border-destructive/25 bg-destructive/5 p-3">
                        <p className="text-sm font-medium leading-snug">{group.message}</p>
                        <p className="mt-1 text-xs text-destructive-foreground/80">
                          Impacted sections: {group.sections.join(", ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="relative overflow-hidden rounded-3xl border-white/10 bg-white/5 shadow-xl backdrop-blur">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-gcp/10" />
            <CardHeader className="relative space-y-4">
              <Badge variant="outline" className="w-fit border-white/30 bg-white/10 text-[0.7rem] uppercase tracking-[0.35em] text-foreground">
                Google Cloud Platform
              </Badge>
              <CardTitle className="text-4xl font-semibold tracking-tight">Unified GCP Operations Deck</CardTitle>
              <p className="max-w-2xl text-sm text-muted-foreground">
                A single pane of glass for spend, compute, storage, and SQL services across the {projectId} project. All values honour
                the global currency selector.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="bg-white/10 text-foreground">
                  <Cloud className="mr-1 h-3 w-3" />
                  Project · {projectId}
                </Badge>
                {overview?.isMock ? (
                  <Badge variant="secondary" className="bg-warning/20 text-warning">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Mock dataset
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-success/20 text-success">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    Live data
                  </Badge>
                )}
                {fetchedLabel && <span>Fetched {fetchedLabel}</span>}
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Monthly spend</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{totalCostDisplay}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{costChangeLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Compute footprint</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{computeTotals.running} / {computeTotals.total}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Running vs total Compute Engine instances</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Storage overview</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{storageTotals.bucketCount}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Buckets monitored · {storageTotals.storageGb != null ? formatStorage(storageTotals.storageGb) : "awaiting size"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-xl backdrop-blur">
            <CardHeader className="space-y-3">
              <CardTitle className="text-lg">Insights & alerts</CardTitle>
              <p className="text-xs text-muted-foreground">Operational highlights surfaced from the latest sampling window.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {highPriorityAlert ? (
                <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
                  <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-warning/20 text-warning">
                    <Activity className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold">{highPriorityAlert.message}</p>
                    <p className="mt-1 text-xs text-warning/90">
                      {highPriorityAlert.severity.toUpperCase()} · review workloads under sustained demand.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4" />
                  No standing alerts detected across monitored services.
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Enabled services</p>
                <p className="mt-1">{servicesSnapshot.length} APIs active · ensure Billing API is enabled for cost visibility.</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {servicesSnapshot.map((service) => (
                    <Badge key={service.service} variant="outline" className="border-white/20 bg-white/5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                      {service.service.split("/").at(-1)}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Cost by service</CardTitle>
                <p className="text-xs text-muted-foreground">Amounts shown in {selectedCurrency} with live conversion.</p>
              </div>
              {!overview?.cost?.isMock && (
                <Badge variant="outline" className="border-success/40 bg-success/15 text-xs uppercase tracking-[0.25em] text-success">
                  Live billing
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={costByService.map((entry) => ({
                  service: entry.service,
                  amount: convertAmount(entry.amount ?? null, gcpCurrency) ?? entry.amount ?? 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-white/10" />
                  <XAxis
                    dataKey="service"
                    className="text-xs text-muted-foreground"
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis className="text-xs text-muted-foreground" tickFormatter={(value) => formatAmount(value, selectedCurrency, 0)} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) => formatAmount(value, selectedCurrency, 2)}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--gcp))" radius={[12, 12, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Spend distribution</CardTitle>
              <p className="text-xs text-muted-foreground">Top services contributing to current month spend.</p>
            </CardHeader>
            <CardContent>
              <UsageBreakdown
                data={usageBreakdownData?.map((entry, index) => ({
                  ...entry,
                  color:
                    ["hsl(var(--gcp))", "hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))"][index % 5],
                }))}
                currency={selectedCurrency}
                isLoading={overviewQuery.isLoading}
              />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Daily spend trend</CardTitle>
                <p className="text-xs text-muted-foreground">Last 30 days aggregated by Cost Management.</p>
              </div>
              <Badge variant="outline" className="border-white/20 bg-white/5 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                {selectedCurrency}
              </Badge>
            </CardHeader>
            <CardContent className="h-[300px]">
              {costChartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-white/10" />
                    <XAxis dataKey="date" className="text-xs text-muted-foreground" tickLine={false} axisLine={{ stroke: "transparent" }} />
                    <YAxis className="text-xs text-muted-foreground" tickLine={false} axisLine={{ stroke: "transparent" }} tickFormatter={(value) => formatAmount(value, selectedCurrency, 0)} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value: number) => formatAmount(value, selectedCurrency, 2)}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--gcp))" radius={[12, 12, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {overviewQuery.isLoading ? "Loading cost timeline..." : "No cost timeline available."}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Safeguards</CardTitle>
              <p className="text-xs text-muted-foreground">Checklist to maintain healthy spend and resiliency.</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Billing</p>
                <p className="mt-2 text-sm font-medium text-foreground">Ensure Cloud Billing API enabled</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Required for live spend metrics. Service account needs `billing.viewer` on billing account.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">IAM scope</p>
                <p className="mt-2 text-sm font-medium text-foreground">Roles/Viewer + Service Usage Viewer</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Grants read access across Compute Engine, Cloud Storage, Cloud SQL and Service Usage.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Security</p>
                <p className="mt-2 text-sm font-medium text-foreground">Rotate service account keys regularly</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Replace `sunlit-mantra-442310-t2` credentials after configuring workload identity.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[3fr,2fr]">
          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Compute Engine fleet</CardTitle>
              <p className="text-xs text-muted-foreground">Limited controls: Start · Stop actions respect IAM guardrails.</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead>Name</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Machine</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>CPU</TableHead>
                    <TableHead>Monthly cost</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computeInstances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                        {overviewQuery.isLoading ? "Loading instances..." : "No Compute Engine instances discovered."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    computeInstances.slice(0, 40).map((instance) => {
                      const cpuPercent = Math.round((instance.cpuUtilization ?? 0) * 100);
                      const convertedCost = formatAmount(instance.monthlyCostEstimate ?? null, gcpCurrency, 2);
                      return (
                        <TableRow key={instance.id} className="border-white/5">
                          <TableCell className="font-medium text-foreground">{instance.name}</TableCell>
                          <TableCell className="text-muted-foreground">{instance.zone}</TableCell>
                          <TableCell className="text-muted-foreground">{instance.machineType ?? "—"}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                instance.status === "running"
                                  ? "bg-success"
                                  : instance.status === "stopped"
                                    ? "bg-warning"
                                    : "bg-muted text-foreground"
                              }
                            >
                              {statusLabel(instance.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {cpuPercent > 85 && <Cpu className="h-4 w-4 text-warning" />}
                              <span className={cpuPercent > 85 ? "text-warning font-semibold" : "text-muted-foreground"}>
                                {cpuPercent}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">{convertedCost}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant={instance.status === "running" ? "destructive" : "outline"}
                              onClick={() => handleInstanceAction(instance.name, instance.status === "running" ? "stop" : "start")}
                            >
                              <Power className="mr-1 h-4 w-4" />
                              {instance.status === "running" ? "Stop" : "Start"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Cloud Storage buckets</CardTitle>
                <p className="text-xs text-muted-foreground">Configuration metadata (read-only).</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {storageBuckets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No buckets returned for this project.</p>
                ) : (
                  storageBuckets.slice(0, 5).map((bucket) => (
                    <div key={bucket.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{bucket.name}</span>
                        <Badge variant="outline" className="border-white/15 bg-white/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                          {bucket.storageClass ?? "Unknown"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{bucket.location}</span>
                        <span className="h-1 w-1 rounded-full bg-muted" />
                        <span>{formatStorage(bucket.sizeGb)}</span>
                        {bucket.labels?.environment && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.25em] text-foreground">
                            {bucket.labels.environment}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Cloud SQL estate</CardTitle>
                <p className="text-xs text-muted-foreground">Top instances across MySQL & PostgreSQL.</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {sqlInstances.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No Cloud SQL instances detected.</p>
                ) : (
                  sqlInstances.slice(0, 5).map((instance) => (
                    <div key={instance.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{instance.name}</span>
                        <Badge variant="outline" className="border-white/15 bg-white/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                          {instance.databaseVersion ?? "Unknown"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{instance.region}</span>
                        <span className="h-1 w-1 rounded-full bg-muted" />
                        <span>{instance.instanceType ?? "Tier N/A"}</span>
                        <span className="h-1 w-1 rounded-full bg-muted" />
                        <span>{formatStorage(instance.storageSizeGb)}</span>
                        <Badge variant="secondary" className="bg-success/20 text-success">
                          {instance.state ?? "STATE"}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

export default GcpPage;
