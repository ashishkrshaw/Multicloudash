import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useShouldShowMockData } from "@/context/CredentialsContext";
import { generateMockAwsInstances } from "@/lib/mock-data";

export type AwsEc2InstanceState =
  | "pending"
  | "running"
  | "shutting-down"
  | "terminated"
  | "stopping"
  | "stopped"
  | "rebooting"
  | "unknown";

export interface AwsEc2Instance {
  id: string;
  name: string;
  type: string;
  state: AwsEc2InstanceState;
  region: string;
  availabilityZone: string | null;
  publicIp: string | null;
  privateIp: string | null;
  launchTime: string | null;
  isMock?: boolean;
}

interface AwsEc2ListResponse {
  instances: AwsEc2Instance[];
}

async function fetchInstances(forceRefresh = false): Promise<AwsEc2Instance[]> {
  const url = `/api/aws/ec2/instances${forceRefresh ? '?refresh=true' : ''}`;
  
  // Get auth token from localStorage
  const googleToken = localStorage.getItem('google_id_token');
  const cognitoToken = localStorage.getItem('cognito_id_token');
  const token = googleToken || cognitoToken;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to load EC2 instances");
  }
  const payload = (await response.json()) as AwsEc2ListResponse;
  return payload.instances ?? [];
}

type Ec2InstanceMutationPayload = {
  instanceId: string;
  region?: string;
};

async function mutateInstance(request: Ec2InstanceMutationPayload, action: "start" | "stop"): Promise<AwsEc2Instance> {
  // Get auth token from localStorage
  const googleToken = localStorage.getItem('google_id_token');
  const cognitoToken = localStorage.getItem('cognito_id_token');
  const token = googleToken || cognitoToken;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`/api/aws/ec2/instances/${request.instanceId}/${action}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ region: request.region }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body.error === "string" ? body.error : response.statusText;
    throw new Error(message || `Failed to ${action} instance`);
  }
  const body = (await response.json()) as { instance: AwsEc2Instance };
  return body.instance;
}

export function useAwsEc2Instances(enabled: boolean = false) {
  const queryClient = useQueryClient();
  const shouldShowMock = useShouldShowMockData("aws");
  const queryKey = useMemo(() => ["aws-ec2-instances", shouldShowMock], [shouldShowMock]);

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (shouldShowMock) {
        const mockInstances = generateMockAwsInstances();
        return mockInstances.map(inst => ({
          ...inst,
          availabilityZone: `${inst.region}a`,
          publicIp: inst.state === 'running' ? '54.123.45.67' : null,
          privateIp: '10.0.1.123',
          isMock: true,
        }));
      }
      return fetchInstances();
    },
    staleTime: 1000 * 60,
    enabled, // Only fetch when enabled
  });

  const startMutation = useMutation({
    mutationFn: (payload: Ec2InstanceMutationPayload) => mutateInstance(payload, "start"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const stopMutation = useMutation({
    mutationFn: (payload: Ec2InstanceMutationPayload) => mutateInstance(payload, "stop"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    instances: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    error: listQuery.error,
    refetch: listQuery.refetch,
    startInstance: (instanceId: string, region: string) => startMutation.mutateAsync({ instanceId, region }),
    stopInstance: (instanceId: string, region: string) => stopMutation.mutateAsync({ instanceId, region }),
    startingInstanceId: startMutation.variables?.instanceId,
    stoppingInstanceId: stopMutation.variables?.instanceId,
    isStarting: startMutation.isPending,
    isStopping: stopMutation.isPending,
  };
}
