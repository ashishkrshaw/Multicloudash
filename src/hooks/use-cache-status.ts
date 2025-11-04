import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface CacheStats {
  totalEntries: number;
  providers: { aws: number; azure: number; gcp: number };
  oldestEntry: number | null;
  newestEntry: number | null;
}

interface NextRefresh {
  hours: number;
  minutes: number;
  time: string;
}

export function useCacheStatus() {
  const getToken = () => {
    return localStorage.getItem('google_access_token') || 
           localStorage.getItem('cognito_access_token');
  };

  return useQuery({
    queryKey: ['cache-status'],
    queryFn: async () => {
      const token = getToken();
      if (!token) return null;

      const response = await fetch('http://localhost:3000/api/test/cache', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cache status');
      }

      const data = await response.json();
      return data as {
        cacheStats: CacheStats;
        nextRefresh: {
          aws: NextRefresh;
          azure: NextRefresh;
          gcp: NextRefresh;
        };
      };
    },
    enabled: !!getToken(),
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useRefreshCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (provider: 'aws' | 'azure' | 'gcp') => {
      const token = localStorage.getItem('google_access_token') || 
                    localStorage.getItem('cognito_access_token');
      
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`http://localhost:3000/api/${provider}/cache/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to refresh cache');
      }

      return await response.json();
    },
    onSuccess: () => {
      // Invalidate all queries to trigger refetch
      queryClient.invalidateQueries();
    },
  });
}
