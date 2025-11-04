import { useCallback, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { ResourceTable } from "@/components/dashboard/ResourceTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAwsCostSummary } from "@/hooks/use-aws-cost-summary";
import { useAwsEc2Instances } from "@/hooks/use-aws-ec2";
import { useAwsS3Buckets } from "@/hooks/use-aws-s3";
import {
  useAwsApiGateways,
  useAwsBillingOverview,
  useAwsCloudFrontDistributions,
  useAwsCloudTrails,
  useAwsCloudWatchAlarms,
  useAwsDynamoTables,
  useAwsLambdaFunctions,
  useAwsRoute53Zones,
  useAwsRdsInstances,
  useAwsVpcs,
} from "@/hooks/use-aws-services";
import {
  SiAmazonapigateway,
  SiAmazoncloudwatch,
  SiAmazon,
  SiAmazonrds,
  SiAmazondynamodb,
  SiAmazonec2,
  SiAmazons3,
  SiAwslambda,
} from "react-icons/si";
import { FiGlobe, FiLayers, FiShield, FiTrendingUp } from "react-icons/fi";
import { AlertTriangle, DollarSign } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrency } from "@/context/CurrencyContext";

type CostWindowOption = "MONTH_TO_DATE" | "LAST_30_DAYS" | "LAST_90_DAYS" | "PREVIOUS_MONTH";

