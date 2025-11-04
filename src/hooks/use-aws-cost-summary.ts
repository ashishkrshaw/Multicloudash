import { useQuery } from "@tanstack/react-query";

interface CostSummary {
  totalCost: number;
  currency: string;
  startDate: string;
  endDate: string;
  services?: Array<{
    service: string;
    cost: number;
  }>;
}

interface UseAwsCostSummaryOptions {
  enabled?: boolean;
}

export const useAwsCostSummary = (options: UseAwsCostSummaryOptions = {}) => {
  return useQuery({
    queryKey: ["aws", "cost-summary"],
    queryFn: async (): Promise<CostSummary> => {
      const token = localStorage.getItem("google_id_token") || localStorage.getItem("cognito_id_token");
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/aws/cost-explorer`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch AWS cost summary: ${response.status}`);
      }

      return response.json();
    },
    enabled: options.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
