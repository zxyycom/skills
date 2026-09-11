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
export { runGateCommand } from "./vibe-gate/command-runner.ts";
export type {
  GateCommand,
  GateCommandInvocation,
  GateCommandRunner,
  GateCommandRunResult,
  GateCommandUnavailableReason
} from "./vibe-gate/command-runner.ts";
export {
  automationCodeFiles,
  createVibeNativeChecks,
  historicalContentExclusions,
  investigationAuthoringDocumentExclusions,
  maintainedCodeFiles,
  maintainedDocumentFiles,
  maintainedSecretFiles,
  productCodeFiles,
  testCodeFiles,
  vibeNativeCheckIds
} from "./vibe-gate/checks/native.ts";
export {
  compatibilityTestPackageScripts,
  packageScriptCheckId,
  releaseBunTestPackageFiles,
  releaseRequiredPackageScripts
} from "./vibe-gate/checks/package-script.ts";
export type {
  GatePackageScript,
  GatePackageScriptCheckId
} from "./vibe-gate/checks/package-script.ts";
export { semanticGateChecks } from "./vibe-gate/checks/semantic.ts";
export type { SemanticGateCheck } from "./vibe-gate/checks/semantic.ts";
export {
  createReleaseTestBatchSession,
  parseReleaseTestBatchReport,
  releaseTestBatchGroups,
  releaseTestBatchLeaderCheckId,
  releaseTestBatchResourceClaim
} from "./vibe-gate/release-test-batch.ts";
export type {
  ReleaseTestBatchGroup,
  ReleaseTestBatchProofOptions,
  ReleaseTestBatchSession
} from "./vibe-gate/release-test-batch.ts";
export {
  isReleaseBaselineRef,
  releaseSnapshotCheckId,
  releaseVersionPackageScript
} from "./vibe-gate/checks/release.ts";
export {
  activationFlagForCheck,
  baseGateCheckIds,
  baseGateImpactContracts,
  captureGateWorkspaceSnapshot,
  gateActivationFlags,
  gateCheckInputFingerprint,
  gateImpactContractVersion,
  impactTagsForPath,
  prepareGateActivation,
  publishGateReceipts,
  validateBaseGateImpactContracts
} from "./vibe-gate/impact.ts";
export type {
  GateActivationDecision,
  GateActivationPlan,
  GateActivationReason,
  GateCheckImpactContract,
  GateImpactTag,
  GateReceiptPublication,
  GateWorkspaceFile,
  GateWorkspaceSnapshot
} from "./vibe-gate/impact.ts";
