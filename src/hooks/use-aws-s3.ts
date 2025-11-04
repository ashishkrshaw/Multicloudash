import { useQuery, type UseQueryResult } from "@tanstack/react-query";

export interface AwsS3Bucket {
  name: string;
  createdAt: string | null;
  region: string;
}

interface AwsS3BucketResponse {
  buckets: AwsS3Bucket[];
}

async function fetchAwsS3Buckets(): Promise<AwsS3Bucket[]> {
  // Get auth token from localStorage
  const googleToken = localStorage.getItem('google_id_token');
  const cognitoToken = localStorage.getItem('cognito_id_token');
  const token = googleToken || cognitoToken;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch("/api/aws/s3/buckets", { headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body.error === "string" ? body.error : response.statusText;
    throw new Error(message || "Failed to load S3 buckets");
  }
  const payload = (await response.json()) as AwsS3BucketResponse;
  return payload.buckets ?? [];
}

export function useAwsS3Buckets(enabled: boolean = false): UseQueryResult<AwsS3Bucket[]> {
  return useQuery<AwsS3Bucket[]>({
    queryKey: ["aws-s3-buckets"],
    queryFn: fetchAwsS3Buckets,
    staleTime: 1000 * 60 * 5,
    enabled, // Only fetch when enabled
  });
}
