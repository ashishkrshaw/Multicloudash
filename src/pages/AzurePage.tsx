import { useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import {
  useAzureOverview,
  useAzureVirtualMachines,
  useAzureVmAction,
  type AzureVirtualMachine,
} from "@/hooks/use-azure-overview";
import {
  AlertTriangle,
  Activity,
  BarChart3,
  Database,
  FolderOpen,
  HardDrive,
  Network,
  Server,
  Tag,
  Cloud,
} from "lucide-react";
import { toast } from "sonner";

const COST_WINDOW_LABELS = {
  MONTH_TO_DATE: "Month to date",
  LAST_30_DAYS: "Last 30 days",
  LAST_90_DAYS: "Last 90 days",
  PREVIOUS_MONTH: "Previous month",
} as const;

const COST_WINDOW_OPTIONS = (
  Object.entries(COST_WINDOW_LABELS) as Array<[
    keyof typeof COST_WINDOW_LABELS,
    (typeof COST_WINDOW_LABELS)[keyof typeof COST_WINDOW_LABELS],
  ]>
).map(([value, label]) => ({
  value,
  label,
}));

type CostWindowOption = (typeof COST_WINDOW_OPTIONS)[number]["value"];

const currencyFormatter = (currency: string | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: 0,
  });

const describePowerState = (state: string) => {
  switch (state) {
    case "running":
      return "Running";
    case "stopped":
      return "Stopped";
    case "deallocated":
      return "Deallocated";
    case "starting":
      return "Starting";
    case "stopping":
      return "Stopping";
    default:
      return "Unknown";
  }
};

type AzureOverviewError = {
  section: string;
  message: string;
};

type AzureErrorGroup = {
  key: string;
  summary: string;
  detail: string;
  sections: string[];
  occurrences: number;
  suggestion?: string;
  code?: string;
  timestamp?: string;
  correlationId?: string;
  traceId?: string;
};

const interpretAzureError = (raw: string): Omit<AzureErrorGroup, "sections" | "occurrences"> => {
  const detail = raw.replace(/\s+/g, " ").trim();
  const codeMatch = detail.match(/AADSTS(\d+)/i);
  const timestampMatch = detail.match(/Timestamp:\s*([0-9T:\-:.Z ]+)/i);
  const correlationMatch = detail.match(/Correlation ID:\s*([0-9a-f-]+)/i);
  const traceMatch = detail.match(/Trace ID:\s*([0-9a-f-]+)/i);
  const appMatch = detail.match(/app '([0-9a-f-]+)'/i);

  const code = codeMatch ? `AADSTS${codeMatch[1]}` : undefined;
  let summary = code ? `Azure AD error ${code}` : detail;
  let suggestion: string | undefined;

  if (code === "AADSTS7000215" || /invalid client secret/i.test(detail)) {
    const appIdReference = appMatch?.[1] ? ` (${appMatch[1]})` : "";
    summary = "Azure AD authentication failed – invalid client secret";
    suggestion = `Generate a new client secret for the Azure AD app${appIdReference} and update the backend credential (for example AZURE_CLIENT_SECRET).`;
  } else if (code === "AADSTS700016" || /invalid client/i.test(detail)) {
    summary = "Azure AD authentication failed – invalid client identifier";
    suggestion = "Confirm the Azure AD application ID matches the registered enterprise application.";
  }

  return {
    key: code ?? detail,
    summary,
    detail,
    suggestion,
    code,
    timestamp: timestampMatch?.[1] ?? undefined,
    correlationId: correlationMatch?.[1] ?? undefined,
    traceId: traceMatch?.[1] ?? undefined,
  };
};

