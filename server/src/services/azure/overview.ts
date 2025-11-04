import type { AzureCostWindow } from "./cost.js";
import { getAzureCostWindows } from "./cost.js";
import type { AzureVirtualMachine } from "./compute.js";
import { listVirtualMachines } from "./compute.js";
import type { AzureNetworkSummary } from "./network.js";
import { getNetworkSummary } from "./network.js";
import type { AzureStorageAccountSummary } from "./storage.js";
import { listStorageAccounts } from "./storage.js";
import type { AzureDatabaseSummary } from "./databases.js";
import { getDatabaseSummary } from "./databases.js";
import type { AzureMonitoringSummary } from "./monitor.js";
import { getMonitoringSummary } from "./monitor.js";
import type { AzureInventorySummary } from "./inventory.js";
import { getInventorySummary } from "./inventory.js";

export interface AzureOverviewError {
  section: string;
  message: string;
}

export interface AzureOverviewResult {
  cost: AzureCostWindow[] | null;
  compute: { vms: AzureVirtualMachine[]; totals: Record<string, number> } | null;
  networking: AzureNetworkSummary | null;
  storage: { accounts: AzureStorageAccountSummary[] } | null;
  databases: AzureDatabaseSummary | null;
  monitoring: AzureMonitoringSummary | null;
  inventory: AzureInventorySummary | null;
  errors: AzureOverviewError[];
}

export const getAzureOverview = async (userId?: string): Promise<AzureOverviewResult> => {
  const errors: AzureOverviewError[] = [];

  const [cost, compute, networking, storage, databases, monitoring, inventory] = await Promise.all([
    (async () => {
      try {
        return await getAzureCostWindows(userId);
      } catch (error) {
        errors.push({ section: "Cost & Billing", message: (error as Error).message ?? "Failed to load cost data" });
        return null;
      }
    })(),
    (async () => {
      try {
        const vms = await listVirtualMachines(userId);
        const totals = vms.reduce(
          (acc, vm) => {
            acc.total += 1;
            acc[vm.powerState] = (acc[vm.powerState] ?? 0) + 1;
            return acc;
          },
          { total: 0, running: 0, stopped: 0, deallocated: 0, starting: 0, stopping: 0, unknown: 0 } as Record<string, number>,
        );
        return {
          vms: vms.slice(0, 50),
          totals,
        };
      } catch (error) {
        errors.push({ section: "Virtual Machines", message: (error as Error).message ?? "Failed to load virtual machines" });
        return null;
      }
    })(),
    (async () => {
      try {
        return await getNetworkSummary(userId);
      } catch (error) {
        errors.push({ section: "Networking", message: (error as Error).message ?? "Failed to load networking data" });
        return null;
      }
    })(),
    (async () => {
      try {
        const accounts = await listStorageAccounts(userId);
        return { accounts };
      } catch (error) {
        errors.push({ section: "Storage", message: (error as Error).message ?? "Failed to load storage accounts" });
        return null;
      }
    })(),
    (async () => {
      try {
        return await getDatabaseSummary(userId);
      } catch (error) {
        errors.push({ section: "Databases", message: (error as Error).message ?? "Failed to load databases" });
        return null;
      }
    })(),
    (async () => {
      try {
        return await getMonitoringSummary(userId);
      } catch (error) {
        errors.push({ section: "Monitoring", message: (error as Error).message ?? "Failed to load monitoring data" });
        return null;
      }
    })(),
    (async () => {
      try {
        return await getInventorySummary(userId);
      } catch (error) {
        errors.push({ section: "Resource Inventory", message: (error as Error).message ?? "Failed to load resource inventory" });
        return null;
      }
    })(),
  ]);

  return {
    cost,
    compute,
    networking,
    storage,
    databases,
    monitoring,
    inventory,
    errors,
  };
};
