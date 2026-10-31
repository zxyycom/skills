export {
  createGateDefinition,
  gateCheckIds,
  releaseRequiredCheckIds
} from "./vibe-gate/definition.ts";
export type { GateDefinitionDependencies } from "./vibe-gate/definition.ts";

export {
  gateResourceCapacities,
  gateTags,
  hasGateTag,
  normalizeGateTags,
  releaseGateResourceCapacities
} from "./vibe-gate/contracts.ts";
export type { GateTag, GateTagSet } from "./vibe-gate/contracts.ts";
export {
  createGateEnvironmentCheck,
  gateEnvironmentCheckId
} from "./vibe-gate/checks/environment.ts";
export { commandText } from "./vibe-gate/command-runner.ts";
export type { GateCommand } from "./vibe-gate/command-runner.ts";
export {
  automationCodeFiles,
  createVibeNativeChecks,
  historicalContentExclusions,
  investigationAuthoringDocumentExclusions,
  maintainedCodeFiles,
  maintainedDocumentFiles,
  maintainedMarkdownFiles,
  maintainedSecretFiles,
  productCodeFiles,
  testCodeFiles,
  vibeNativeCheckIds
} from "./vibe-gate/checks/native.ts";
export {
  compatibilityTestPackageScripts,
  packageScriptCheckId,
  releaseRequiredPackageScripts
} from "./vibe-gate/checks/package-script.ts";
export type {
  GatePackageScript,
  GatePackageScriptCheckId
} from "./vibe-gate/checks/package-script.ts";
export { semanticGateChecks } from "./vibe-gate/checks/semantic.ts";
export type { SemanticGateCheck } from "./vibe-gate/checks/semantic.ts";
export {
  isReleaseBaselineRef,
  releaseSnapshotCheckId,
  releaseVersionPackageScript
} from "./vibe-gate/checks/release.ts";
export {
  activationFlagForTool,
  gateToolInputs,
  gateCheckToolFingerprints,
  baseGateCheckIds,
  baseGateImpactContracts,
  captureGateWorkspaceSnapshot,
  gateActivationFlags,
  gateCheckInputFingerprint,
  gateImpactContractVersion,
  prepareGateActivation,
  publishGateReceipts,
  validateBaseGateImpactContracts
} from "./vibe-gate/impact/impact.ts";
export type {
  GateToolId,
  GateToolSubscription,
  GateActivationDecision,
  GateActivationPlan,
  GateActivationReason,
  GateCheckImpactContract,
  GateReceiptPublication,
  GateWorkspaceFile,
  GateWorkspaceSnapshot
} from "./vibe-gate/impact/impact.ts";
