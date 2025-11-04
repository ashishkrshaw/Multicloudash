import { DescribeTableCommand, DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { getAwsClientConfig, getTargetRegions } from "../aws/config.js";

const dynamoClientPromises = new Map<string, Promise<DynamoDBClient>>();

async function getDynamoClient(region?: string, userId?: string): Promise<DynamoDBClient> {
  // Don't cache user-specific clients
  if (userId) {
    return new DynamoDBClient(await getAwsClientConfig(region, userId));
  }
  
  const targetRegion = region ?? getTargetRegions()[0];
  const cached = dynamoClientPromises.get(targetRegion);
  if (cached) {
    return cached;
  }
  const promise = (async () => new DynamoDBClient(await getAwsClientConfig(targetRegion)))();
  dynamoClientPromises.set(targetRegion, promise);
  return promise;
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

export async function listDynamoTables(userId?: string): Promise<DynamoDbTableSummary[]> {
  const regions = getTargetRegions();
  const results = await Promise.all(
    regions.map(async (region) => {
      try {
        const client = await getDynamoClient(region, userId);
        const tableNames: string[] = [];
        let lastEvaluatedTableName: string | undefined;

        do {
          const response = await client.send(
            new ListTablesCommand({ ExclusiveStartTableName: lastEvaluatedTableName, Limit: 50 }),
          );
          tableNames.push(...(response.TableNames ?? []));
          lastEvaluatedTableName = response.LastEvaluatedTableName;
        } while (lastEvaluatedTableName);

        const summaries: DynamoDbTableSummary[] = [];
        for (const name of tableNames) {
          try {
            const describe = await client.send(new DescribeTableCommand({ TableName: name }));
            const table = describe.Table;
            summaries.push({
              name,
              status: table?.TableStatus ?? null,
              itemCount: table?.ItemCount ?? null,
              sizeBytes: table?.TableSizeBytes ?? null,
              billingMode: table?.BillingModeSummary?.BillingMode ?? null,
              readCapacityUnits: table?.ProvisionedThroughput?.ReadCapacityUnits ?? null,
              writeCapacityUnits: table?.ProvisionedThroughput?.WriteCapacityUnits ?? null,
              region,
            });
          } catch (error) {
            console.warn(`Failed to describe DynamoDB table ${name} in region ${region}:`, error);
            summaries.push({
              name,
              status: null,
              itemCount: null,
              sizeBytes: null,
              billingMode: null,
              readCapacityUnits: null,
              writeCapacityUnits: null,
              region,
            });
          }
        }

        return summaries;
      } catch (error) {
        console.warn(`Failed to list DynamoDB tables in region ${region}:`, error);
        return [];
      }
    }),
  );

  return results.flat();
}
