import { useQuery } from "@tanstack/react-query";

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  // Get auth token from localStorage
  const googleToken = localStorage.getItem('google_id_token');
  const cognitoToken = localStorage.getItem('cognito_id_token');
  const token = googleToken || cognitoToken;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(input, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body.error === "string" ? body.error : response.statusText;
    throw new Error(message || "Failed to load data from AWS API");
  }
  return (await response.json()) as T;
}

export interface BillingOverview {
  monthToDate: { amount: number; currency: string };
  forecast: {
    amount: number;
    currency: string;
    confidence?: { p10?: number; p50?: number; p90?: number };
  };
  freeTier: {
    totalCredit: number;
    currency: string;
    services: Array<{ service: string; amount: number }>;
    note?: string;
  };
}

export function useAwsBillingOverview(enabled: boolean = false) {
  return useQuery<BillingOverview>({
    queryKey: ["aws-billing-overview"],
    queryFn: () => fetchJson<BillingOverview>("/api/aws/billing/overview"),
    staleTime: 1000 * 60 * 10,
    enabled, // Only fetch when enabled
  });
}

export interface Route53HostedZoneSummary {
  id: string;
  name: string;
  recordSetCount: number;
  privateZone: boolean;
}

export function useAwsRoute53Zones(enabled: boolean = false) {
  return useQuery<Route53HostedZoneSummary[]>({
    queryKey: ["aws-route53-hosted-zones"],
    queryFn: async () => {
      const data = await fetchJson<{ zones: Route53HostedZoneSummary[] }>("/api/aws/route53/hosted-zones");
      return data.zones ?? [];
    },
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

export interface ApiGatewaySummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string | null;
  apiKeySource: string | null;
  region: string;
}

export function useAwsApiGateways(enabled: boolean = false) {
  return useQuery<ApiGatewaySummary[]>({
    queryKey: ["aws-apigateway-rest-apis"],
    queryFn: async () => {
      const data = await fetchJson<{ apis: ApiGatewaySummary[] }>("/api/aws/apigateway/rest-apis");
      return data.apis ?? [];
    },
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

export interface VpcSummary {
  id: string;
  name: string | null;
  cidrBlock: string | null;
  state: string | null;
  isDefault: boolean;
  region: string;
}

export function useAwsVpcs(enabled: boolean = false) {
  return useQuery<VpcSummary[]>({
    queryKey: ["aws-vpcs"],
    queryFn: async () => {
      const data = await fetchJson<{ vpcs: VpcSummary[] }>("/api/aws/vpcs");
      return data.vpcs ?? [];
    },
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

export interface CloudFrontDistributionSummary {
  id: string;
  domainName: string;
  status: string;
  enabled: boolean;
  comment: string | null;
}

export function useAwsCloudFrontDistributions(enabled: boolean = false) {
  return useQuery<CloudFrontDistributionSummary[]>({
    queryKey: ["aws-cloudfront-distributions"],
    queryFn: async () => {
      const data = await fetchJson<{ distributions: CloudFrontDistributionSummary[] }>(
        "/api/aws/cloudfront/distributions",
      );
      return data.distributions ?? [];
    },
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

export interface CloudWatchAlarmSummary {
  name: string;
  state: string;
  reason: string | null;
  updatedAt: string | null;
  metricName: string | null;
  namespace: string | null;
  region: string;
}

export function useAwsCloudWatchAlarms(enabled: boolean = false) {
  return useQuery<CloudWatchAlarmSummary[]>({
    queryKey: ["aws-cloudwatch-alarms"],
    queryFn: async () => {
      const data = await fetchJson<{ alarms: CloudWatchAlarmSummary[] }>("/api/aws/cloudwatch/alarms");
      return data.alarms ?? [];
    },
    staleTime: 1000 * 60 * 2,
    enabled,
  });
}

export interface CloudTrailSummary {
  name: string;
  arn: string;
  homeRegion: string | null;
  multiRegion: boolean;
  organizationTrail: boolean;
}

export function useAwsCloudTrails(enabled: boolean = false) {
  return useQuery<CloudTrailSummary[]>({
    queryKey: ["aws-cloudtrail-trails"],
    queryFn: async () => {
      const data = await fetchJson<{ trails: CloudTrailSummary[] }>("/api/aws/cloudtrail/trails");
      return data.trails ?? [];
    },
    staleTime: 1000 * 60 * 10,
    enabled,
  });
}

export interface LambdaFunctionSummary {
  name: string;
  runtime: string | null;
  lastModified: string | null;
  memorySizeMb: number | null;
  timeoutSeconds: number | null;
  version: string | null;
  region: string;
}

export function useAwsLambdaFunctions(enabled: boolean = false) {
  return useQuery<LambdaFunctionSummary[]>({
    queryKey: ["aws-lambda-functions"],
    queryFn: async () => {
      const data = await fetchJson<{ functions: LambdaFunctionSummary[] }>("/api/aws/lambda/functions");
      return data.functions ?? [];
    },
    staleTime: 1000 * 60 * 2,
    enabled,
  });
}

export interface DynamoDbTableSummary {
  name: string;
  status: string | null;
  itemCount: number | null;
  sizeBytes: number | null;
  billingMode: string | null;
  readCapacityUnits: number | null;
  writeCapacityUnits: number | null;
  region: string;
}

export function useAwsDynamoTables(enabled: boolean = false) {
  return useQuery<DynamoDbTableSummary[]>({
    queryKey: ["aws-dynamodb-tables"],
    queryFn: async () => {
      const data = await fetchJson<{ tables: DynamoDbTableSummary[] }>("/api/aws/dynamodb/tables");
      return data.tables ?? [];
    },
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

export interface RdsInstanceSummary {
  identifier: string;
  engine: string | null;
  engineVersion: string | null;
  instanceClass: string | null;
  status: string | null;
  endpoint: string | null;
  allocatedStorageGb: number | null;
  multiAz: boolean;
  region: string;
}

export function useAwsRdsInstances(enabled: boolean = false) {
  return useQuery<RdsInstanceSummary[]>({
    queryKey: ["aws-rds-instances"],
    queryFn: async () => {
      const data = await fetchJson<{ instances: RdsInstanceSummary[] }>("/api/aws/rds/instances");
      return data.instances ?? [];
    },
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}
