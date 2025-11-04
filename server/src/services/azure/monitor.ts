import { getMonitorClient } from "../../azure/config.js";

export interface AzureMonitoringSummary {
  metricAlerts: number;
  activityLogAlerts: number;
  autoscaleSettings: number;
}

export const getMonitoringSummary = async (userId?: string): Promise<AzureMonitoringSummary> => {
  const client = await getMonitorClient(userId);

  const [metricAlerts, activityAlerts, autoscaleSettings] = await Promise.all([
    (async () => {
      let count = 0;
      for await (const _alert of client.metricAlerts.listBySubscription()) {
        count += 1;
      }
      return count;
    })(),
    (async () => {
      let count = 0;
      for await (const _alert of client.activityLogAlerts.listBySubscriptionId()) {
        count += 1;
      }
      return count;
    })(),
    (async () => {
      let count = 0;
      for await (const _setting of client.autoscaleSettings.listBySubscription()) {
        count += 1;
      }
      return count;
    })(),
  ]);

  return {
    metricAlerts,
    activityLogAlerts: activityAlerts,
    autoscaleSettings,
  };
};
