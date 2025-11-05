import { Router } from "express";
import { z } from "zod";
import { getAzureOverview } from "../services/azure/overview.js";
import {
  deallocateVirtualMachine,
  listVirtualMachines,
  powerOffVirtualMachine,
  restartVirtualMachine,
  startVirtualMachine,
} from "../services/azure/compute.js";

const azureRouter = Router();

const vmPathSchema = z.object({
  resourceGroup: z.string().min(1),
  vmName: z.string().min(1),
});

const vmActionSchema = z.enum(["start", "restart", "poweroff", "deallocate"]);

azureRouter.get("/overview", async (req, res) => {
  try {
    const userId = (req as any).userId;
    console.log('[Azure] Fetching overview', userId ? `for user ${userId}` : '(no auth)');
    const overview = await getAzureOverview(userId);
    console.log('[Azure] Success');
    return res.json(overview);
  } catch (error) {
    console.error('[Azure] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Azure overview';
    return res.status(500).json({ 
      error: errorMessage,
      cost: null,
      compute: null,
      storage: null,
      insights: [],
      errors: [{ section: 'overview', message: errorMessage }]
    });
  }
});

azureRouter.get("/compute/virtual-machines", async (req, res) => {
  try {
    const userId = (req as any).userId;
    console.log('[Azure] Fetching VMs', userId ? `for user ${userId}` : '(no auth)');
    const vms = await listVirtualMachines(userId);
    console.log('[Azure] Found', vms?.length || 0, 'VMs');
    return res.json({ vms });
  } catch (error) {
    console.error('[Azure] VM list error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to list VMs';
    return res.status(500).json({ 
      error: errorMessage,
      vms: []
    });
  }
});

azureRouter.post("/compute/virtual-machines/:resourceGroup/:vmName/:action", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const { resourceGroup, vmName } = vmPathSchema.parse(req.params);
    const action = vmActionSchema.parse(req.params.action?.toLowerCase());

    const decodedResourceGroup = decodeURIComponent(resourceGroup);
    const decodedVmName = decodeURIComponent(vmName);

    const performAction = async () => {
      switch (action) {
        case "start":
          return startVirtualMachine(decodedResourceGroup, decodedVmName, userId);
        case "restart":
          return restartVirtualMachine(decodedResourceGroup, decodedVmName, userId);
        case "poweroff":
          return powerOffVirtualMachine(decodedResourceGroup, decodedVmName, false, userId);
        case "deallocate":
          return deallocateVirtualMachine(decodedResourceGroup, decodedVmName, userId);
        default:
          throw new Error(`Unsupported action ${action}`);
      }
    };

    const vm = await performAction();
    return res.json({ vm });
  } catch (error) {
    next(error);
  }
});

export default azureRouter;
