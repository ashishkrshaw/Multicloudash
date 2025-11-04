import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Power, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAwsEc2Instances, type AwsEc2Instance } from "@/hooks/use-aws-ec2";

const stateLabels: Record<string, { label: string; className: string }> = {
  running: { label: "Running", className: "bg-success" },
  stopped: { label: "Stopped", className: "bg-muted text-muted-foreground" },
  pending: { label: "Pending", className: "bg-warning" },
  stopping: { label: "Stopping", className: "bg-warning" },
  "shutting-down": { label: "Shutting down", className: "bg-warning" },
  rebooting: { label: "Rebooting", className: "bg-warning" },
  terminated: { label: "Terminated", className: "bg-destructive" },
  unknown: { label: "Unknown", className: "bg-muted text-muted-foreground" },
};

function StateBadge({ state }: { state: string }) {
  const badge = stateLabels[state] ?? stateLabels.unknown;
  return <Badge className={badge.className}>{badge.label}</Badge>;
}

export function ResourceTable() {
  const {
    instances,
    isLoading,
    isError,
    error,
    startInstance,
    stopInstance,
    isStarting,
    isStopping,
    startingInstanceId,
    stoppingInstanceId,
  } = useAwsEc2Instances();

  const handleStart = (instance: AwsEc2Instance) =>
    toast.promise(startInstance(instance.id, instance.region), {
      loading: `Starting ${instance.name}...`,
      success: `${instance.name} is starting`,
      error: (err) => (err instanceof Error ? err.message : "Failed to start instance"),
    });

  const handleStop = (instance: AwsEc2Instance) =>
    toast.promise(stopInstance(instance.id, instance.region), {
      loading: `Stopping ${instance.name}...`,
      success: `${instance.name} is stopping`,
      error: (err) => (err instanceof Error ? err.message : "Failed to stop instance"),
    });

  return (
    <Card className="col-span-full border border-border/60 bg-card/80 shadow-sm backdrop-blur">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl">AWS EC2 Instances</CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sm:text-sm">Name</TableHead>
                <TableHead className="hidden md:table-cell text-xs sm:text-sm">Instance ID</TableHead>
                <TableHead className="text-xs sm:text-sm">Type</TableHead>
                <TableHead className="hidden lg:table-cell text-xs sm:text-sm">Region</TableHead>
                <TableHead className="hidden xl:table-cell text-xs sm:text-sm">Zone</TableHead>
                <TableHead className="text-xs sm:text-sm">State</TableHead>
                <TableHead className="hidden lg:table-cell text-xs sm:text-sm">Public IP</TableHead>
                <TableHead className="hidden xl:table-cell text-xs sm:text-sm">Launched</TableHead>
                <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                  Loading EC2 instances...
                </TableCell>
              </TableRow>
            )}

            {isError && !isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-destructive">
                  {(error instanceof Error ? error.message : "Failed to load instances") || "Failed to load instances"}
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && instances.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                  No EC2 instances detected in this account.
                </TableCell>
              </TableRow>
            )}

            {instances.map((instance) => {
              const canStart = instance.state === "stopped";
              const canStop = instance.state === "running";
              const isMutatingStart = isStarting && startingInstanceId === instance.id;
              const isMutatingStop = isStopping && stoppingInstanceId === instance.id;
              const isTransitionState =
                instance.state === "pending" ||
                instance.state === "stopping" ||
                instance.state === "shutting-down" ||
                instance.state === "rebooting";

              return (
                <TableRow key={instance.id} className="transition-colors hover:bg-muted/40">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm">{instance.name}</span>
                      {isTransitionState && <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-warning" />}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs sm:text-sm text-muted-foreground">{instance.id}</TableCell>
                  <TableCell className="text-xs sm:text-sm">{instance.type}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge variant="outline" className="text-xs">{instance.region}</Badge>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-xs sm:text-sm text-muted-foreground">{instance.availabilityZone ?? "—"}</TableCell>
                  <TableCell>
                    <StateBadge state={instance.state} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs sm:text-sm text-muted-foreground">{instance.publicIp ?? "—"}</TableCell>
                  <TableCell className="hidden xl:table-cell text-xs sm:text-sm text-muted-foreground">
                    {instance.launchTime ? new Date(instance.launchTime).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {canStop && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isMutatingStop}
                          onClick={() => handleStop(instance)}
                          className="text-xs"
                        >
                          {isMutatingStop ? (
                            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin sm:mr-2" />
                          ) : (
                            <Power className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                          )}
                          <span className="hidden sm:inline">Stop</span>
                        </Button>
                      )}
                      {canStart && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isMutatingStart}
                          onClick={() => handleStart(instance)}
                          className="text-xs"
                        >
                          {isMutatingStart ? (
                            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin sm:mr-2" />
                          ) : (
                            <Power className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                          )}
                          <span className="hidden sm:inline">Start</span>
                        </Button>
                      )}
                      {!canStart && !canStop && (
                        <span className="text-[10px] sm:text-xs text-muted-foreground">In progress</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}
