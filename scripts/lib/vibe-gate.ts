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
  type GateTag,
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
  isReleaseOnlyGatePackageScript,
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

export {
  gateResourceCapacities,
  gateTags,
  hasGateTag,
  normalizeGateTags
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

const learnedSchedulingVersion = "gate-scheduler-v1";

export type GateDefinitionDependencies = Readonly<{
  baselineRef?: string;
  nativeChecks?: readonly Check[];
  packRelease?: ReleasePacker;
  prepareRelease?: ReleasePreparer;
  runCommand?: GateCommandRunner;
  schedulingStateDirectory?: string;
}>;

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
  requiredTag: GateTag | undefined
): Check<AuthoredOptions, PreparedOptions> {
  if (requiredTag === undefined) return check;
  return {
    ...check,
    enabledByFlags: {
      flags: [requiredTag],
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
  const runner = dependencies.runCommand ?? runGateCommand;
  const releaseState: ReleaseState = { prepared: undefined };
  const nativeChecks = dependencies.nativeChecks ?? createVibeNativeChecks();
  const semanticChecks = semanticGateChecks.map((check) =>
    enableGateCheckByFlag(
      createSemanticGateCheck(check, runner),
      check.requiredTag
    )
  );
  const packageChecks = releaseRequiredPackageScripts.map((script) =>
    enableGateCheckByFlag(
      createPackageScriptCheck(script, runner),
      isReleaseOnlyGatePackageScript(script) ? "release" : undefined
    )
  );
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
  const checks: Check[] = [
    releasePrepareCheck,
    ...nativeChecks,
    ...packageChecks,
    ...semanticChecks,
    releaseVersionCheck,
    packSkillsCheck
  ];
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
      resourceCapacities: gateResourceCapacities
    }
  });
}
