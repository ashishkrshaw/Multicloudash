import { type VirtualMachine, type VirtualMachineInstanceView } from "@azure/arm-compute";
import { getComputeClient } from "../../azure/config.js";
import { extractResourceGroupFromId, extractNameFromId, formatAzureRegion } from "../../azure/utils.js";

export type AzureVmPowerState =
  | "running"
  | "stopped"
  | "deallocated"
  | "starting"
  | "stopping"
  | "unknown";

export interface AzureVirtualMachine {
  id: string;
  name: string;
  resourceGroup: string;
  location: string;
  size: string | null;
  osType: string | null;
  powerState: AzureVmPowerState;
  provisioningState: string | null;
  tags: Record<string, string> | undefined;
  computerName: string | null;
  privateIps: string[];
  publicIps: string[];
}

type InstanceViewStatusLike = { code?: string | undefined };

const powerStateFromStatuses = (statuses: InstanceViewStatusLike[] | undefined): AzureVmPowerState => {
  const status = statuses?.find((item) => item.code?.toLowerCase().startsWith("powerstate"));
  if (!status?.code) return "unknown";

  switch (status.code.toLowerCase()) {
    case "powerstate/running":
      return "running";
    case "powerstate/stopped":
      return "stopped";
    case "powerstate/deallocated":
      return "deallocated";
    case "powerstate/starting":
      return "starting";
    case "powerstate/stopping":
      return "stopping";
    default:
      return "unknown";
  }
};

const extractIps = (instanceView: VirtualMachineInstanceView | undefined) => {
  if (!instanceView?.vmAgent?.extensionHandlers) {
    return { privateIps: [], publicIps: [] };
  }
  const privateIps = new Set<string>();
  const publicIps = new Set<string>();
  for (const handler of instanceView.vmAgent.extensionHandlers) {
    const extensionContainer = handler as unknown as { extensions?: Array<{ settings?: unknown }> };
    const items = extensionContainer.extensions ?? [];
    for (const extension of items) {
      const settings = extension.settings;
      if (settings && typeof settings === "object") {
        const privateIp = (settings as { privateIpAddress?: string }).privateIpAddress;
        const publicIp = (settings as { publicIpAddress?: string }).publicIpAddress;
        if (privateIp) privateIps.add(privateIp);
        if (publicIp) publicIps.add(publicIp);
      }
    }
  }
  return { privateIps: Array.from(privateIps), publicIps: Array.from(publicIps) };
};
const mapAzureVirtualMachine = (vm: VirtualMachine): AzureVirtualMachine => {
  const id = vm.id ?? "";
  const resourceGroup = extractResourceGroupFromId(id) ?? "unknown";
  const instanceView = (vm as VirtualMachine & { instanceView?: VirtualMachineInstanceView }).instanceView;
  const powerState = powerStateFromStatuses(instanceView?.statuses);
  const provisioningState =
    instanceView?.statuses?.find((status: InstanceViewStatusLike) => status.code?.startsWith("ProvisioningState"))?.code ?? null;
  const ips = extractIps(instanceView);

  return {
    id,
    name: vm.name ?? extractNameFromId(id) ?? "unknown",
    resourceGroup,
    location: formatAzureRegion(vm.location ?? "unknown"),
    size: vm.hardwareProfile?.vmSize ?? null,
    osType: vm.storageProfile?.osDisk?.osType ?? null,
    powerState,
    provisioningState,
    tags: vm.tags,
    computerName: vm.osProfile?.computerName ?? null,
    privateIps: ips.privateIps,
    publicIps: ips.publicIps,
  };
};

export const listVirtualMachines = async (userId?: string): Promise<AzureVirtualMachine[]> => {
  const client = await getComputeClient(userId);
  const vms: AzureVirtualMachine[] = [];

  for await (const vm of client.virtualMachines.listAll({ expand: "instanceView" })) {
    vms.push(mapAzureVirtualMachine(vm));
  }

  return vms;
};

export const startVirtualMachine = async (resourceGroup: string, vmName: string, userId?: string): Promise<AzureVirtualMachine> => {
  const client = await getComputeClient(userId);
  await client.virtualMachines.beginStartAndWait(resourceGroup, vmName);
  const vm = await client.virtualMachines.get(resourceGroup, vmName, { expand: "instanceView" });
  return mapAzureVirtualMachine(vm);
};

export const restartVirtualMachine = async (resourceGroup: string, vmName: string, userId?: string): Promise<AzureVirtualMachine> => {
  const client = await getComputeClient(userId);
  await client.virtualMachines.beginRestartAndWait(resourceGroup, vmName);
  const vm = await client.virtualMachines.get(resourceGroup, vmName, { expand: "instanceView" });
  return mapAzureVirtualMachine(vm);
};

export const powerOffVirtualMachine = async (
  resourceGroup: string,
  vmName: string,
  skipShutdown = false,
  userId?: string
): Promise<AzureVirtualMachine> => {
  const client = await getComputeClient(userId);
  await client.virtualMachines.beginPowerOffAndWait(resourceGroup, vmName, { skipShutdown });
  const vm = await client.virtualMachines.get(resourceGroup, vmName, { expand: "instanceView" });
  return mapAzureVirtualMachine(vm);
};

export const deallocateVirtualMachine = async (resourceGroup: string, vmName: string, userId?: string): Promise<AzureVirtualMachine> => {
  const client = await getComputeClient(userId);
  await client.virtualMachines.beginDeallocateAndWait(resourceGroup, vmName);
  const vm = await client.virtualMachines.get(resourceGroup, vmName, { expand: "instanceView" });
  return mapAzureVirtualMachine(vm);
};

export { mapAzureVirtualMachine };
