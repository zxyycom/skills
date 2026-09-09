import path from "node:path";
import {
  createLearnedCriticalPathStrategy,
  defineConfig
} from "@zxyycom/vibe-check";
import type { Check, ProjectDefinition } from "@zxyycom/vibe-check";
import { rootDir } from "./project.ts";
import {
  gateResourceCapacities,
  hasGateTag,
  normalizeGateTags,
  releaseGateResourceCapacities,
  type GateTagSet
} from "./vibe-gate/contracts.ts";
import {
  runGateCommand,
  type GateCommandRunner
} from "./vibe-gate/command-runner.ts";
import {
  createVibeNativeChecks,
  vibeNativeCheckIds
} from "./vibe-gate/checks/native.ts";
import {
  createPackageScriptCheck,
  packageScriptCheckId,
  releaseRequiredPackageScripts
} from "./vibe-gate/checks/package-script.ts";
import {
  createSemanticGateCheck,
  semanticGateChecks
} from "./vibe-gate/checks/semantic.ts";
import {
  createPackSkillsCheck,
  createReleasePrepareCheck,
  createReleaseVersionCheck,
  packSkillsCheckId,
  releaseSnapshotCheckId,
  releaseVersionCheckId,
  type ReleasePacker,
  type ReleasePreparer,
  type ReleaseState
} from "./vibe-gate/checks/release.ts";
import {
  createReleaseTestBatchSession,
  releaseTestBatchGroups,
  releaseTestBatchLeaderCheckId,
  releaseTestBatchResourceClaim,
  type ReleaseTestBatchProofOptions,
  type ReleaseTestBatchSession
} from "./vibe-gate/release-test-batch.ts";
import {
  activationFlagForCheck,
  baseGateCheckIds,
  validateBaseGateImpactContracts
} from "./vibe-gate/impact.ts";

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

const learnedSchedulingVersion = "gate-scheduler-v2";

export type GateDefinitionDependencies = Readonly<{
  activeCheckIds?: readonly string[];
  baselineRef?: string;
  batchReleaseTests?: boolean;
  nativeChecks?: readonly Check[];
  packRelease?: ReleasePacker;
  prepareRelease?: ReleasePreparer;
  runCommand?: GateCommandRunner;
  releaseTestBatchProof?: ReleaseTestBatchProofOptions;
  schedulingStateDirectory?: string;
}>;

function batchedCheck(
  check: Check,
  checkId: string,
  batch: ReleaseTestBatchSession | null
): Check {
  if (batch === null || !batch.has(checkId)) return check;
  const { resourceClaims: _resourceClaims, ...projection } = check;
  return checkId === releaseTestBatchLeaderCheckId
    ? {
        ...projection,
        resourceClaims: releaseTestBatchResourceClaim
      }
    : {
        ...projection,
        observes: [releaseTestBatchLeaderCheckId]
      };
}

function releaseCpuCheck(
  check: Check,
  batch: ReleaseTestBatchSession | null
): Check {
  if (batch?.has(check.checkId) === true) return check;
  return {
    ...check,
    resourceClaims: { ...check.resourceClaims, "cpu-work": 1 }
  };
}

export const releaseRequiredCheckIds = [
  ...vibeNativeCheckIds,
  ...releaseRequiredPackageScripts.map(packageScriptCheckId),
  ...semanticGateChecks.map(({ checkId }) => checkId)
] as const;

export function gateCheckIds(): readonly string[] {
  return [
    releaseSnapshotCheckId,
    ...vibeNativeCheckIds,
    ...releaseRequiredPackageScripts.map(packageScriptCheckId),
    ...semanticGateChecks.map(({ checkId }) => checkId),
    releaseVersionCheckId,
    packSkillsCheckId
  ];
}

function enableGateCheckByFlag<
  AuthoredOptions extends object,
  PreparedOptions extends object
>(
  check: Check<AuthoredOptions, PreparedOptions>,
  flag: string | undefined
): Check<AuthoredOptions, PreparedOptions> {
  if (flag === undefined) return check;
  return {
    ...check,
    enabledByFlags: {
      flags: [flag],
      mode: "all",
      ...(check.dependsOn === undefined ? {} : { propagateDependsOn: true })
    }
  };
}

