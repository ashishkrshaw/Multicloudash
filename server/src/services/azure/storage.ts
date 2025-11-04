import { getStorageClient } from "../../azure/config.js";
import { formatAzureRegion } from "../../azure/utils.js";

export interface AzureStorageAccountSummary {
  id: string;
  name: string;
  location: string;
  kind: string | undefined;
  sku: string | undefined;
  accessTier: string | undefined;
  tags: Record<string, string> | undefined;
}

export const listStorageAccounts = async (userId?: string): Promise<AzureStorageAccountSummary[]> => {
  const client = await getStorageClient(userId);
  const accounts: AzureStorageAccountSummary[] = [];

  for await (const account of client.storageAccounts.list()) {
    accounts.push({
      id: account.id ?? "",
      name: account.name ?? "unknown",
      location: formatAzureRegion(account.location),
      kind: account.kind,
      sku: account.sku?.name,
      accessTier: account.accessTier,
      tags: account.tags,
    });
  }

  return accounts;
};
