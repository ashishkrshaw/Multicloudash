import { google } from "googleapis";
import type { compute_v1, sql_v1beta4, storage_v1 } from "googleapis";
import type { OAuth2Client, JWT, Compute, UserRefreshClient, BaseExternalAccountClient } from "google-auth-library";
import { createGoogleAuth, getBillingAccountId, hasGcpCredentials, resolveProjectId } from "../../gcp/config.js";
import type {
  GcpAlertInsight,
  GcpComputeInstance,
  GcpComputeSummary,
  GcpCostBreakdown,
  GcpOverviewResponse,
  GcpSqlInstance,
  GcpSqlSummary,
  GcpStorageBucket,
  GcpStorageSummary,
  GcpServiceUsageSnapshot,
} from "./types.js";
import { fetchGcpCostAnalytics } from "./reports.js";

const parseNameFromUri = (uri: string | undefined | null) => {
  if (!uri) return null;
  const segments = uri.split("/");
  return segments.at(-1) ?? null;
};

const toRegionFromZone = (zone: string | null) => {
  if (!zone) return "unknown";
  const parts = zone.split("-");
  if (parts.length < 2) return zone;
  return parts.slice(0, parts.length - 1).join("-");
};

const mapInstanceStatus = (status: string | undefined | null): GcpComputeInstance["status"] => {
  switch (status) {
    case "RUNNING":
      return "running";
    case "TERMINATED":
      return "terminated";
    case "STOPPING":
    case "SUSPENDED":
      return "stopped";
    case "PROVISIONING":
    case "STAGING":
      return "provisioning";
    default:
      return "unknown";
  }
};

type GoogleAuthClient = OAuth2Client | JWT | Compute | UserRefreshClient | BaseExternalAccountClient;

const fetchComputeSummary = async (authClient: GoogleAuthClient | undefined, projectId: string): Promise<GcpComputeSummary> => {
  const compute = google.compute({ version: "v1", auth: authClient as any });
  const response = await compute.instances.aggregatedList({ project: projectId });
  const aggregated = (response.data.items ?? {}) as Record<string, compute_v1.Schema$InstancesScopedList>;
  const instances: GcpComputeInstance[] = [];

  for (const scoped of Object.values(aggregated)) {
    const scopedInstances = scoped?.instances ?? [];
    for (const instance of scopedInstances) {
      const zoneName = parseNameFromUri(instance.zone) ?? "unknown";
      const machineType = parseNameFromUri(instance.machineType);
      const networkInterface = instance.networkInterfaces?.[0];
      const externalAccess = networkInterface?.accessConfigs?.[0];

      instances.push({
        id: instance.selfLink ?? `${projectId}/${zoneName}/${instance.name ?? "instance"}`,
        resourceId: instance.id ?? undefined,
        name: instance.name ?? "unknown-instance",
        zone: zoneName,
        region: toRegionFromZone(zoneName),
        machineType: machineType ?? null,
        status: mapInstanceStatus(instance.status),
        internalIp: networkInterface?.networkIP ?? undefined,
        externalIp: externalAccess?.natIP ?? undefined,
        labels: instance.labels ?? undefined,
        lastStartTimestamp: instance.lastStartTimestamp ?? undefined,
        cpuUtilization: null,
        monthlyCostEstimate: null,
      });
    }
  }

  const totals = instances.reduce(
    (acc, instance) => {
      acc.total += 1;
      if (instance.status === "running") acc.running += 1;
      if (instance.status === "stopped" || instance.status === "suspended") acc.stopped += 1;
      if (instance.status === "terminated") acc.terminated += 1;
      return acc;
    },
    { total: 0, running: 0, stopped: 0, terminated: 0 },
  );

  return { instances, totals };
};

const fetchStorageSummary = async (authClient: GoogleAuthClient | undefined, projectId: string): Promise<GcpStorageSummary> => {
  const storage = google.storage({ version: "v1", auth: authClient as any });
  const response = await storage.buckets.list({ project: projectId });
  const buckets: GcpStorageBucket[] = (response.data.items ?? []).map((bucket: storage_v1.Schema$Bucket) => ({
    id: bucket.id ?? bucket.selfLink ?? `${projectId}/buckets/${bucket.name}`,
    name: bucket.name ?? "unknown-bucket",
    location: bucket.location ?? "global",
    storageClass: bucket.storageClass ?? undefined,
    createdAt: bucket.timeCreated ?? undefined,
    sizeGb: bucket.metageneration ? null : null,
    versioning: bucket.versioning?.enabled ?? false,
    labels: bucket.labels ?? undefined,
  }));

  return {
    buckets,
    totals: {
      bucketCount: buckets.length,
      storageGb: null,
    },
  };
};

const fetchSqlSummary = async (authClient: GoogleAuthClient | undefined, projectId: string): Promise<GcpSqlSummary> => {
  const sql = google.sqladmin({ version: "v1beta4", auth: authClient as any });
  const response = await sql.instances.list({ project: projectId });
  const instances: GcpSqlInstance[] = (response.data.items ?? []).map((instance: sql_v1beta4.Schema$DatabaseInstance) => ({
    id: instance.connectionName ?? `${projectId}/${instance.name}`,
    name: instance.name ?? "unknown-instance",
    region: instance.region ?? "unknown",
    databaseVersion: instance.databaseVersion ?? undefined,
    instanceType: instance.settings?.tier ?? undefined,
    state: instance.state ?? undefined,
  storageSizeGb: instance.settings?.dataDiskSizeGb ? Number(instance.settings.dataDiskSizeGb) : null,
    failoverReplica: instance.failoverReplica?.name ?? null,
  }));

  const totals = instances.reduce(
    (acc, instance) => {
      acc.total += 1;
      if ((instance.state ?? "").toUpperCase() === "RUNNABLE") {
        acc.running += 1;
      }
      return acc;
    },
    { total: 0, running: 0 },
  );

  return { instances, totals };
};

