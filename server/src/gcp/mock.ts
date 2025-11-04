import type { GcpOverviewResponse } from "../services/gcp/types.js";

const nowIso = () => new Date().toISOString();

export const mockGcpOverview = (): GcpOverviewResponse => ({
  isMock: true,
  projectId: null,
  fetchedAt: nowIso(),
  compute: {
    instances: [
      {
        id: "projects/mock-project/zones/us-central1-a/instances/ml-compute-engine",
        name: "ml-compute-engine",
        zone: "us-central1-a",
        region: "us-central1",
        machineType: "n1-standard-4",
        status: "running",
        cpuUtilization: 0.95,
        internalIp: "10.120.0.15",
        externalIp: "34.120.65.21",
        lastStartTimestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        monthlyCostEstimate: 420,
        labels: { workload: "ml" },
      },
      {
        id: "projects/mock-project/zones/europe-west1-b/instances/dev-compute-01",
        name: "dev-compute-01",
        zone: "europe-west1-b",
        region: "europe-west1",
        machineType: "n1-standard-2",
        status: "running",
        cpuUtilization: 0.54,
        internalIp: "10.48.0.9",
        externalIp: "35.187.42.120",
        lastStartTimestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        monthlyCostEstimate: 190,
        labels: { workload: "dev" },
      },
      {
        id: "projects/mock-project/zones/us-central1-b/instances/api-backend-compute",
        name: "api-backend-compute",
        zone: "us-central1-b",
        region: "us-central1",
        machineType: "n1-standard-2",
        status: "running",
        cpuUtilization: 0.68,
        internalIp: "10.128.0.11",
        externalIp: "34.132.77.18",
        lastStartTimestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        monthlyCostEstimate: 180,
        labels: { workload: "api" },
      },
      {
        id: "projects/mock-project/zones/asia-southeast1-a/instances/batch-processing",
        name: "batch-processing",
        zone: "asia-southeast1-a",
        region: "asia-southeast1",
        machineType: "n1-highcpu-4",
        status: "stopped",
        cpuUtilization: 0,
        internalIp: "10.140.0.6",
        monthlyCostEstimate: 0,
        labels: { workload: "batch" },
      },
    ],
    totals: {
      total: 4,
      running: 3,
      stopped: 1,
      terminated: 0,
    },
  },
  storage: {
    buckets: [
      {
        id: "projects/mock-project/buckets/production-assets",
        name: "production-assets",
        location: "us-central1",
        storageClass: "STANDARD",
        sizeGb: 189,
        createdAt: new Date(Date.now() - 320 * 24 * 60 * 60 * 1000).toISOString(),
        labels: { environment: "prod" },
      },
      {
        id: "projects/mock-project/buckets/cold-backup-storage",
        name: "cold-backup-storage",
        location: "us",
        storageClass: "COLDLINE",
        sizeGb: 850,
        createdAt: new Date(Date.now() - 620 * 24 * 60 * 60 * 1000).toISOString(),
        labels: { environment: "prod" },
      },
      {
        id: "projects/mock-project/buckets/cdn-cache-storage",
        name: "cdn-cache-storage",
        location: "europe-west1",
        storageClass: "STANDARD",
        sizeGb: 54,
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        labels: { environment: "edge" },
      },
    ],
    totals: {
      bucketCount: 3,
      storageGb: 189 + 850 + 54,
    },
  },
  sql: {
    instances: [
      {
        id: "projects/mock-project/instances/prod-mysql-primary",
        name: "prod-mysql-primary",
        region: "us-central1",
        databaseVersion: "MYSQL_8_0",
        instanceType: "db-n1-standard-2",
        state: "RUNNABLE",
        storageSizeGb: 100,
      },
      {
        id: "projects/mock-project/instances/analytics-postgres",
        name: "analytics-postgres",
        region: "us-central1",
        databaseVersion: "POSTGRES_14",
        instanceType: "db-custom-2-8192",
        state: "RUNNABLE",
        storageSizeGb: 50,
      },
    ],
    totals: {
      total: 2,
      running: 2,
    },
  },
  cost: {
    isMock: true,
    currency: "USD",
    total: 900,
    changePercentage: -0.02,
    byService: [
      { service: "Compute Engine", amount: 420 },
      { service: "Cloud Storage", amount: 150 },
      { service: "Cloud SQL", amount: 220 },
      { service: "Cloud Functions", amount: 65 },
      { service: "Cloud Run", amount: 45 },
    ],
    daily: Array.from({ length: 30 }).map((_, index) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - (29 - index));
      return {
        date: date.toISOString().slice(0, 10),
        amount: Math.round(20 + Math.random() * 10) * 10,
      };
    }),
  },
  services: [
    { service: "compute.googleapis.com", status: "enabled" },
    { service: "storage.googleapis.com", status: "enabled" },
    { service: "sqladmin.googleapis.com", status: "enabled" },
    { service: "run.googleapis.com", status: "enabled" },
    { service: "cloudfunctions.googleapis.com", status: "enabled" },
  ],
  alerts: [
    {
      type: "compute",
      message: "ml-compute-engine is above 90% CPU utilisation. Consider resizing or migrating to spot instances.",
      severity: "warning",
    },
    {
      type: "storage",
      message: "cold-backup-storage grew 18% in the past 30 days.",
      severity: "info",
    },
  ],
  errors: [],
});
