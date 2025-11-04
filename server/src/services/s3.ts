import { GetBucketLocationCommand, ListBucketsCommand, S3Client } from "@aws-sdk/client-s3";
import { getAwsClientConfig } from "../aws/config.js";

let s3ClientPromise: Promise<S3Client> | null = null;

async function getS3Client(userId?: string): Promise<S3Client> {
  // Don't cache if userId provided - each user has different credentials
  if (userId) {
    return new S3Client(await getAwsClientConfig(undefined, userId));
  }
  
  if (s3ClientPromise) {
    return s3ClientPromise;
  }
  s3ClientPromise = (async () => new S3Client(await getAwsClientConfig()))();
  return s3ClientPromise;
}

export interface S3BucketSummary {
  name: string;
  createdAt: string | null;
  region: string;
}

async function getBucketRegion(client: S3Client, bucketName: string): Promise<string> {
  try {
    const { LocationConstraint } = await client.send(new GetBucketLocationCommand({ Bucket: bucketName }));
    // AWS returns null/empty for classic us-east-1 buckets.
    return LocationConstraint ?? "us-east-1";
  } catch (error) {
    // If the caller lacks permissions for GetBucketLocation we'll expose the bucket but mark region unknown.
    console.warn(`Failed to resolve region for bucket ${bucketName}:`, error);
    return "unknown";
  }
}

export async function listS3Buckets(userId?: string): Promise<S3BucketSummary[]> {
  const client = await getS3Client(userId);
  const response = await client.send(new ListBucketsCommand({}));
  const buckets = response.Buckets ?? [];

  const summaries = await Promise.all(
    buckets.map(async (bucket) => ({
      name: bucket.Name ?? "unknown",
      createdAt: bucket.CreationDate?.toISOString() ?? null,
      region: bucket.Name ? await getBucketRegion(client, bucket.Name) : "unknown",
    })),
  );

  return summaries;
}
