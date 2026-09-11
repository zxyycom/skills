export {
  baseGateCheckIds,
  baseGateImpactContracts,
  gateCheckInputFingerprint,
  gateImpactContractVersion,
  validateBaseGateImpactContracts
} from "./impact-catalog.ts";
export type {
  GateCheckImpactContract,
  GateImpactTag
} from "./impact-catalog.ts";
export { impactTagsForPath } from "./impact-paths.ts";
export { captureGateWorkspaceSnapshot } from "./impact-snapshot.ts";
export type {
  GateWorkspaceFile,
  GateWorkspaceSnapshot
} from "./impact-snapshot.ts";
export {
  activationFlagForCheck,
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
