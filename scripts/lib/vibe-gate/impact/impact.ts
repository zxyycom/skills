export {
  baseGateCheckIds,
  baseGateImpactContracts,
  gateCheckInputFingerprint,
  gateCheckToolFingerprints,
  gateToolInputFingerprint,
  gateImpactContractVersion,
  validateBaseGateImpactContracts
} from "./impact-catalog.ts";
export type { GateCheckImpactContract } from "./impact-catalog.ts";
export { captureGateWorkspaceSnapshot } from "./impact-snapshot.ts";
export type {
  GateWorkspaceFile,
  GateWorkspaceSnapshot
} from "./impact-snapshot.ts";
export {
  gateActivationFlags,
  prepareGateActivation,
  publishGateReceipts
} from "./impact-activation.ts";
export type {
  GateActivationDecision,
  GateActivationPlan,
  GateActivationReason,
  GateReceiptPublication
} from "./impact-activation.ts";

export { activationFlagForTool, gateToolInputs } from "./impact-tools.ts";
export type { GateToolId, GateToolSubscription } from "./impact-tools.ts";
