import { getSqlClient, getMySqlClient, getPostgresClient } from "../../azure/config.js";
import { extractResourceGroupFromId, formatAzureRegion } from "../../azure/utils.js";

export interface AzureSqlDatabaseSummary {
  id: string;
  name: string;
  edition: string | undefined;
  status: string | undefined;
  sizeGb: number | null;
}

export interface AzureSqlServerSummary {
  id: string;
  name: string;
  resourceGroup: string;
  location: string;
  version: string | undefined;
  databases: AzureSqlDatabaseSummary[];
}

export interface AzureFlexibleServerSummary {
  id: string;
  name: string;
  resourceGroup: string;
  location: string;
  engine: "MySQL" | "PostgreSQL";
  version: string | undefined;
  state: string | undefined;
}

export interface AzureDatabaseSummary {
  sqlServers: AzureSqlServerSummary[];
  mysqlServers: AzureFlexibleServerSummary[];
  postgresServers: AzureFlexibleServerSummary[];
}

export const getDatabaseSummary = async (userId?: string): Promise<AzureDatabaseSummary> => {
  const sqlClient = await getSqlClient(userId);
  const mysqlClient = await getMySqlClient(userId);
  const postgresClient = await getPostgresClient(userId);

  const [sqlServers, mysqlServers, postgresServers] = await Promise.all([
    (async () => {
      const servers: AzureSqlServerSummary[] = [];
      for await (const server of sqlClient.servers.list()) {
        const id = server.id ?? "";
        const resourceGroup = extractResourceGroupFromId(id) ?? "unknown";
        const databases: AzureSqlDatabaseSummary[] = [];
        try {
          for await (const database of sqlClient.databases.listByServer(resourceGroup, server.name ?? "")) {
            if (database.name?.toLowerCase() === "master") continue;
            databases.push({
              id: database.id ?? "",
              name: database.name ?? "unknown",
              edition: database.sku?.tier ?? database.kind ?? undefined,
              status: database.status,
              sizeGb: database.maxSizeBytes ? Number(database.maxSizeBytes) / (1024 ** 3) : null,
            });
          }
        } catch (error) {
          console.warn(`Failed to enumerate databases for SQL server ${server.name}`, error);
        }
        servers.push({
          id,
          name: server.name ?? "unknown",
          resourceGroup,
          location: formatAzureRegion(server.location),
          version: server.version,
          databases,
        });
      }
      return servers;
    })(),
    (async () => {
      const servers: AzureFlexibleServerSummary[] = [];
      for await (const server of mysqlClient.servers.list()) {
        servers.push({
          id: server.id ?? "",
          name: server.name ?? "unknown",
          resourceGroup: extractResourceGroupFromId(server.id ?? "") ?? "unknown",
          location: formatAzureRegion(server.location),
          engine: "MySQL",
          version: server.version,
          state: server.state,
        });
      }
      return servers;
    })(),
    (async () => {
      const servers: AzureFlexibleServerSummary[] = [];
      for await (const server of postgresClient.servers.list()) {
        servers.push({
          id: server.id ?? "",
          name: server.name ?? "unknown",
          resourceGroup: extractResourceGroupFromId(server.id ?? "") ?? "unknown",
          location: formatAzureRegion(server.location),
          engine: "PostgreSQL",
          version: server.version,
          state: server.state,
        });
      }
      return servers;
    })(),
  ]);

  return {
    sqlServers,
    mysqlServers,
    postgresServers,
  };
};
