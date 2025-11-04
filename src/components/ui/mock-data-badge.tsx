import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MockDataBadgeProps {
  className?: string;
  variant?: "default" | "outline";
}

export const MockDataBadge = ({ className, variant = "outline" }: MockDataBadgeProps) => {
  return (
    <Badge 
      variant={variant}
      className={cn(
        "gap-1 border-warning/40 bg-warning/10 text-warning hover:bg-warning/20",
        className
      )}
    >
      <AlertCircle className="h-3 w-3" />
      Mock Data
    </Badge>
  );
};
