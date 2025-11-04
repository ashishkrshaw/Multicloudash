import { getResourceClient } from "../../azure/config.js";
import { extractNameFromId, extractResourceGroupFromId, formatAzureRegion } from "../../azure/utils.js";

export interface AzureResourceGroupSummary {
  id: string;
  name: string;
  location: string;
  tags: Record<string, string> | undefined;
}

export interface AzureResourceSummary {
  id: string;
  name: string;
  type: string;
  resourceGroup: string;
  location: string;
}

export interface AzureTagSummary {
  key: string;
  count: number;
}

export interface AzureInventorySummary {
  resourceGroups: AzureResourceGroupSummary[];
  resources: AzureResourceSummary[];
  topTags: AzureTagSummary[];
  totalResources: number;
}

export const getInventorySummary = async (userId?: string): Promise<AzureInventorySummary> => {
  const client = await getResourceClient(userId);

  const [resourceGroups, resources, tags] = await Promise.all([
    (async () => {
      const groups: AzureResourceGroupSummary[] = [];
      for await (const group of client.resourceGroups.list()) {
        groups.push({
          id: group.id ?? "",
          name: group.name ?? "unknown",
          location: formatAzureRegion(group.location),
          tags: group.tags,
        });
      }
      return groups;
    })(),
    (async () => {
      const items: AzureResourceSummary[] = [];
      let count = 0;
      for await (const resource of client.resources.list()) {
        count += 1;
        if (items.length < 50) {
          items.push({
            id: resource.id ?? "",
            name: resource.name ?? extractNameFromId(resource.id ?? "") ?? "unknown",
            type: resource.type ?? "unknown",
            resourceGroup: extractResourceGroupFromId(resource.id ?? "") ?? "unknown",
            location: formatAzureRegion(resource.location),
          });
        }
      }
      return { items, count };
    })(),
    (async () => {
      const tagDetails = client.tagsOperations.list();
      const summaries: AzureTagSummary[] = [];
      for await (const detail of tagDetails) {
        const detailMetrics = detail as unknown as {
          tagValueCount?: { value?: number };
          count?: number;
          values?: Array<{ count?: number }>;
        };
        const derivedCount =
          detailMetrics.tagValueCount?.value ??
          detailMetrics.count ??
          detailMetrics.values?.reduce((sum, value) => sum + (value.count ?? 0), 0) ??
          0;
        summaries.push({
          key: detail.tagName ?? "unknown",
          count: derivedCount,
        });
      }
      return summaries.sort((a, b) => b.count - a.count).slice(0, 12);
    })(),
  ]);

  return {
    resourceGroups,
    resources: resources.items,
    totalResources: resources.count,
    topTags: tags,
  };
};