const AzurePage = () => {
  const [costWindow, setCostWindow] = useState<CostWindowOption>("MONTH_TO_DATE");
  const overviewQuery = useAzureOverview();
  const virtualMachinesQuery = useAzureVirtualMachines();
  const vmAction = useAzureVmAction();

  const overview = overviewQuery.data;
  const compute = overview?.compute;
  const networking = overview?.networking;
  const storage = overview?.storage;
  const databases = overview?.databases;
  const monitoring = overview?.monitoring;
  const inventory = overview?.inventory;
  const costWindows = overview?.cost ?? [];

  const selectedCostWindow = useMemo(() => {
    const targetLabel = COST_WINDOW_LABELS[costWindow];
    return costWindows.find((window) => window.label === targetLabel) ?? costWindows[0] ?? null;
  }, [costWindow, costWindows]);

  const costCurrency = selectedCostWindow?.total.currency ?? "USD";
  const costValueFormatter = currencyFormatter(costCurrency);

  const costChange = useMemo(() => {
    if (!selectedCostWindow?.daily || selectedCostWindow.daily.length < 2) {
      return null;
    }
    const series = selectedCostWindow.daily;
    const latest = series.at(-1)?.amount ?? 0;
    const previous = series.at(-2)?.amount ?? 0;
    if (!Number.isFinite(latest) || !Number.isFinite(previous) || previous === 0) {
      return null;
    }
    const delta = (latest - previous) / previous;
    return {
      delta,
      text: `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}% day-over-day`,
    };
  }, [selectedCostWindow]);

  const combinedAzureErrors = useMemo(() => {
    const collected: AzureOverviewError[] = [...(overview?.errors ?? [])];
    if (virtualMachinesQuery.isError) {
      const message = virtualMachinesQuery.error instanceof Error
        ? virtualMachinesQuery.error.message
        : String(virtualMachinesQuery.error ?? "Virtual machine query failed");
      collected.push({ section: "Virtual Machines API", message });
    }
    return collected;
  }, [overview?.errors, virtualMachinesQuery.error, virtualMachinesQuery.isError]);

  const azureErrorGroups = useMemo<AzureErrorGroup[]>(() => {
    if (combinedAzureErrors.length === 0) {
      return [];
    }
    const map = new Map<string, AzureErrorGroup>();
    for (const error of combinedAzureErrors) {
      const interpreted = interpretAzureError(error.message);
      const existing = map.get(interpreted.key);
      if (existing) {
        existing.sections = Array.from(new Set([...existing.sections, error.section]));
        existing.occurrences += 1;
      } else {
        map.set(interpreted.key, {
          ...interpreted,
          sections: [error.section],
          occurrences: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.occurrences - a.occurrences);
  }, [combinedAzureErrors]);

  const hasAzureErrors = azureErrorGroups.length > 0;

  const vmRows = useMemo(() => {
    if (virtualMachinesQuery.data?.vms) {
      return virtualMachinesQuery.data.vms;
    }
    return compute?.vms ?? [];
  }, [virtualMachinesQuery.data, compute?.vms]);

  const runningVms = compute?.totals?.running ?? 0;
  const totalVms = compute?.totals?.total ?? vmRows.length ?? 0;

  const networkRegionCount = useMemo(() => {
    if (!networking) return 0;
    const regions = new Set<string>();
    networking.virtualNetworks.forEach((vnet) => regions.add(vnet.location));
    networking.publicIps.forEach((ip) => regions.add(ip.location));
    networking.loadBalancers.forEach((lb) => regions.add(lb.location));
    return regions.size;
  }, [networking]);

  const heroStats = useMemo(
    () => [
      {
        label: "Azure spend",
        value: selectedCostWindow ? costValueFormatter.format(selectedCostWindow.total.amount) : "—",
        description: costChange?.text ?? selectedCostWindow?.label ?? "Awaiting cost data",
      },
      {
        label: "Virtual machines",
        value: totalVms.toString(),
        description: `${runningVms} running · ${(compute?.totals?.deallocated ?? 0) + (compute?.totals?.stopped ?? 0)} stopped`,
      },
      {
        label: "Resource groups",
        value: (inventory?.resourceGroups.length ?? 0).toString(),
        description: `${inventory?.totalResources ?? 0} resources catalogued`,
      },
    ],
    [selectedCostWindow, costValueFormatter, costChange, totalVms, runningVms, compute?.totals, inventory?.resourceGroups.length, inventory?.totalResources],
  );

  const serviceTiles = useMemo(
    () => [
      {
        key: "compute",
        title: "Compute",
        code: "VMs",
        icon: Server,
        accent: "from-sky-500/40 via-sky-500/10 to-transparent",
        value: totalVms.toString(),
        meta: `${runningVms} running · limited start/restart/power off/deallocate access`,
      },
      {
        key: "network",
        title: "Networking",
        code: "NET",
        icon: Network,
        accent: "from-cyan-500/40 via-cyan-500/10 to-transparent",
        value: networking ? `${networking.virtualNetworks.length}` : "—",
        meta: networking
          ? `${networking.virtualNetworks.length} virtual networks · ${networking.publicIps.length} public IPs · ${networkRegionCount} regions`
          : "Read-only access to vNets, NICs, IPs, and load balancers",
      },
      {
        key: "storage",
        title: "Storage",
        code: "STRG",
        icon: HardDrive,
        accent: "from-indigo-500/40 via-indigo-500/10 to-transparent",
        value: storage ? `${storage.accounts.length}` : "—",
        meta: "View storage accounts and configuration metadata",
      },
      {
        key: "databases",
        title: "Databases",
        code: "DB",
        icon: Database,
        accent: "from-violet-500/40 via-violet-500/10 to-transparent",
        value: databases
          ? `${databases.sqlServers.length + databases.mysqlServers.length + databases.postgresServers.length}`
          : "—",
        meta: "Read access for SQL, PostgreSQL, and MySQL instances",
      },
      {
        key: "monitoring",
        title: "Monitoring",
        code: "MON",
        icon: Activity,
        accent: "from-emerald-500/40 via-emerald-500/10 to-transparent",
        value: monitoring ? `${monitoring.metricAlerts}` : "—",
        meta: monitoring
          ? `${monitoring.metricAlerts} metric alerts · ${monitoring.activityLogAlerts} activity log alerts`
          : "Metric, alert, and diagnostic insights",
      },
      {
        key: "billing",
        title: "Billing & cost",
        code: "COST",
        icon: BarChart3,
        accent: "from-blue-500/30 via-blue-500/10 to-transparent",
        value: selectedCostWindow ? costValueFormatter.format(selectedCostWindow.total.amount) : "—",
        meta: selectedCostWindow ? `${selectedCostWindow.label} window` : "Consumption & cost trends",
      },
      {
        key: "tags",
        title: "Tags & metadata",
        code: "TAGS",
        icon: Tag,
        accent: "from-orange-500/30 via-orange-500/10 to-transparent",
        value: inventory ? `${inventory.topTags.length}` : "—",
        meta: inventory ? `${inventory.topTags.length} top tags indexed` : "Tag visibility across resources",
      },
      {
        key: "inventory",
        title: "Resource inventory",
        code: "INV",
        icon: FolderOpen,
        accent: "from-azure/30 via-azure/10 to-transparent",
        value: inventory ? `${inventory.totalResources}` : "—",
        meta: inventory ? `${inventory.resourceGroups.length} resource groups` : "Full subscription scope discovery",
      },
    ],
    [
      totalVms,
      runningVms,
      networking,
      networkRegionCount,
      storage,
      databases,
      monitoring,
      selectedCostWindow,
      costValueFormatter,
      inventory,
    ],
  );

  const categoryPolicies = [
    {
      icon: Server,
      title: "Compute (VMs)",
      description:
        "Inspect all virtual machines and scale sets with power controls limited to Start, Restart, Power Off, and Deallocate actions.",
    },
    {
      icon: Network,
      title: "Networking",
      description:
        "Read-only visibility into virtual networks, interfaces, public IPs, and load balancers for topology awareness.",
    },
    {
      icon: HardDrive,
      title: "Storage",
      description: "List storage accounts and configuration metadata without modifying data or policies.",
    },
    {
      icon: Database,
      title: "Databases",
      description: "Read-only access to Azure SQL, PostgreSQL, and MySQL instances and their databases for observability.",
    },
    {
      icon: Activity,
      title: "Monitoring & Insights",
      description: "Review metrics, alert rules, and diagnostic signals mirroring Azure Monitor visibility.",
    },
    {
      icon: BarChart3,
      title: "Billing & Cost Management",
      description: "Consume billing, consumption, and cost management APIs for spend dashboards and trend analysis.",
    },
    {
      icon: Tag,
      title: "Tags & Metadata",
      description: "Read tags and metadata for categorisation, filtering, and governance alignment.",
    },
    {
      icon: FolderOpen,
      title: "Resource Inventory",
      description: "Enumerate subscriptions, resource groups, and resources scoped to the delegated access policy.",
    },
  ];

  const handleVmAction = (vm: AzureVirtualMachine, action: "start" | "restart" | "poweroff" | "deallocate") => {
    vmAction.mutate(
      { resourceGroup: vm.resourceGroup, vmName: vm.name, action },
      {
        onSuccess: (updatedVm) => {
          toast.success(`${action === "start" ? "Started" : action === "restart" ? "Restarted" : action === "poweroff" ? "Powered off" : "Deallocated"} ${updatedVm.name}`);
        },
        onError: (error) => {
          toast.error((error as Error).message ?? "Failed to update VM state");
        },
      },
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(61,132,255,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_rgba(34,221,255,0.12),transparent_60%)]" />
      </div>

      <Header />

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 pb-20 pt-10">
        {hasAzureErrors && (
          <Alert
            variant="destructive"
            className="rounded-3xl border-destructive/40 bg-destructive/10 px-6 py-5 text-sm text-destructive-foreground shadow-lg backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/20">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <AlertTitle className="text-base font-semibold">Some Azure data failed to load</AlertTitle>
                <AlertDescription>
                  <ul className="mt-3 space-y-3">
                    {azureErrorGroups.map((group) => (
                      <li
                        key={group.key}
                        className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-sm font-semibold leading-snug">{group.summary}</span>
                          <Badge
                            variant="outline"
                            className="border-destructive/40 bg-destructive/10 text-[10px] font-semibold uppercase tracking-[0.25em] text-destructive"
                          >
                            {group.sections.length} area{group.sections.length > 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-destructive-foreground/80">
                          Impacted sections: {group.sections.join(", ")}
                        </p>
                        {group.suggestion && (
                          <p className="mt-2 text-xs text-destructive-foreground/90">
                            Next step: {group.suggestion}
                          </p>
                        )}
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer text-destructive-foreground/80 underline">
                            Inspect Azure response
                          </summary>
                          <div className="mt-1 space-y-1 break-words text-[11px] leading-relaxed text-destructive-foreground/70">
                            <p>{group.detail}</p>
                            {group.correlationId && <p>Correlation ID: {group.correlationId}</p>}
                            {group.traceId && <p>Trace ID: {group.traceId}</p>}
                            {group.timestamp && <p>Timestamp: {group.timestamp}</p>}
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="relative overflow-hidden rounded-3xl border-white/10 bg-white/5 shadow-xl backdrop-blur">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-azure/10" />
            <CardHeader className="relative pb-2">
              <Badge variant="outline" className="border-azure/60 bg-azure/10 text-[0.7rem] uppercase tracking-[0.3em] text-azure">
                Microsoft Azure
              </Badge>
              <CardTitle className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Unified Azure Operations Deck</CardTitle>
              <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
                A curated Azure control center with rich insight, safe operational toggles, and the same dark aesthetic as the AWS console.
                Observe cost, performance, and governance without overwhelming detail.
              </p>
            </CardHeader>
            <CardContent className="relative">
              <div className="grid gap-6 md:grid-cols-3">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-inner">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{stat.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-foreground md:text-4xl">{stat.value}</p>
                    <p className="mt-3 text-xs text-muted-foreground">{stat.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-xl backdrop-blur">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-azure/15">
                    <Cloud className="h-6 w-6 text-azure" />
                  </span>
                  Cost Explorer snapshot
                </CardTitle>
                <Select value={costWindow} onValueChange={(value) => setCostWindow(value as CostWindowOption)}>
                  <SelectTrigger className="w-full rounded-2xl border-white/15 bg-background/40 text-xs text-foreground shadow-sm backdrop-blur sm:w-[220px]">
                    <SelectValue placeholder="Select window" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border border-white/10 bg-background/95 text-sm shadow-lg backdrop-blur">
                    {COST_WINDOW_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="flex flex-col items-start gap-1 text-left text-sm">
                        <span className="font-medium text-foreground">{option.label}</span>
                        <span className="text-xs text-muted-foreground">Azure Cost Management</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Real-time usage pull from Azure Cost Management
                <span className="block text-[11px] text-muted-foreground/80">{selectedCostWindow?.label ?? "Awaiting cost dataset"}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-2xl border border-white/5 bg-secondary/40 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{selectedCostWindow?.label ?? "Window"}</p>
                <p className="mt-2 text-3xl font-semibold">
                  {selectedCostWindow ? costValueFormatter.format(selectedCostWindow.total.amount) : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {costChange ? costChange.text : "Awaiting comparison"}
                </p>
              </div>
              <Separator className="bg-white/5" />
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Cost trend (last 14 days)</p>
                <div className="h-[140px] w-full">
                  {selectedCostWindow?.daily && selectedCostWindow.daily.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedCostWindow.daily.slice(-14)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-white/10" />
                        <XAxis dataKey="date" className="text-xs text-muted-foreground" tickLine={false} axisLine={{ stroke: "transparent" }} />
                        <YAxis className="text-xs text-muted-foreground" tickLine={false} axisLine={{ stroke: "transparent" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "12px",
                            color: "hsl(var(--foreground))",
                          }}
                          formatter={(value: number) => costValueFormatter.format(value)}
                        />
                        <Line type="monotone" dataKey="amount" stroke="hsl(var(--azure))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No cost data available for this period.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {serviceTiles.map((tile) => (
            <div
              key={tile.key}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg transition-transform duration-300 hover:-translate-y-1"
            >
              <span className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tile.accent}`} />
              <div className="relative flex items-center justify-between">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-muted-foreground">
                    <span>{tile.code}</span>
                    <span className="h-px w-8 bg-white/20" />
                    <span>Live</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-semibold text-foreground">{tile.value}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{tile.meta}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-azure shadow-inner">
                  <tile.icon className="h-6 w-6" />
                </div>
              </div>
              <p className="relative mt-4 text-sm font-medium text-foreground">{tile.title}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Cost by service</CardTitle>
                <p className="text-xs text-muted-foreground">Azure services ranked by spend ({selectedCostWindow?.label ?? "window"})</p>
              </div>
              <Badge variant="outline" className="border-white/20 bg-white/5 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Live data
              </Badge>
            </CardHeader>
            <CardContent className="h-[320px] w-full">
              {selectedCostWindow?.byService && selectedCostWindow.byService.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={selectedCostWindow.byService.slice(0, 12)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-white/10" />
                    <XAxis dataKey="service" className="text-xs text-muted-foreground" tickLine={false} axisLine={{ stroke: "transparent" }} />
                    <YAxis className="text-xs text-muted-foreground" tickLine={false} axisLine={{ stroke: "transparent" }} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--azure)/0.08)" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value: number) => costValueFormatter.format(value)}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--azure))" radius={[12, 12, 4, 4]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              ) : overviewQuery.isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading cost breakdown...</div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No cost data available.</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Monitoring & governance</CardTitle>
              <p className="text-xs text-muted-foreground">Alerts, diagnostics, and safety nets</p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Metric alerts</p>
                <p className="mt-2 text-3xl font-semibold">{monitoring ? monitoring.metricAlerts : "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Azure Monitor rules providing live telemetry coverage.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Activity log alerts</p>
                <p className="mt-2 text-3xl font-semibold">{monitoring ? monitoring.activityLogAlerts : "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Policy-driven notifications for control plane activity.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Autoscale settings</p>
                <p className="mt-2 text-3xl font-semibold">{monitoring ? monitoring.autoscaleSettings : "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Guardrails for proactive scaling actions.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[3fr,2fr]">
          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Virtual machine fleet</CardTitle>
              <p className="text-xs text-muted-foreground">
                Safe operations: Start · Restart · Power Off · Deallocate
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead>Name</TableHead>
                    <TableHead>Resource group</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Power state</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {virtualMachinesQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                        Loading Azure virtual machines...
                      </TableCell>
                    </TableRow>
                  ) : vmRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                        No virtual machines discovered for this subscription.
                      </TableCell>
                    </TableRow>
                  ) : (
                    vmRows.slice(0, 40).map((vm) => (
                      <TableRow key={vm.id} className="border-white/5">
                        <TableCell className="font-medium text-foreground">{vm.name}</TableCell>
                        <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">{vm.resourceGroup}</TableCell>
                        <TableCell className="text-muted-foreground">{vm.location}</TableCell>
                        <TableCell className="text-muted-foreground">{vm.size ?? "—"}</TableCell>
                        <TableCell>
                          <Badge className="bg-azure/20 text-azure">
                            {describePowerState(vm.powerState)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{vm.osType ?? "—"}</TableCell>
                        <TableCell className="space-x-2 text-right">
                          <Badge
                            variant="outline"
                            className="cursor-pointer border-white/20 bg-white/5 px-2 py-1 text-xs text-muted-foreground hover:bg-azure/20 hover:text-azure"
                            onClick={() => handleVmAction(vm, "start")}
                            aria-disabled={vmAction.isPending}
                          >
                            Start
                          </Badge>
                          <Badge
                            variant="outline"
                            className="cursor-pointer border-white/20 bg-white/5 px-2 py-1 text-xs text-muted-foreground hover:bg-azure/20 hover:text-azure"
                            onClick={() => handleVmAction(vm, "restart")}
                            aria-disabled={vmAction.isPending}
                          >
                            Restart
                          </Badge>
                          <Badge
                            variant="outline"
                            className="cursor-pointer border-white/20 bg-white/5 px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                            onClick={() => handleVmAction(vm, "poweroff")}
                            aria-disabled={vmAction.isPending}
                          >
                            Power Off
                          </Badge>
                          <Badge
                            variant="outline"
                            className="cursor-pointer border-white/20 bg-white/5 px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                            onClick={() => handleVmAction(vm, "deallocate")}
                            aria-disabled={vmAction.isPending}
                          >
                            Deallocate
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Storage accounts</CardTitle>
                <p className="text-xs text-muted-foreground">Configuration visibility without data-plane access</p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {storage?.accounts.slice(0, 5).map((account) => (
                  <div key={account.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{account.name}</p>
                        <p className="text-xs text-muted-foreground">{account.location}</p>
                      </div>
                      <Badge variant="outline" className="border-white/15 bg-white/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        {account.kind ?? "General"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{account.sku ?? "SKU N/A"}</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                      <span>{account.accessTier ?? "Tier N/A"}</span>
                    </div>
                  </div>
                )) ?? <p className="text-xs text-muted-foreground">No storage accounts detected.</p>}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Top Azure tags</CardTitle>
                <p className="text-xs text-muted-foreground">Categorise and filter resources effortlessly</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {inventory?.topTags.length ? (
                  inventory.topTags.map((tag) => (
                    <div key={tag.key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
                      <span className="text-sm font-medium text-foreground">{tag.key}</span>
                      <Badge variant="outline" className="border-white/15 bg-white/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        {tag.count} resources
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No tag metadata available.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Database estate</CardTitle>
              <p className="text-xs text-muted-foreground">SQL Server, PostgreSQL, and MySQL insight</p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Azure SQL</h4>
                {databases?.sqlServers.length ? (
                  <ul className="mt-3 space-y-2">
                    {databases.sqlServers.slice(0, 4).map((server) => (
                      <li key={server.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{server.name}</p>
                          <p className="text-xs text-muted-foreground">{server.location} · {server.version ?? "Version N/A"}</p>
                        </div>
                        <Badge variant="outline" className="border-white/15 bg-white/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                          {server.databases.length} DBs
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No Azure SQL servers detected.</p>
                )}
              </div>

              <Separator className="bg-white/5" />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">PostgreSQL</h4>
                  {databases?.postgresServers.length ? (
                    <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                      {databases.postgresServers.slice(0, 4).map((server) => (
                        <li key={server.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                          <span className="font-medium text-foreground">{server.name}</span>
                          <span className="ml-2">{server.location}</span>
                          <span className="ml-2">{server.state ?? "Unknown"}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No PostgreSQL flexible servers detected.</p>
                  )}
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">MySQL</h4>
                  {databases?.mysqlServers.length ? (
                    <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                      {databases.mysqlServers.slice(0, 4).map((server) => (
                        <li key={server.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                          <span className="font-medium text-foreground">{server.name}</span>
                          <span className="ml-2">{server.location}</span>
                          <span className="ml-2">{server.state ?? "Unknown"}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No MySQL flexible servers detected.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Policy-aligned capabilities</CardTitle>
              <p className="text-xs text-muted-foreground">Exactly what this Azure dashboard can do for you</p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {categoryPolicies.map((category) => (
                <div key={category.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-azure/15 text-azure">
                    <category.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{category.title}</p>
                    <p className="text-xs text-muted-foreground">{category.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[3fr,2fr]">
          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Networking snapshot</CardTitle>
              <p className="text-xs text-muted-foreground">Virtual networks, load balancers, and public IP footprint</p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Virtual networks</p>
                <p className="mt-2 text-3xl font-semibold">{networking ? networking.virtualNetworks.length : "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Address spaces and subnets across {networkRegionCount} regions.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Load balancers</p>
                  <p className="mt-2 text-2xl font-semibold">{networking ? networking.loadBalancers.length : "—"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Frontend IPs and backend pools in scope.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Public IPs</p>
                  <p className="mt-2 text-2xl font-semibold">{networking ? networking.publicIps.length : "—"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Allocation mix across services.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Resource inventory spotlight</CardTitle>
              <p className="text-xs text-muted-foreground">Top resource types discovered in the subscription</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {inventory?.resources.length ? (
                inventory.resources.slice(0, 8).map((resource) => (
                  <div key={resource.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{resource.name}</span>
                      <span className="text-xs text-muted-foreground">{resource.type}</span>
                    </div>
                    <Badge variant="outline" className="border-white/15 bg-white/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {resource.location}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No resource inventory available.</p>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default AzurePage;
