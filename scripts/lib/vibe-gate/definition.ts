import path from "node:path";
import {
  createLearnedCriticalPathStrategy,
  defineConfig
} from "@zxyycom/vibe-check";
import type { Check, ProjectDefinition } from "@zxyycom/vibe-check";
import { rootDir } from "../project.ts";
import {
  gateResourceCapacities,
  hasGateTag,
  normalizeGateTags,
  releaseGateResourceCapacities,
  type GateTagSet
} from "./contracts.ts";
import { runGateCommand, type GateCommandRunner } from "./command-runner.ts";
import { createVibeNativeChecks, vibeNativeCheckIds } from "./checks/native.ts";
import {
  createPackageScriptCheck,
  packageScriptCheckId,
  releaseRequiredPackageScripts
} from "./checks/package-script.ts";
import {
  createSemanticGateCheck,
  semanticGateChecks
} from "./checks/semantic.ts";
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
} from "./checks/release.ts";
import {
  createReleaseTestBatchSession,
  releaseTestBatchGroups,
  releaseTestBatchLeaderCheckId,
  releaseTestBatchResourceClaim,
  type ReleaseTestBatchProofOptions,
  type ReleaseTestBatchSession
} from "./release-test-batch.ts";
import {
  activationFlagForCheck,
  baseGateCheckIds,
  validateBaseGateImpactContracts
} from "./impact.ts";

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

type GateCheckBuildContext = Readonly<{
  incremental: boolean;
  runner: GateCommandRunner;
  testBatch: ReleaseTestBatchSession | null;
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

function validateIncrementalSelection(
  activeCheckIds: readonly string[] | undefined
): boolean {
  if (activeCheckIds === undefined) return false;
  const contractErrors = validateBaseGateImpactContracts();
  const baseCheckIdSet = new Set(baseGateCheckIds);
  const invalidSelection = activeCheckIds.some(
    (checkId) => !baseCheckIdSet.has(checkId)
  );
  if (contractErrors.length > 0 || invalidSelection) {
    throw new Error(
      contractErrors[0] ??
        "incremental Gate activation selected a non-base Check"
    );
  }
  return true;
}

function releaseTestBatch(
  release: boolean,
  dependencies: GateDefinitionDependencies,
  runner: GateCommandRunner
): ReleaseTestBatchSession | null {
  if (!release || dependencies.batchReleaseTests === false) return null;
  return createReleaseTestBatchSession(
    runner,
    releaseTestBatchGroups,
    dependencies.releaseTestBatchProof
  );
}

function runnerForCheck(
  checkId: string,
  context: GateCheckBuildContext
): GateCommandRunner {
  return context.testBatch?.has(checkId) === true
    ? context.testBatch.runnerFor(checkId)
    : context.runner;
}

function activationFlag(
  checkId: string,
  incremental: boolean
): string | undefined {
  return incremental ? activationFlagForCheck(checkId) : undefined;
}

function createSemanticChecks(
  context: GateCheckBuildContext
): readonly Check[] {
  return semanticGateChecks.map((check) => {
    const semantic = createSemanticGateCheck(
      check,
      runnerForCheck(check.checkId, context)
    );
    return enableGateCheckByFlag(
      batchedCheck(semantic, check.checkId, context.testBatch),
      check.requiredTag ?? activationFlag(check.checkId, context.incremental)
    );
  });
}

function createPackageChecks(context: GateCheckBuildContext): readonly Check[] {
  return releaseRequiredPackageScripts.map((script) => {
    const checkId = packageScriptCheckId(script);
    const packageCheck = createPackageScriptCheck(
      script,
      runnerForCheck(checkId, context)
    );
    return enableGateCheckByFlag(
      batchedCheck(packageCheck, checkId, context.testBatch),
      activationFlag(checkId, context.incremental)
    );
  });
}

function createAuthoredChecks(
  dependencies: GateDefinitionDependencies,
  context: GateCheckBuildContext
): readonly Check[] {
  const releaseState: ReleaseState = { prepared: undefined };
  const releasePrepareCheck = enableGateCheckByFlag(
    createReleasePrepareCheck(
      dependencies.baselineRef ?? "HEAD",
      dependencies.prepareRelease,
      releaseState
    ),
    "release"
  );
  return [
    releasePrepareCheck,
    ...(dependencies.nativeChecks ?? createVibeNativeChecks()).map((check) =>
      enableGateCheckByFlag(
        check,
        activationFlag(check.checkId, context.incremental)
      )
    ),
    ...createPackageChecks(context),
    ...createSemanticChecks(context),
    enableGateCheckByFlag(
      createReleaseVersionCheck(releaseState, releaseRequiredCheckIds),
      "release"
    ),
    enableGateCheckByFlag(
      createPackSkillsCheck(dependencies.packRelease, releaseState),
      "release"
    )
  ];
}

function createSchedulerStrategy(
  release: boolean,
  dependencies: GateDefinitionDependencies
) {
  return createLearnedCriticalPathStrategy({
    stateDirectory:
      dependencies.schedulingStateDirectory ??
      path.join(rootDir, ".log/vibe-check/cache/scheduler-history"),
    identityForTask: (task) => ({
      gateProfile: release ? "release" : "base",
      implementationVersion: learnedSchedulingVersion,
      taskId: task.taskId
    })
  });
}

export function createGateDefinition(
  activeTags: GateTagSet = [],
  dependencies: GateDefinitionDependencies = {}
): ProjectDefinition {
  const tags = normalizeGateTags(activeTags);
  const release = hasGateTag(tags, "release");
  const incremental = validateIncrementalSelection(dependencies.activeCheckIds);
  const runner = dependencies.runCommand ?? runGateCommand;
  const testBatch = releaseTestBatch(release, dependencies, runner);
  const authoredChecks = createAuthoredChecks(dependencies, {
    incremental,
    runner,
    testBatch
  });
  const checks = release
    ? authoredChecks.map((check) => releaseCpuCheck(check, testBatch))
    : authoredChecks;
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
      admissionPolicy: {
        kind: "custom",
        strategy: createSchedulerStrategy(release, dependencies)
      },
      maxParallel: 4,
      resourceCapacities: release
        ? releaseGateResourceCapacities
        : gateResourceCapacities
    }
  });
}
