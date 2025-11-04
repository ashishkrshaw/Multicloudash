export const extractResourceGroupFromId = (resourceId: string): string | null => {
  if (!resourceId) return null;
  const match = resourceId.match(/\/resourceGroups\/([^\/]+)/i);
  return match ? match[1] : null;
};

export const extractNameFromId = (resourceId: string): string | null => {
  if (!resourceId) return null;
  const segments = resourceId.split("/").filter(Boolean);
  return segments.at(-1) ?? null;
};

export const formatAzureRegion = (region: string | undefined | null) => {
  if (!region) return "unknown";
  return region.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/-/g, " ").replace(/\s+/g, " ").trim();
};

export const safeNumber = (value: unknown, fallback = 0): number => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};
