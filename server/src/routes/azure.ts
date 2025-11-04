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

azureRouter.get("/overview", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const overview = await getAzureOverview(userId);
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

azureRouter.get("/compute/virtual-machines", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const vms = await listVirtualMachines(userId);
    res.json({ vms });
  } catch (error) {
    next(error);
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
    res.json({ vm });
  } catch (error) {
    next(error);
  }
});

export default azureRouter;
