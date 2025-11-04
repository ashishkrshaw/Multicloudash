declare module "@azure/arm-compute" {
  export { ComputeManagementClient } from "@azure/arm-compute/dist-esm/src/computeManagementClient";
  export type {
    VirtualMachine,
    VirtualMachineInstanceView,
  } from "@azure/arm-compute/dist-esm/src/models";
  export * from "@azure/arm-compute/dist-esm/src/index";
}