const COST_WINDOW_SELECT_OPTIONS: Array<{ value: CostWindowOption; label: string; description: string }> = [
  {
    value: "MONTH_TO_DATE",
    label: "Month to date",
    description: "From the first day of this month through today",
  },
  {
    value: "LAST_30_DAYS",
    label: "Last 30 days",
    description: "Rolling 30-day window ending today",
  },
  {
    value: "LAST_90_DAYS",
    label: "Last 90 days",
    description: "Rolling 90-day window ending today",
  },
  {
    value: "PREVIOUS_MONTH",
    label: "Previous month",
    description: "Complete prior calendar month",
  },
];

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const formatMonthYear = (date: Date) => monthFormatter.format(date);

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const AwsPage = () => {
  const { format: formatCurrency, convert, currency: selectedCurrency } = useCurrency();
  const [costWindow, setCostWindow] = useState<CostWindowOption>("MONTH_TO_DATE");

  const costWindowMeta = useMemo(() => {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    switch (costWindow) {
      case "LAST_30_DAYS": {
        const start = new Date(todayUtc);
        start.setUTCDate(start.getUTCDate() - 29);
        return {
          option: costWindow,
          rangeLabel: "Last 30 days",
          heroLabel: "Spend · last 30 days",
          helper: "Rolling 30-day window ending today",
          comparisonLabel: "prior day",
          allowComparison: true,
          query: {
            start: toIsoDate(start),
            end: toIsoDate(todayUtc),
            granularity: "DAILY" as const,
          },
        };
      }
      case "LAST_90_DAYS": {
        const start = new Date(todayUtc);
        start.setUTCDate(start.getUTCDate() - 89);
        return {
          option: costWindow,
          rangeLabel: "Last 90 days",
          heroLabel: "Spend · last 90 days",
          helper: "Rolling 90-day window ending today",
          comparisonLabel: "prior day",
          allowComparison: true,
          query: {
            start: toIsoDate(start),
            end: toIsoDate(todayUtc),
            granularity: "DAILY" as const,
          },
        };
      }
      case "PREVIOUS_MONTH": {
        const start = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() - 1, 1));
        const end = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 0));
        return {
          option: costWindow,
          rangeLabel: "Previous month",
          heroLabel: `Spend · ${formatMonthYear(start)}`,
          helper: `Complete ${formatMonthYear(start)}`,
          comparisonLabel: "prior month",
          allowComparison: false,
          query: {
            start: toIsoDate(start),
            end: toIsoDate(end),
            granularity: "MONTHLY" as const,
          },
        };
      }
      case "MONTH_TO_DATE":
      default: {
        const start = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 1));
        return {
          option: "MONTH_TO_DATE" as CostWindowOption,
          rangeLabel: "Month to date",
          heroLabel: `Spend · ${formatMonthYear(todayUtc)}`,
          helper: `${formatMonthYear(todayUtc)} through today`,
          comparisonLabel: "prior day",
          allowComparison: true,
          query: {
            start: toIsoDate(start),
            end: toIsoDate(todayUtc),
            granularity: "DAILY" as const,
          },
        };
      }
    }
  }, [costWindow]);

  const awsCostSummary = useAwsCostSummary(costWindowMeta.query);
  const {
    instances,
    isLoading: isEc2Loading,
    isError: isEc2Error,
    error: ec2Error,
  } = useAwsEc2Instances();
  const s3BucketsQuery = useAwsS3Buckets();
  const billingOverviewQuery = useAwsBillingOverview();
  const route53ZonesQuery = useAwsRoute53Zones();
  const apiGatewaysQuery = useAwsApiGateways();
  const vpcsQuery = useAwsVpcs();
  const cloudFrontQuery = useAwsCloudFrontDistributions();
  const cloudWatchQuery = useAwsCloudWatchAlarms();
  const cloudTrailQuery = useAwsCloudTrails();
  const lambdaFunctionsQuery = useAwsLambdaFunctions();
  const dynamoTablesQuery = useAwsDynamoTables();
  const rdsInstancesQuery = useAwsRdsInstances();

  const costSummaryError = awsCostSummary.isError
    ? getErrorMessage(awsCostSummary.error, "Cost Explorer data unavailable. Check IAM permissions or region availability.")
    : null;
  const billingOverviewError = billingOverviewQuery.isError
    ? getErrorMessage(billingOverviewQuery.error, "Billing overview unavailable. Try refreshing credentials.")
    : null;

  const awsCurrency = awsCostSummary.data?.total.currency ?? "USD";

  const billingCurrency = billingOverviewQuery.data?.monthToDate.currency ?? awsCurrency;

  const formatAmount = useCallback(
    (amount: number | null | undefined, baseCurrency?: string, maximumFractionDigits?: number) =>
      formatCurrency(amount ?? null, { from: baseCurrency, maximumFractionDigits }),
    [formatCurrency],
  );

  const timeSeries = awsCostSummary.data?.timeSeries ?? [];
  const latestPeriod = timeSeries.at(-1);
  const previousPeriod = timeSeries.length > 1 ? timeSeries.at(-2) : undefined;

  const totalCostAmount = awsCostSummary.data?.total.amount;
  const costDisplay = awsCostSummary.isLoading
    ? "Loading..."
    : costSummaryError
      ? "Unavailable"
      : formatAmount(totalCostAmount, awsCurrency);

  const costChange = useMemo(() => {
    if (costSummaryError) {
      return costSummaryError;
    }
    if (!costWindowMeta.allowComparison) {
      return "Comparison unavailable for this window";
    }
    if (awsCostSummary.isLoading) {
      return "Loading...";
    }
    if (!latestPeriod || !previousPeriod || !Number.isFinite(previousPeriod.amount) || previousPeriod.amount === 0) {
      return `Awaiting ${costWindowMeta.comparisonLabel}`;
    }
    const delta = ((latestPeriod.amount - previousPeriod.amount) / previousPeriod.amount) * 100;
    if (!Number.isFinite(delta)) {
      return `Awaiting ${costWindowMeta.comparisonLabel}`;
    }
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)}% vs ${costWindowMeta.comparisonLabel}`;
  }, [
    awsCostSummary.isLoading,
    costSummaryError,
    costWindowMeta.allowComparison,
    costWindowMeta.comparisonLabel,
    latestPeriod,
    previousPeriod,
  ]);

  const trend = useMemo<"up" | "down" | "neutral">(() => {
    if (costSummaryError || !costWindowMeta.allowComparison) {
      return "neutral";
    }
    if (!latestPeriod || !previousPeriod || !Number.isFinite(previousPeriod.amount) || previousPeriod.amount === 0) {
      return "neutral";
    }
    const delta = ((latestPeriod.amount - previousPeriod.amount) / previousPeriod.amount) * 100;
    if (!Number.isFinite(delta)) {
      return "neutral";
    }
    if (delta > 1) return "up";
    if (delta < -1) return "down";
    return "neutral";
  }, [costSummaryError, costWindowMeta.allowComparison, latestPeriod, previousPeriod]);

  const runningInstances = useMemo(
    () => instances.filter((instance) => instance.state === "running").length,
    [instances],
  );

  const s3Buckets = useMemo(() => s3BucketsQuery.data ?? [], [s3BucketsQuery.data]);
  const route53Zones = useMemo(() => route53ZonesQuery.data ?? [], [route53ZonesQuery.data]);
  const apiGateways = useMemo(() => apiGatewaysQuery.data ?? [], [apiGatewaysQuery.data]);
  const vpcs = useMemo(() => vpcsQuery.data ?? [], [vpcsQuery.data]);
  const cloudFrontDistributions = useMemo(() => cloudFrontQuery.data ?? [], [cloudFrontQuery.data]);
  const cloudWatchAlarms = useMemo(() => cloudWatchQuery.data ?? [], [cloudWatchQuery.data]);
  const cloudTrails = useMemo(() => cloudTrailQuery.data ?? [], [cloudTrailQuery.data]);
  const lambdaFunctions = useMemo(() => lambdaFunctionsQuery.data ?? [], [lambdaFunctionsQuery.data]);
  const dynamoTables = useMemo(() => dynamoTablesQuery.data ?? [], [dynamoTablesQuery.data]);
  const rdsInstances = useMemo(() => rdsInstancesQuery.data ?? [], [rdsInstancesQuery.data]);

  const activeRegions = useMemo(() => {
    const regions = new Set<string>();
    const add = (value: string | null | undefined) => {
      if (value && value !== "unknown" && value !== "global") {
        regions.add(value);
      }
    };
    instances.forEach((instance) => add(instance.region));
    s3Buckets.forEach((bucket) => add(bucket.region));
    apiGateways.forEach((api) => add(api.region));
    vpcs.forEach((vpc) => add(vpc.region));
    cloudWatchAlarms.forEach((alarm) => add(alarm.region));
    lambdaFunctions.forEach((fn) => add(fn.region));
    dynamoTables.forEach((table) => add(table.region));
    rdsInstances.forEach((instance) => add(instance.region));
    return regions.size;
  }, [
    instances,
    s3Buckets,
    apiGateways,
    vpcs,
    cloudWatchAlarms,
    lambdaFunctions,
    dynamoTables,
    rdsInstances,
  ]);

  const totalManagedResources = useMemo(() => {
    return (
      instances.length +
      s3Buckets.length +
      route53Zones.length +
      apiGateways.length +
      vpcs.length +
      cloudFrontDistributions.length +
      cloudWatchAlarms.length +
      cloudTrails.length +
      lambdaFunctions.length +
      dynamoTables.length +
      rdsInstances.length
    );
  }, [
    instances.length,
    s3Buckets.length,
    route53Zones.length,
    apiGateways.length,
    vpcs.length,
    cloudFrontDistributions.length,
    cloudWatchAlarms.length,
    cloudTrails.length,
    lambdaFunctions.length,
    dynamoTables.length,
    rdsInstances.length,
  ]);

  const costByService = useMemo(() => {
    const services = awsCostSummary.data?.topServices ?? [];
    if (services.length === 0) {
      return [] as Array<{ service: string; cost: number; formatted: string }>;
    }
    return services.slice(0, 10).map((service) => {
      const convertedAmount = convert(service.amount ?? null, { from: awsCurrency }) ?? 0;
      return {
        service: service.service,
        cost: Number(convertedAmount.toFixed(2)),
        formatted: formatAmount(service.amount ?? null, awsCurrency),
      };
    });
  }, [awsCostSummary.data, awsCurrency, convert, formatAmount]);

  const rdsMultiAz = useMemo(
    () => rdsInstances.filter((instance) => instance.multiAz).length,
    [rdsInstances],
  );

  const lambdaRuntimeHighlight = useMemo(() => {
    if (lambdaFunctions.length === 0) {
      return null;
    }
    const counts = new Map<string, number>();
    for (const fn of lambdaFunctions) {
      if (!fn.runtime) continue;
      counts.set(fn.runtime, (counts.get(fn.runtime) ?? 0) + 1);
    }
    let topRuntime: string | null = null;
    let topCount = 0;
    for (const [runtime, count] of counts.entries()) {
      if (count > topCount) {
        topCount = count;
        topRuntime = runtime;
      }
    }
    return topRuntime ? `${topCount}× ${topRuntime}` : null;
  }, [lambdaFunctions]);

  const apiGatewayWithApiKeys = useMemo(
    () => apiGateways.filter((api) => api.apiKeySource && api.apiKeySource !== "NONE").length,
    [apiGateways],
  );

  const ec2ErrorMessage = isEc2Error ? getErrorMessage(ec2Error, "Failed to load EC2 instances") : null;
  const s3ErrorMessage = s3BucketsQuery.isError ? getErrorMessage(s3BucketsQuery.error, "Failed to load buckets") : null;
  const route53ErrorMessage = route53ZonesQuery.isError
    ? getErrorMessage(route53ZonesQuery.error, "Failed to load hosted zones")
    : null;
  const apiGatewayErrorMessage = apiGatewaysQuery.isError
    ? getErrorMessage(apiGatewaysQuery.error, "Failed to load APIs")
    : null;
  const vpcErrorMessage = vpcsQuery.isError ? getErrorMessage(vpcsQuery.error, "Failed to load VPCs") : null;
  const cloudFrontErrorMessage = cloudFrontQuery.isError
    ? getErrorMessage(cloudFrontQuery.error, "Failed to load distributions")
    : null;
  const cloudWatchErrorMessage = cloudWatchQuery.isError
    ? getErrorMessage(cloudWatchQuery.error, "Failed to load alarms")
    : null;
  const cloudTrailErrorMessage = cloudTrailQuery.isError
    ? getErrorMessage(cloudTrailQuery.error, "Failed to load trails")
    : null;
  const lambdaErrorMessage = lambdaFunctionsQuery.isError
    ? getErrorMessage(lambdaFunctionsQuery.error, "Failed to load functions")
    : null;
  const dynamoErrorMessage = dynamoTablesQuery.isError
    ? getErrorMessage(dynamoTablesQuery.error, "Failed to load tables")
    : null;
  const rdsErrorMessage = rdsInstancesQuery.isError
    ? getErrorMessage(rdsInstancesQuery.error, "Failed to load instances")
    : null;

  const dataErrorGroups = useMemo(() => {
    const rawEntries: Array<{ source: string; message: string }> = [];

    if (costSummaryError) rawEntries.push({ source: "Cost Explorer summary", message: costSummaryError });
    if (billingOverviewError) rawEntries.push({ source: "Billing overview", message: billingOverviewError });
    if (ec2ErrorMessage) rawEntries.push({ source: "EC2 inventory", message: ec2ErrorMessage });
    if (s3ErrorMessage) rawEntries.push({ source: "S3 buckets", message: s3ErrorMessage });
    if (route53ErrorMessage) rawEntries.push({ source: "Route 53", message: route53ErrorMessage });
    if (apiGatewayErrorMessage) rawEntries.push({ source: "API Gateway", message: apiGatewayErrorMessage });
    if (vpcErrorMessage) rawEntries.push({ source: "VPCs", message: vpcErrorMessage });
    if (cloudFrontErrorMessage) rawEntries.push({ source: "CloudFront", message: cloudFrontErrorMessage });
    if (cloudWatchErrorMessage) rawEntries.push({ source: "CloudWatch", message: cloudWatchErrorMessage });
    if (cloudTrailErrorMessage) rawEntries.push({ source: "CloudTrail", message: cloudTrailErrorMessage });
    if (lambdaErrorMessage) rawEntries.push({ source: "Lambda", message: lambdaErrorMessage });
    if (dynamoErrorMessage) rawEntries.push({ source: "DynamoDB", message: dynamoErrorMessage });
    if (rdsErrorMessage) rawEntries.push({ source: "RDS", message: rdsErrorMessage });

    const grouped = new Map<string, string[]>();
    for (const entry of rawEntries) {
      const current = grouped.get(entry.message) ?? [];
      current.push(entry.source);
      grouped.set(entry.message, current);
    }

    return Array.from(grouped.entries()).map(([message, sources]) => ({ message, sources }));
  }, [
    apiGatewayErrorMessage,
    billingOverviewError,
    cloudFrontErrorMessage,
    cloudTrailErrorMessage,
    cloudWatchErrorMessage,
    costSummaryError,
    dynamoErrorMessage,
    ec2ErrorMessage,
    lambdaErrorMessage,
    rdsErrorMessage,
    route53ErrorMessage,
    s3ErrorMessage,
    vpcErrorMessage,
  ]);

  const hasDataErrors = dataErrorGroups.length > 0;

  const heroStats = [
    {
      label: "Active regions",
      value: activeRegions > 0 ? activeRegions.toString() : "—",
      description: activeRegions > 1 ? `${activeRegions} AWS regions in play` : "Single-region footprint",
    },
    {
      label: costWindowMeta.heroLabel,
      value: costDisplay,
      description: costChange,
    },
    {
      label: "Managed resources",
      value: totalManagedResources.toString(),
      description: `${runningInstances} EC2 running · ${lambdaFunctions.length} Lambda`,
    },
  ];

  const serviceTiles = [
      {
        key: "ec2",
        title: "Elastic Compute Cloud",
        code: "EC2",
        icon: SiAmazonec2,
        value: isEc2Loading ? "—" : isEc2Error ? "Error" : instances.length.toString(),
        meta: isEc2Loading ? "Fetching fleet" : ec2ErrorMessage ?? `${runningInstances} running instances`,
        accent: "from-aws/30 via-aws/10 to-transparent",
      },
      {
        key: "s3",
        title: "Simple Storage Service",
        code: "S3",
        icon: SiAmazons3,
        value: s3BucketsQuery.isLoading ? "—" : s3BucketsQuery.isError ? "Error" : s3Buckets.length.toString(),
        meta: s3BucketsQuery.isLoading
          ? "Discovering buckets"
          : s3ErrorMessage ?? `${new Set(s3Buckets.map((bucket) => bucket.region)).size} regions tallied`,
        accent: "from-emerald-500/40 via-emerald-500/10 to-transparent",
      },
      {
        key: "rds",
        title: "Relational Database Service",
        code: "RDS",
        icon: SiAmazonrds,
        value: rdsInstancesQuery.isLoading ? "—" : rdsInstancesQuery.isError ? "Error" : rdsInstances.length.toString(),
        meta: rdsInstancesQuery.isLoading ? "Checking clusters" : rdsErrorMessage ?? `${rdsMultiAz} Multi-AZ deployments`,
        accent: "from-sky-500/40 via-sky-500/10 to-transparent",
      },
      {
        key: "lambda",
        title: "AWS Lambda",
        code: "Lambda",
        icon: SiAwslambda,
        value: lambdaFunctionsQuery.isLoading
          ? "—"
          : lambdaFunctionsQuery.isError
            ? "Error"
            : lambdaFunctions.length.toString(),
        meta: lambdaFunctionsQuery.isLoading
          ? "Discovering functions"
          : lambdaErrorMessage ?? lambdaRuntimeHighlight ?? "Runtime mix stable",
        accent: "from-orange-500/40 via-orange-500/10 to-transparent",
      },
      {
        key: "apigw",
        title: "API Gateway",
        code: "APIs",
        icon: SiAmazonapigateway,
        value: apiGatewaysQuery.isLoading ? "—" : apiGatewaysQuery.isError ? "Error" : apiGateways.length.toString(),
        meta: apiGatewaysQuery.isLoading
          ? "Scanning deployments"
          : apiGatewayErrorMessage ?? `${apiGatewayWithApiKeys} secured with API keys`,
        accent: "from-rose-500/40 via-rose-500/10 to-transparent",
      },
      {
        key: "dynamodb",
        title: "Amazon DynamoDB",
        code: "DDB",
        icon: SiAmazondynamodb,
        value: dynamoTablesQuery.isLoading ? "—" : dynamoTablesQuery.isError ? "Error" : dynamoTables.length.toString(),
        meta: dynamoTablesQuery.isLoading
          ? "Listing tables"
          : dynamoErrorMessage ?? `${dynamoTables.reduce((sum, table) => sum + (table.itemCount ?? 0), 0)} items tracked`,
        accent: "from-violet-500/40 via-violet-500/10 to-transparent",
      },
      {
        key: "cloudwatch",
        title: "Amazon CloudWatch",
        code: "CW",
        icon: SiAmazoncloudwatch,
        value: cloudWatchQuery.isLoading ? "—" : cloudWatchQuery.isError ? "Error" : cloudWatchAlarms.length.toString(),
        meta: cloudWatchQuery.isLoading
          ? "Loading insights"
          : cloudWatchErrorMessage ?? `${cloudWatchAlarms.filter((alarm) => alarm.state === "ALARM").length} in ALARM state`,
        accent: "from-cyan-500/40 via-cyan-500/10 to-transparent",
      },
      {
        key: "cloudfront",
        title: "Amazon CloudFront",
        code: "CDN",
  icon: SiAmazon,
        value: cloudFrontQuery.isLoading ? "—" : cloudFrontQuery.isError ? "Error" : cloudFrontDistributions.length.toString(),
        meta: cloudFrontQuery.isLoading
          ? "Collecting edges"
          : cloudFrontErrorMessage ?? `${cloudFrontDistributions.filter((distribution) => distribution.enabled).length} enabled`,
        accent: "from-teal-500/40 via-teal-500/10 to-transparent",
      },
    ];

    const operationsInsights = [
      {
        icon: FiTrendingUp,
        title: "Cost trajectory",
        detail: costSummaryError
          ? "Cost Explorer data unavailable"
          : costWindowMeta.allowComparison
            ? trend === "neutral"
              ? `Spend is steady (${costWindowMeta.comparisonLabel})`
              : `Spend trending ${trend === "up" ? "up" : "down"} (${costWindowMeta.comparisonLabel})`
            : "Spend comparison not available for this window",
        meta: costSummaryError ? costSummaryError : costWindowMeta.allowComparison ? costChange : costWindowMeta.helper,
      },
      {
        icon: FiGlobe,
        title: "Region coverage",
        detail: activeRegions > 0 ? `${activeRegions} AWS regions monitored` : "Regions initializing",
        meta: `${instances.length} EC2 · ${lambdaFunctions.length} Lambda · ${s3Buckets.length} S3`,
      },
      {
        icon: FiShield,
        title: "Governance",
        detail: cloudTrails.length > 0 ? `${cloudTrails.length} CloudTrail trails online` : "CloudTrail not configured",
        meta: `${cloudWatchAlarms.length} CloudWatch alarms · ${apiGateways.length} APIs`,
      },
      {
        icon: FiLayers,
        title: "Network posture",
        detail: vpcs.length > 0 ? `${vpcs.length} VPCs discovered` : "No VPCs detected",
        meta: `${route53Zones.length} Route53 zones · ${cloudFrontDistributions.length} CloudFront edges`,
      },
    ];

    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,_rgba(255,153,0,0.08),transparent_60%)]" />
        </div>
        <Header />

        <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 pb-16 pt-10">
          {hasDataErrors && (
            <Alert
              variant="destructive"
              className="flex flex-col gap-3 rounded-3xl border-destructive/40 bg-destructive/10 px-6 py-5 text-sm text-destructive-foreground shadow-lg backdrop-blur"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/20">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <AlertTitle className="text-base font-semibold">Some AWS data failed to load</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 space-y-1">
                      {dataErrorGroups.map((group) => (
                        <li key={`${group.message}-${group.sources.join("|")}`} className="leading-snug">
                          <span className="font-medium">{group.sources.join(", ")}</span>
                          <span className="ml-1">{group.message}</span>
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
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-aws/5" />
              <CardHeader className="relative pb-2">
                <Badge variant="outline" className="border-aws/60 bg-aws/10 text-[0.7rem] uppercase tracking-[0.3em] text-aws">
                  Amazon Web Services
                </Badge>
                <CardTitle className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
                  Operations Control Center
                </CardTitle>
                <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
                  A focused, multi-region command view designed to be faster and clearer than the native console. Track cost, coverage, and
                  fleet health at a glance.
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
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-aws/20">
                      <DollarSign className="h-5 w-5 text-aws" />
                    </span>
                    Cost Explorer snapshot
                  </CardTitle>
                  <Select value={costWindow} onValueChange={(value) => setCostWindow(value as CostWindowOption)}>
                    <SelectTrigger className="w-full rounded-2xl border-white/15 bg-background/40 text-xs text-foreground shadow-sm backdrop-blur sm:w-[220px]">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-white/10 bg-background/95 text-sm shadow-lg backdrop-blur">
                      {COST_WINDOW_SELECT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="flex flex-col items-start gap-1 rounded-xl text-left text-sm">
                          <span className="font-medium text-foreground">{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Real-time pull from AWS Cost Explorer
                  <span className="block text-[11px] text-muted-foreground/80">{costWindowMeta.helper}</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-2xl border border-white/5 bg-secondary/40 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{costWindowMeta.rangeLabel}</p>
                  <p className="mt-2 text-3xl font-semibold">{costDisplay}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{costChange}</p>
                </div>
                <Separator className="bg-white/5" />
                <ul className="space-y-3">
                  {operationsInsights.slice(0, 2).map((insight) => (
                    <li key={insight.title} className="flex gap-3">
                      <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-aws">
                        <insight.icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{insight.title}</p>
                        <p className="text-xs text-muted-foreground">{insight.meta}</p>
                      </div>
                    </li>
                  ))}
                </ul>
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
                      <p className="text-4xl font-semibold text-foreground">
                        {tile.value}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{tile.meta}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-aws shadow-inner">
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
                  <p className="text-xs text-muted-foreground">Top 10 services by current month spend</p>
                </div>
                <Badge variant="outline" className="border-white/20 bg-white/5 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  Live data
                </Badge>
              </CardHeader>
              <CardContent className="h-[320px] w-full">
                {costByService.length === 0 ? (
                  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                    {awsCostSummary.isLoading
                      ? "Loading cost breakdown..."
                      : costSummaryError ?? "No cost data available for the selected range."}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costByService}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-white/10" />
                      <XAxis dataKey="service" className="text-xs text-muted-foreground" tickLine={false} axisLine={{ stroke: "transparent" }} />
                      <YAxis
                        className="text-xs text-muted-foreground"
                        tickLine={false}
                        axisLine={{ stroke: "transparent" }}
                        width={100}
                        tickFormatter={(value: number) =>
                          formatAmount(
                            Number.isFinite(value) ? Number(value) : null,
                            selectedCurrency,
                            Math.abs(Number(value)) >= 100 ? 0 : 2,
                          )
                        }
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--aws)/0.08)" }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                          color: "hsl(var(--foreground))",
                        }}
                        formatter={(_, __, item) => [item?.payload?.formatted ?? "—", "Spend"]}
                      />
                      <Bar dataKey="cost" fill="hsl(var(--aws))" radius={[12, 12, 4, 4]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Billing & forecast</CardTitle>
                <p className="text-xs text-muted-foreground">Month-to-date billing with Cost Explorer forecast</p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {billingOverviewQuery.isLoading && (
                  <p className="text-muted-foreground">Loading billing overview...</p>
                )}
                {billingOverviewQuery.isError && !billingOverviewQuery.isLoading && (
                  <p className="text-destructive">
                    {billingOverviewError ?? "Failed to load billing overview"}
                  </p>
                )}
                {!billingOverviewQuery.isLoading && !billingOverviewQuery.isError && billingOverviewQuery.data && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Month to date</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {formatAmount(billingOverviewQuery.data.monthToDate.amount, billingCurrency)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Currency · {billingOverviewQuery.data.monthToDate.currency}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Forecast</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {formatAmount(billingOverviewQuery.data.forecast.amount, billingCurrency)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatAmount(billingOverviewQuery.data.forecast.confidence?.p10 ?? 0, billingCurrency)} –
                        {" "}
                        {formatAmount(billingOverviewQuery.data.forecast.confidence?.p90 ?? 0, billingCurrency)} range
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Free tier usage</p>
                      {billingOverviewQuery.data.freeTier.services.length === 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {billingOverviewQuery.data.freeTier.note ?? "No AWS Free Tier usage detected."}
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2 text-xs">
                          {billingOverviewQuery.data.freeTier.services.map((service) => (
                            <li key={service.service} className="flex items-center justify-between">
                              <span className="font-medium text-foreground">{service.service}</span>
                              <span className="text-muted-foreground">
                                {formatAmount(service.amount, billingCurrency)}
                              </span>
                            </li>
                          ))}
                          <li className="flex items-center justify-between border-t border-white/10 pt-2 text-foreground">
                            <span>Total credits</span>
                            <span>{formatAmount(billingOverviewQuery.data.freeTier.totalCredit, billingCurrency)}</span>
                          </li>
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-[3fr,2fr]">
            <ResourceTable />
            <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Operational insights</CardTitle>
                <p className="text-xs text-muted-foreground">Context you can act on immediately</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-5 text-sm">
                  {operationsInsights.map((insight) => (
                    <li key={insight.title} className="flex items-start gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-aws">
                        <insight.icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{insight.title}</p>
                        <p className="text-xs text-muted-foreground">{insight.detail}</p>
                        <p className="mt-2 text-xs text-muted-foreground/80">{insight.meta}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-[3fr,2fr]">
            <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">S3 storage inventory</CardTitle>
                  <p className="text-xs text-muted-foreground">Real-time bucket metadata including region placement</p>
                </div>
                <Badge variant="outline" className="border-white/20 bg-white/5 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  Live inventory
                </Badge>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5">
                      <TableHead className="w-1/3">Bucket</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s3BucketsQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                          Loading buckets...
                        </TableCell>
                      </TableRow>
                    )}
                    {s3BucketsQuery.isError && !s3BucketsQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-destructive">
                          {s3ErrorMessage ?? "Failed to load buckets"}
                        </TableCell>
                      </TableRow>
                    )}
                    {!s3BucketsQuery.isLoading && !s3BucketsQuery.isError && s3Buckets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                          No buckets found in this account.
                        </TableCell>
                      </TableRow>
                    )}
                    {s3Buckets.map((bucket) => (
                      <TableRow key={bucket.name} className="border-white/5">
                        <TableCell className="font-medium text-foreground">{bucket.name}</TableCell>
                        <TableCell className="text-xs uppercase tracking-wider text-muted-foreground">{bucket.region}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {bucket.createdAt ? new Date(bucket.createdAt).toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Network & delivery</CardTitle>
                <p className="text-xs text-muted-foreground">DNS, network perimeter and edge delivery</p>
              </CardHeader>
              <CardContent className="space-y-6 text-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Route 53 hosted zones</h4>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {route53Zones.length}
                    </Badge>
                  </div>
                  {route53ZonesQuery.isLoading ? (
                    <p className="mt-3 text-muted-foreground">Loading hosted zones...</p>
                  ) : route53ZonesQuery.isError ? (
                    <p className="mt-3 text-destructive">{route53ErrorMessage ?? "Failed to load hosted zones"}</p>
                  ) : route53Zones.length === 0 ? (
                    <p className="mt-3 text-muted-foreground">No hosted zones detected.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {route53Zones.slice(0, 5).map((zone) => (
                        <li key={zone.id} className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">{zone.name}</span>
                          <span className="text-xs text-muted-foreground">{zone.recordSetCount} records</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Virtual private clouds</h4>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {vpcs.length}
                    </Badge>
                  </div>
                  {vpcsQuery.isLoading ? (
                    <p className="mt-3 text-muted-foreground">Loading VPC inventory...</p>
                  ) : vpcsQuery.isError ? (
                    <p className="mt-3 text-destructive">{vpcErrorMessage ?? "Failed to load VPCs"}</p>
                  ) : vpcs.length === 0 ? (
                    <p className="mt-3 text-muted-foreground">No VPCs detected.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {vpcs.slice(0, 5).map((vpc) => (
                        <li key={vpc.id} className="flex items-center justify-between gap-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{vpc.name ?? vpc.id}</span>
                            <span className="text-xs text-muted-foreground">
                              {vpc.cidrBlock ?? "—"} · {vpc.isDefault ? "Default" : vpc.state ?? "—"}
                            </span>
                          </div>
                          <Badge variant="outline" className="border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                            {vpc.region}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">CloudFront distributions</h4>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {cloudFrontDistributions.length}
                    </Badge>
                  </div>
                  {cloudFrontQuery.isLoading ? (
                    <p className="mt-3 text-muted-foreground">Loading distributions...</p>
                  ) : cloudFrontQuery.isError ? (
                    <p className="mt-3 text-destructive">{cloudFrontErrorMessage ?? "Failed to load distributions"}</p>
                  ) : cloudFrontDistributions.length === 0 ? (
                    <p className="mt-3 text-muted-foreground">No CloudFront distributions detected.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {cloudFrontDistributions.slice(0, 5).map((distribution) => (
                        <li key={distribution.id} className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">{distribution.domainName}</span>
                          <span className="text-xs text-muted-foreground">
                            {distribution.enabled ? "Enabled" : "Disabled"} · {distribution.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Serverless & APIs</CardTitle>
                <p className="text-xs text-muted-foreground">Lambda runtimes and API Gateway exposure</p>
              </CardHeader>
              <CardContent className="space-y-6 text-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Lambda functions</h4>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {lambdaFunctions.length}
                    </Badge>
                  </div>
                  {lambdaFunctionsQuery.isLoading ? (
                    <p className="mt-3 text-muted-foreground">Loading functions...</p>
                  ) : lambdaFunctionsQuery.isError ? (
                    <p className="mt-3 text-destructive">{lambdaErrorMessage ?? "Failed to load functions"}</p>
                  ) : lambdaFunctions.length === 0 ? (
                    <p className="mt-3 text-muted-foreground">No Lambda functions detected.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {lambdaFunctions.slice(0, 5).map((fn) => (
                        <li key={fn.name} className="flex items-center justify-between gap-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{fn.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {fn.runtime ?? "Runtime unknown"} · {fn.memorySizeMb ?? "—"} MB
                            </span>
                          </div>
                          <Badge variant="outline" className="border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                            {fn.region}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">API Gateway (REST)</h4>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {apiGateways.length}
                    </Badge>
                  </div>
                  {apiGatewaysQuery.isLoading ? (
                    <p className="mt-3 text-muted-foreground">Loading APIs...</p>
                  ) : apiGatewaysQuery.isError ? (
                    <p className="mt-3 text-destructive">{apiGatewayErrorMessage ?? "Failed to load APIs"}</p>
                  ) : apiGateways.length === 0 ? (
                    <p className="mt-3 text-muted-foreground">No REST APIs detected.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {apiGateways.slice(0, 5).map((api) => (
                        <li key={api.id} className="flex items-center justify-between gap-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{api.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {api.apiKeySource && api.apiKeySource !== "NONE" ? "API key required" : "Open"}
                              {api.createdAt ? ` · ${new Date(api.createdAt).toLocaleDateString()}` : ""}
                            </span>
                          </div>
                          <Badge variant="outline" className="border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                            {api.region}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Data stores & observability</CardTitle>
                <p className="text-xs text-muted-foreground">Relational, NoSQL and audit telemetry</p>
              </CardHeader>
              <CardContent className="space-y-6 text-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">DynamoDB tables</h4>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {dynamoTables.length}
                    </Badge>
                  </div>
                  {dynamoTablesQuery.isLoading ? (
                    <p className="mt-3 text-muted-foreground">Loading tables...</p>
                  ) : dynamoTablesQuery.isError ? (
                    <p className="mt-3 text-destructive">{dynamoErrorMessage ?? "Failed to load tables"}</p>
                  ) : dynamoTables.length === 0 ? (
                    <p className="mt-3 text-muted-foreground">No tables detected.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {dynamoTables.slice(0, 5).map((table) => (
                        <li key={table.name} className="flex items-center justify-between gap-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{table.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {table.itemCount ?? 0} items · {table.billingMode ?? "—"}
                            </span>
                          </div>
                          <Badge variant="outline" className="border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                            {table.region}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">RDS instances</h4>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {rdsInstances.length}
                    </Badge>
                  </div>
                  {rdsInstancesQuery.isLoading ? (
                    <p className="mt-3 text-muted-foreground">Loading instances...</p>
                  ) : rdsInstancesQuery.isError ? (
                    <p className="mt-3 text-destructive">{rdsErrorMessage ?? "Failed to load instances"}</p>
                  ) : rdsInstances.length === 0 ? (
                    <p className="mt-3 text-muted-foreground">No RDS instances detected.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {rdsInstances.slice(0, 5).map((instance) => (
                        <li key={instance.identifier} className="flex items-center justify-between gap-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{instance.identifier}</span>
                            <span className="text-xs text-muted-foreground">
                              {instance.engine ?? "Engine unknown"} · {instance.status ?? "Status unknown"}
                            </span>
                          </div>
                          <Badge variant="outline" className="border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                            {instance.region}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">CloudWatch & CloudTrail</h4>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {cloudWatchAlarms.length + cloudTrails.length}
                    </Badge>
                  </div>
                  {cloudWatchQuery.isLoading || cloudTrailQuery.isLoading ? (
                    <p className="mt-3 text-muted-foreground">Loading telemetry...</p>
                  ) : cloudWatchQuery.isError || cloudTrailQuery.isError ? (
                    <p className="mt-3 text-destructive">
                      {cloudWatchQuery.isError
                        ? cloudWatchErrorMessage ?? "Failed to load alarms"
                        : cloudTrailErrorMessage ?? "Failed to load trails"}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {cloudWatchAlarms.slice(0, 3).map((alarm) => (
                        <li key={alarm.name} className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">{alarm.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {alarm.state} · {alarm.region}
                          </span>
                        </li>
                      ))}
                      {cloudTrails.slice(0, 2).map((trail) => (
                        <li key={trail.arn} className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">{trail.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {trail.multiRegion ? "Multi-Region" : trail.homeRegion ?? "Region unknown"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        </main>
    </div>
  );
};

export default AwsPage;
