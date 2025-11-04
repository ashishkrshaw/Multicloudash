import { useCacheStatus } from "@/hooks/use-cache-status";
import { Badge } from "@/components/ui/badge";
import { Clock, Database } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CacheStatusBadgeProps {
  provider: 'aws' | 'azure' | 'gcp';
}

export const CacheStatusBadge = ({ provider }: CacheStatusBadgeProps) => {
  const { data, isLoading } = useCacheStatus();

  if (isLoading || !data) {
    return null;
  }

  const nextRefresh = data.nextRefresh[provider];
  const cacheCount = data.cacheStats.providers[provider];

  if (cacheCount === 0) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1">
          <Database className="h-3 w-3" />
          Cached
          <Clock className="h-3 w-3 ml-1" />
          {nextRefresh.hours}h {nextRefresh.minutes}m
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <p><strong>{cacheCount}</strong> items cached</p>
          <p>Next refresh: {new Date(nextRefresh.time).toLocaleTimeString()}</p>
          <p className="text-muted-foreground">Auto-refreshes daily at 8 AM</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
