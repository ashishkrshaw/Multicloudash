import { useState, useCallback, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { ResourceTable } from "@/components/dashboard/ResourceTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { AlertTriangle, RefreshCw, DollarSign } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuth } from "@/context/AuthContext";

const AwsPageNew = () => {
  const { format: formatCurrency, convert, currency: selectedCurrency } = useCurrency();
  const { isAuthenticated } = useAuth();
  
  // Manual load state
  const [loadCost, setLoadCost] = useState(false);
  const [loadEc2, setLoadEc2] = useState(false);
  const [loadS3, setLoadS3] = useState(false);
  const [loadAllServices, setLoadAllServices] = useState(false);

  // Date range for cost data
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 1));
  const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

  const costQuery = {
    start: toIsoDate(startOfMonth),
    end: toIsoDate(todayUtc),
    granularity: "DAILY" as const,
  };

  // Hooks with enabled parameter
  const awsCostSummary = useAwsCostSummary(costQuery, { enabled: loadCost });
  const {
    instances,
    isLoading: isEc2Loading,
    isError: isEc2Error,
    startInstance,
    stopInstance,
    isStarting,
    isStopping,
    startingInstanceId,
    stoppingInstanceId,
  } = useAwsEc2Instances(loadEc2);
  const s3BucketsQuery = useAwsS3Buckets(loadS3);
  const billingOverviewQuery = useAwsBillingOverview(loadAllServices);
  const route53ZonesQuery = useAwsRoute53Zones(loadAllServices);
  const apiGatewaysQuery = useAwsApiGateways(loadAllServices);
  const vpcsQuery = useAwsVpcs(loadAllServices);
  const cloudFrontQuery = useAwsCloudFrontDistributions(loadAllServices);
  const cloudWatchQuery = useAwsCloudWatchAlarms(loadAllServices);
  const cloudTrailQuery = useAwsCloudTrails(loadAllServices);
  const lambdaFunctionsQuery = useAwsLambdaFunctions(loadAllServices);
  const dynamoTablesQuery = useAwsDynamoTables(loadAllServices);
  const rdsInstancesQuery = useAwsRdsInstances(loadAllServices);

  const handleLoadAll = () => {
    setLoadCost(true);
    setLoadEc2(true);
    setLoadS3(true);
    setLoadAllServices(true);
  };

  const handleResetAll = () => {
    setLoadCost(false);
    setLoadEc2(false);
    setLoadS3(false);
    setLoadAllServices(false);
  };

  const awsCurrency = awsCostSummary.data?.total.currency ?? "USD";
  const billingCurrency = billingOverviewQuery.data?.monthToDate.currency ?? awsCurrency;

  const formatAmount = useCallback(
    (amount: number | null | undefined, baseCurrency?: string, maximumFractionDigits?: number) =>
      formatCurrency(amount ?? null, { from: baseCurrency, maximumFractionDigits }),
    [formatCurrency],
  );

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
    return regions.size;
  }, [instances, s3Buckets, apiGateways, vpcs]);

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

  const costDisplay = awsCostSummary.isLoading
    ? "Loading..."
    : awsCostSummary.isError
      ? "Error"
      : awsCostSummary.data
        ? formatAmount(awsCostSummary.data.total.amount, awsCurrency)
        : "Click Load";

  const serviceTiles = [
    {
      key: "ec2",
      title: "Elastic Compute Cloud",
      code: "EC2",
      icon: SiAmazonec2,
      value: isEc2Loading ? "—" : isEc2Error ? "Error" : loadEc2 ? instances.length.toString() : "—",
      meta: isEc2Loading ? "Fetching fleet" : loadEc2 ? `${runningInstances} running instances` : "Click Load EC2",
      accent: "from-aws/30 via-aws/10 to-transparent",
    },
    {
      key: "s3",
      title: "Simple Storage Service",
      code: "S3",
      icon: SiAmazons3,
      value: s3BucketsQuery.isLoading ? "—" : s3BucketsQuery.isError ? "Error" : loadS3 ? s3Buckets.length.toString() : "—",
      meta: s3BucketsQuery.isLoading
        ? "Discovering buckets"
        : loadS3 ? `${new Set(s3Buckets.map((bucket) => bucket.region)).size} regions` : "Click Load S3",
      accent: "from-emerald-500/40 via-emerald-500/10 to-transparent",
    },
    {
      key: "rds",
      title: "Relational Database Service",
      code: "RDS",
      icon: SiAmazonrds,
      value: rdsInstancesQuery.isLoading ? "—" : rdsInstancesQuery.isError ? "Error" : loadAllServices ? rdsInstances.length.toString() : "—",
      meta: loadAllServices ? `${rdsInstances.filter(i => i.multiAz).length} Multi-AZ` : "Click Load All Services",
      accent: "from-sky-500/40 via-sky-500/10 to-transparent",
    },
    {
      key: "lambda",
      title: "AWS Lambda",
      code: "Lambda",
      icon: SiAwslambda,
      value: lambdaFunctionsQuery.isLoading ? "—" : lambdaFunctionsQuery.isError ? "Error" : loadAllServices ? lambdaFunctions.length.toString() : "—",
      meta: loadAllServices ? "Serverless functions" : "Click Load All Services",
      accent: "from-orange-500/40 via-orange-500/10 to-transparent",
    },
    {
      key: "apigw",
      title: "API Gateway",
      code: "APIs",
      icon: SiAmazonapigateway,
      value: apiGatewaysQuery.isLoading ? "—" : apiGatewaysQuery.isError ? "Error" : loadAllServices ? apiGateways.length.toString() : "—",
      meta: loadAllServices ? "REST APIs" : "Click Load All Services",
      accent: "from-rose-500/40 via-rose-500/10 to-transparent",
    },
    {
      key: "dynamodb",
      title: "Amazon DynamoDB",
      code: "DDB",
      icon: SiAmazondynamodb,
      value: dynamoTablesQuery.isLoading ? "—" : dynamoTablesQuery.isError ? "Error" : loadAllServices ? dynamoTables.length.toString() : "—",
      meta: loadAllServices ? "NoSQL tables" : "Click Load All Services",
      accent: "from-violet-500/40 via-violet-500/10 to-transparent",
    },
    {
      key: "cloudwatch",
      title: "Amazon CloudWatch",
      code: "CW",
      icon: SiAmazoncloudwatch,
      value: cloudWatchQuery.isLoading ? "—" : cloudWatchQuery.isError ? "Error" : loadAllServices ? cloudWatchAlarms.length.toString() : "—",
      meta: loadAllServices ? "Monitoring alarms" : "Click Load All Services",
      accent: "from-cyan-500/40 via-cyan-500/10 to-transparent",
    },
    {
      key: "cloudfront",
      title: "Amazon CloudFront",
      code: "CDN",
      icon: SiAmazon,
      value: cloudFrontQuery.isLoading ? "—" : cloudFrontQuery.isError ? "Error" : loadAllServices ? cloudFrontDistributions.length.toString() : "—",
      meta: loadAllServices ? "CDN distributions" : "Click Load All Services",
      accent: "from-teal-500/40 via-teal-500/10 to-transparent",
    },
  ];

  const operationsInsights = [
    {
      icon: FiTrendingUp,
      title: "Cost trajectory",
      detail: loadCost ? "Month-to-date spend" : "Click Load Cost Explorer to view",
      meta: loadCost ? costDisplay : "Cost data not loaded",
    },
    {
      icon: FiGlobe,
      title: "Region coverage",
      detail: loadEc2 || loadS3 ? `${activeRegions} AWS regions monitored` : "Load data to view regions",
      meta: `${instances.length} EC2 · ${lambdaFunctions.length} Lambda · ${s3Buckets.length} S3`,
    },
    {
      icon: FiShield,
      title: "Governance",
      detail: loadAllServices 
        ? cloudTrails.length > 0 ? `${cloudTrails.length} CloudTrail trails online` : "CloudTrail not configured"
        : "Load services to view",
      meta: `${cloudWatchAlarms.length} alarms · ${apiGateways.length} APIs`,
    },
    {
      icon: FiLayers,
      title: "Network posture",
      detail: loadAllServices 
        ? vpcs.length > 0 ? `${vpcs.length} VPCs discovered` : "No VPCs detected"
        : "Load services to view",
      meta: `${route53Zones.length} Route53 zones · ${cloudFrontDistributions.length} CloudFront`,
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
        {/* Auth Status */}
        {!isAuthenticated && (
          <Alert variant="destructive" className="rounded-3xl border-destructive/40 bg-destructive/10">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Not Signed In</AlertTitle>
            <AlertDescription>
              Please sign in to load your AWS data. Click "My Account" in the header.
            </AlertDescription>
          </Alert>
        )}

        {/* Control Panel */}
        <Card className="rounded-3xl border-white/10 bg-white/5 shadow-xl backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">AWS Data Control Panel</CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  Load data only when needed to avoid unnecessary API calls
                </p>
              </div>
              <Badge variant="outline" className="border-aws/60 bg-aws/10 text-xs uppercase tracking-wider text-aws">
                Manual Load Mode
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button
              onClick={handleLoadAll}
              disabled={!isAuthenticated}
              className="gap-2"
              size="lg"
            >
              <RefreshCw className={`h-4 w-4 ${(loadCost && loadEc2 && loadS3 && loadAllServices) ? "animate-spin" : ""}`} />
              Load All Data
            </Button>
            <Button
              onClick={handleResetAll}
              variant="outline"
              size="lg"
            >
              Reset All
            </Button>
            <Button
              onClick={() => setLoadCost(true)}
              disabled={!isAuthenticated || loadCost}
              variant="secondary"
              className="gap-2"
            >
              <DollarSign className="h-4 w-4" />
              {loadCost ? "✓ Cost Loaded" : "Load Cost Explorer"}
            </Button>
            <Button
              onClick={() => setLoadEc2(true)}
              disabled={!isAuthenticated || loadEc2}
              variant="secondary"
              className="gap-2"
            >
              <SiAmazonec2 className="h-4 w-4" />
              {loadEc2 ? "✓ EC2 Loaded" : "Load EC2"}
            </Button>
            <Button
              onClick={() => setLoadS3(true)}
              disabled={!isAuthenticated || loadS3}
              variant="secondary"
              className="gap-2"
            >
              <SiAmazons3 className="h-4 w-4" />
              {loadS3 ? "✓ S3 Loaded" : "Load S3"}
            </Button>
            <Button
              onClick={() => setLoadAllServices(true)}
              disabled={!isAuthenticated || loadAllServices}
              variant="secondary"
              className="gap-2"
            >
              <SiAwslambda className="h-4 w-4" />
              {loadAllServices ? "✓ Services Loaded" : "Load All Services"}
            </Button>
          </CardContent>
        </Card>

        {/* Hero Section */}
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
              Manual data loading prevents automatic API spam. Click "Load" buttons above to fetch your AWS data.
            </p>
          </CardHeader>
          <CardContent className="relative">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-inner">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Active regions</p>
                <p className="mt-3 text-3xl font-semibold text-foreground md:text-4xl">
                  {activeRegions > 0 ? activeRegions.toString() : "—"}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {loadEc2 || loadS3 ? `${activeRegions} AWS regions in play` : "Load data to view"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-inner">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Spend · month to date</p>
                <p className="mt-3 text-3xl font-semibold text-foreground md:text-4xl">{costDisplay}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {loadCost ? "Live data from Cost Explorer" : "Click 'Load Cost Explorer' to fetch"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-inner">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Managed resources</p>
                <p className="mt-3 text-3xl font-semibold text-foreground md:text-4xl">{totalManagedResources}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {`${runningInstances} EC2 running · ${lambdaFunctions.length} Lambda`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Tiles */}
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

        {/* Cost by Service Chart */}
        {loadCost && (
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
                      : "No cost data available for the selected range."}
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

            {/* Billing & Forecast */}
            <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Billing & forecast</CardTitle>
                <p className="text-xs text-muted-foreground">Month-to-date billing with forecast</p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {billingOverviewQuery.isLoading && (
                  <p className="text-muted-foreground">Loading billing overview...</p>
                )}
                {billingOverviewQuery.isError && !billingOverviewQuery.isLoading && (
                  <p className="text-destructive">Failed to load billing overview</p>
                )}
                {!billingOverviewQuery.isLoading && !billingOverviewQuery.isError && billingOverviewQuery.data && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Month to date</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {formatAmount(billingOverviewQuery.data.monthToDate.amount, billingCurrency)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Forecast</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {formatAmount(billingOverviewQuery.data.forecast.amount, billingCurrency)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Operational Insights */}
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

        {/* EC2 Instances with Start/Stop */}
        {loadEc2 && (
          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-xl backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl">EC2 Instances</CardTitle>
              <p className="text-sm text-muted-foreground">Manage your compute instances</p>
            </CardHeader>
            <CardContent>
              {instances.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No EC2 instances found</p>
              ) : (
                <div className="space-y-3">
                  {instances.map((instance) => (
                    <div
                      key={instance.id}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{instance.name || instance.id}</p>
                        <p className="text-sm text-muted-foreground">
                          {instance.type} · {instance.region} · {instance.availabilityZone}
                        </p>
                        {instance.publicIp && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Public IP: {instance.publicIp}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={instance.state === "running" ? "default" : "secondary"}
                          className="uppercase"
                        >
                          {instance.state}
                        </Badge>
                        {instance.state === "stopped" && (
                          <Button
                            size="sm"
                            onClick={() => startInstance(instance.id, instance.region)}
                            disabled={isStarting && startingInstanceId === instance.id}
                          >
                            {isStarting && startingInstanceId === instance.id ? "Starting..." : "Start"}
                          </Button>
                        )}
                        {instance.state === "running" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => stopInstance(instance.id, instance.region)}
                            disabled={isStopping && stoppingInstanceId === instance.id}
                          >
                            {isStopping && stoppingInstanceId === instance.id ? "Stopping..." : "Stop"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* S3 Buckets */}
        {loadS3 && s3Buckets.length > 0 && (
          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-lg">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">S3 storage inventory</CardTitle>
                <p className="text-xs text-muted-foreground">Real-time bucket metadata</p>
              </div>
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
                  {s3Buckets.slice(0, 10).map((bucket) => (
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
        )}

        {/* Resource Table */}
        {(loadEc2 || loadS3 || loadAllServices) && (
          <ResourceTable />
        )}
      </main>
    </div>
  );
};

export default AwsPageNew;