export function createGateDefinition(
  activeTags: GateTagSet = [],
  dependencies: GateDefinitionDependencies = {}
): ProjectDefinition {
  const tags = normalizeGateTags(activeTags);
  const release = hasGateTag(tags, "release");
  const useIncrementalActivation = dependencies.activeCheckIds !== undefined;
  if (useIncrementalActivation) {
    const contractErrors = validateBaseGateImpactContracts();
    const baseCheckIds = new Set(baseGateCheckIds);
    if (
      contractErrors.length > 0 ||
      dependencies.activeCheckIds?.some((checkId) => !baseCheckIds.has(checkId))
    ) {
      throw new Error(
        contractErrors[0] ??
          "incremental Gate activation selected a non-base Check"
      );
    }
  }
  const runner = dependencies.runCommand ?? runGateCommand;
  const testBatch =
    release && dependencies.batchReleaseTests !== false
      ? createReleaseTestBatchSession(
          runner,
          releaseTestBatchGroups,
          dependencies.releaseTestBatchProof
        )
      : null;
  const releaseState: ReleaseState = { prepared: undefined };
  const nativeChecks = dependencies.nativeChecks ?? createVibeNativeChecks();
  const semanticChecks = semanticGateChecks.map((check) => {
    const semantic = createSemanticGateCheck(
      check,
      testBatch?.has(check.checkId) === true
        ? testBatch.runnerFor(check.checkId)
        : runner
    );
    return enableGateCheckByFlag(
      batchedCheck(semantic, check.checkId, testBatch),
      check.requiredTag ??
        (useIncrementalActivation
          ? activationFlagForCheck(check.checkId)
          : undefined)
    );
  });
  const packageChecks = releaseRequiredPackageScripts.map((script) => {
    const checkId = packageScriptCheckId(script);
    const packageCheck = createPackageScriptCheck(
      script,
      testBatch?.has(checkId) === true ? testBatch.runnerFor(checkId) : runner
    );
    return enableGateCheckByFlag(
      batchedCheck(packageCheck, checkId, testBatch),
      useIncrementalActivation
        ? activationFlagForCheck(packageScriptCheckId(script))
        : undefined
    );
  });
  const releasePrepareCheck = enableGateCheckByFlag(
    createReleasePrepareCheck(
      dependencies.baselineRef ?? "HEAD",
      dependencies.prepareRelease,
      releaseState
    ),
    "release"
  );
  const releaseVersionCheck = enableGateCheckByFlag(
    createReleaseVersionCheck(releaseState, releaseRequiredCheckIds),
    "release"
  );
  const packSkillsCheck = enableGateCheckByFlag(
    createPackSkillsCheck(dependencies.packRelease, releaseState),
    "release"
  );
  const authoredChecks: Check[] = [
    releasePrepareCheck,
    ...nativeChecks.map((check) =>
      enableGateCheckByFlag(
        check,
        useIncrementalActivation
          ? activationFlagForCheck(check.checkId)
          : undefined
      )
    ),
    ...packageChecks,
    ...semanticChecks,
    releaseVersionCheck,
    packSkillsCheck
  ];
  const checks = release
    ? authoredChecks.map((check) => releaseCpuCheck(check, testBatch))
    : authoredChecks;
  const strategy = createLearnedCriticalPathStrategy({
    stateDirectory:
      dependencies.schedulingStateDirectory ??
      path.join(rootDir, ".log/vibe-check/cache/scheduler-history"),
    identityForTask: (task) => ({
      gateProfile: hasGateTag(tags, "release") ? "release" : "base",
      implementationVersion: learnedSchedulingVersion,
      taskId: task.taskId
    })
  });
  return defineConfig({
    checks,
    outputs: {
      diagnosticLogging: { directory: ".log/vibe-check", enabled: false },
      machinePublication: {
        directory: ".log/vibe-check/publication",
        enabled: true
      },
      progressRendering: { enabled: true }
    },
    scheduler: {
      admissionPolicy: { kind: "custom", strategy },
      maxParallel: 4,
      resourceCapacities: release
        ? releaseGateResourceCapacities
        : gateResourceCapacities
    }
  });
}
