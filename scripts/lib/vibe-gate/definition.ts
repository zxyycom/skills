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
  type GateCheckConfiguration,
  type GateTagSet
} from "./contracts.ts";
import {
  createGateEnvironmentCheck,
  gateEnvironmentCheckId
} from "./checks/environment.ts";
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
  type ReleasePreparer
} from "./checks/release.ts";
import type { GateScope } from "./profiles.ts";
import { gateToolInputs, type GateToolId } from "./impact-tools.ts";
import { resolveSelectedRuntimeSkills } from "./runtime-prerequisites.ts";
import { validateBaseGateImpactContracts } from "./impact.ts";

export type GateDefinitionDependencies = Readonly<{
  activeToolIds?: readonly string[];
  selectionScopes?: readonly GateToolId[];
  scope?: GateScope;
  baselineRef?: string;
  nativeChecks?: readonly Check[];
  packRelease?: ReleasePacker;
  prepareRelease?: ReleasePreparer;
  schedulingStateDirectory?: string;
}>;

export const releaseRequiredCheckIds = [
  gateEnvironmentCheckId,
  ...vibeNativeCheckIds,
  ...releaseRequiredPackageScripts.map(packageScriptCheckId),
  ...semanticGateChecks.map(({ checkId }) => checkId)
] as const;

export function gateCheckIds(): readonly string[] {
  return [
    gateEnvironmentCheckId,
    releaseSnapshotCheckId,
    ...vibeNativeCheckIds,
    ...releaseRequiredPackageScripts.map(packageScriptCheckId),
    ...semanticGateChecks.map(({ checkId }) => checkId),
    releaseVersionCheckId,
    packSkillsCheckId
  ];
}

function validateIncrementalSelection(
  activeToolIds: readonly string[] | undefined
): boolean {
  if (activeToolIds === undefined) return false;
  const errors = validateBaseGateImpactContracts();
  const allowed = new Set(Object.keys(gateToolInputs));
  if (errors.length > 0 || activeToolIds.some((id) => !allowed.has(id))) {
    throw new Error(
      errors[0] ?? "incremental Gate activation selected an unknown tool"
    );
  }
  return true;
}

function resolveGateCheckConfiguration(
  activeTags: GateTagSet,
  dependencies: GateDefinitionDependencies
): GateCheckConfiguration {
  const release = hasGateTag(normalizeGateTags(activeTags), "release");
  let generationSkillNames: readonly string[] | undefined;
  if (dependencies.scope === "selected") {
    const scopes = dependencies.selectionScopes;
    if (
      release ||
      scopes === undefined ||
      scopes.length === 0 ||
      scopes.some((id) => !Object.hasOwn(gateToolInputs, id))
    )
      throw new Error(
        "selected Gate scope requires known capability groups without release"
      );
    generationSkillNames = resolveSelectedRuntimeSkills(scopes);
  }
  return {
    environmentPrerequisite: true,
    ...(dependencies.scope === undefined ? {} : { scope: dependencies.scope }),
    incremental: validateIncrementalSelection(dependencies.activeToolIds),
    ...(generationSkillNames === undefined ? {} : { generationSkillNames }),
    release
  };
}

export function createGateDefinition(
  activeTags: GateTagSet = [],
  dependencies: GateDefinitionDependencies = {}
): ProjectDefinition {
  const configuration = resolveGateCheckConfiguration(activeTags, dependencies);
  const release = configuration.release === true;
  const prepare = createReleasePrepareCheck(
    dependencies.baselineRef ?? "HEAD",
    dependencies.prepareRelease,
    configuration
  );
  const authorization = createReleaseVersionCheck(
    prepare,
    releaseRequiredCheckIds,
    configuration
  );
  return defineConfig({
    checks: [
      createGateEnvironmentCheck(configuration),
      prepare,
      ...(dependencies.nativeChecks ??
        createVibeNativeChecks(rootDir, configuration)),
      ...releaseRequiredPackageScripts.map((script) =>
        createPackageScriptCheck(script, configuration)
      ),
      ...semanticGateChecks.map((check) =>
        createSemanticGateCheck(check, configuration)
      ),
      authorization,
      createPackSkillsCheck(
        dependencies.packRelease,
        authorization,
        configuration
      )
    ],
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
        strategy: createLearnedCriticalPathStrategy({
          stateDirectory:
            dependencies.schedulingStateDirectory ??
            path.join(rootDir, ".log/vibe-check/cache/scheduler-history"),
          identityForTask: (task) => ({
            gateProfile: release ? "release" : "base",
            implementationVersion: "gate-native-command-v5",
            taskId: task.taskId,
            runtime: {
              node: process.version,
              platform: process.platform,
              arch: process.arch
            },
            capacity: release
              ? releaseGateResourceCapacities
              : gateResourceCapacities
          })
        })
      },
      maxParallel: 4,
      resourceCapacities: release
        ? releaseGateResourceCapacities
        : gateResourceCapacities
    }
  });
}