const fetchEnabledServices = async (authClient: GoogleAuthClient | undefined, projectId: string): Promise<GcpServiceUsageSnapshot[]> => {
  const serviceUsage = google.serviceusage({ version: "v1", auth: authClient as any });
  const response = await serviceUsage.services.list({
    parent: `projects/${projectId}`,
    filter: "state:ENABLED",
  });

  const services = response.data.services ?? [];
  return services.slice(0, 30).map((service) => ({
    service: service.name ?? "unknown",
    status: service.state === "ENABLED" ? "enabled" : service.state === "DISABLED" ? "disabled" : "unknown",
  }));
};

const deriveAlerts = (compute: GcpComputeSummary, storage: GcpStorageSummary, cost: GcpCostBreakdown): GcpAlertInsight[] => {
  const alerts: GcpAlertInsight[] = [];
  const highCpu = compute.instances.find((instance) => (instance.cpuUtilization ?? 0) > 0.85);
  if (highCpu) {
    alerts.push({
      type: "compute",
      message: `${highCpu.name} is reporting sustained CPU pressure. Consider resizing, scaling out, or migrating workload spikes to spot instances.`,
      severity: "warning",
    });
  }

  if (compute.totals.stopped > 0) {
    alerts.push({
      type: "compute",
      message: `${compute.totals.stopped} compute instances are stopped or suspended. Review schedules to optimise spend.`,
      severity: "info",
    });
  }

  if (storage.totals.storageGb && storage.totals.storageGb > 800) {
    alerts.push({
      type: "storage",
      message: `Storage footprint is ${storage.totals.storageGb.toFixed(0)} GB. Evaluate lifecycle rules for cold data.`,
      severity: "info",
    });
  }

  if (!cost.isMock && cost.changePercentage && cost.changePercentage > 0.05) {
    alerts.push({
      type: "cost",
      message: `GCP spend increased ${(cost.changePercentage * 100).toFixed(1)}% versus the prior period.`,
      severity: "warning",
    });
  }

  return alerts.slice(0, 4);
};

export const getGcpOverview = async (userId?: string): Promise<GcpOverviewResponse> => {
  if (!await hasGcpCredentials(userId)) {
    throw new Error("GCP credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS or add credentials in settings.");
  }

  const auth = await createGoogleAuth(userId);
  let client: GoogleAuthClient | undefined;
  const errors: Array<{ section: string; message: string }> = [];

  try {
    client = (await auth.getClient()) as GoogleAuthClient;
  } catch (error) {
    errors.push({ section: "auth", message: error instanceof Error ? error.message : "Failed to initialise Google auth" });
    throw Object.assign(new Error("Google authentication failed"), { errors });
  }

  const projectId = await resolveProjectId(userId, auth);
  if (!projectId) {
    errors.push({ section: "project", message: "Unable to resolve Google Cloud project id" });
    throw Object.assign(new Error("Unable to resolve Google Cloud project id"), { errors });
  }

  const result: GcpOverviewResponse = {
    isMock: false,
    projectId,
    fetchedAt: new Date().toISOString(),
    compute: { instances: [], totals: { total: 0, running: 0, stopped: 0, terminated: 0 } },
    storage: { buckets: [], totals: { bucketCount: 0, storageGb: null } },
    sql: { instances: [], totals: { total: 0, running: 0 } },
    cost: { isMock: false, currency: "USD", total: 0, changePercentage: null, byService: [], daily: [] },
    services: [],
    alerts: [],
    errors,
  };

  try {
    result.compute = await fetchComputeSummary(client, projectId);
  } catch (error) {
    errors.push({ section: "compute", message: error instanceof Error ? error.message : "Failed to list compute instances" });
  }

  try {
    result.storage = await fetchStorageSummary(client, projectId);
  } catch (error) {
    errors.push({ section: "storage", message: error instanceof Error ? error.message : "Failed to list storage buckets" });
  }

  try {
    result.sql = await fetchSqlSummary(client, projectId);
  } catch (error) {
    errors.push({ section: "sql", message: error instanceof Error ? error.message : "Failed to list Cloud SQL instances" });
  }

  try {
    result.services = await fetchEnabledServices(client, projectId);
  } catch (error) {
    errors.push({ section: "services", message: error instanceof Error ? error.message : "Failed to list enabled services" });
    result.services = [];
  }

  const billingAccountId = getBillingAccountId();
  if (!billingAccountId) {
    errors.push({ section: "cost", message: "Set GCP_BILLING_ACCOUNT_ID to enable real cost metrics." });
  } else {
    try {
      result.cost = await fetchGcpCostAnalytics({ authClient: client, projectId, billingAccountId });
    } catch (error) {
      errors.push({ section: "cost", message: error instanceof Error ? error.message : "Failed to load cost data" });
    }
  }

  result.alerts = deriveAlerts(result.compute, result.storage, result.cost);

  return result;
};
