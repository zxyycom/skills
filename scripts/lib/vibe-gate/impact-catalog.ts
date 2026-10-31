import { vibeNativeCheckIds } from "./checks/native.ts";
import { gateEnvironmentCheckId } from "./checks/environment.ts";
import {
  packageScriptCheckId,
  packageScriptDependencies,
  packageScriptToolSubscriptions,
  releaseRequiredPackageScripts
} from "./checks/package-script.ts";
import {
  packSkillsCheckId,
  releaseSnapshotCheckId,
  releaseVersionCheckId
} from "./checks/release.ts";
import { semanticGateChecks } from "./checks/semantic.ts";
import {
  gateToolInputs,
  markdownLintToolSubscription,
  type GateToolId,
  type GateToolSubscription
} from "./impact-tools.ts";
import type { GateWorkspaceSnapshot } from "./impact-snapshot.ts";
import { compareText, sha256 } from "./impact-values.ts";

export const gateImpactContractVersion = "project-tool-receipts-v9";

export type GateCheckImpactContract = Readonly<{
  checkId: string;
  dependsOn: readonly string[];
  toolIds: GateToolSubscription;
  version: string;
}>;

const semanticCheckContractVersions: Readonly<Record<string, string>> = {
  "test:decision-records:record-and-established-graph": "3",
  "test:decision-records:query-and-index-projection": "3",
  "test:decision-records:lifecycle-and-recovery": "3",
  "test:investigation-report:index-and-query": "2",
  "test:investigation-report:transactional-maintenance": "2"
};

export const baseGateImpactContracts: readonly GateCheckImpactContract[] =
  Object.freeze([
    {
      checkId: "markdown-lint",
      dependsOn: [],
      toolIds: markdownLintToolSubscription,
      version: "1"
    },
    ...releaseRequiredPackageScripts.map((script) => ({
      checkId: packageScriptCheckId(script),
      dependsOn: packageScriptDependencies[script] ?? [],
      toolIds: packageScriptToolSubscriptions[script],
      version: "1"
    })),
    ...semanticGateChecks
      .filter(
        (check) => !("requiredTag" in check) || check.requiredTag === undefined
      )
      .map((check) => ({
        checkId: check.checkId,
        dependsOn: "dependsOn" in check ? (check.dependsOn ?? []) : [],
        toolIds: check.toolIds,
        version:
          semanticCheckContractVersions[check.checkId] ??
          (check.checkId.startsWith("test:decision-records:") ? "2" : "1")
      }))
  ]);

export function gateToolInputFingerprint(
  toolId: GateToolId,
  snapshot: GateWorkspaceSnapshot
): string {
  return sha256([
    JSON.stringify({
      contractVersion: gateImpactContractVersion,
      inputDigest: snapshot.toolInputDigests[toolId],
      patterns: gateToolInputs[toolId],
      toolId,
      toolchainFingerprint: snapshot.toolchainFingerprint
    })
  ]);
}

export function gateCheckToolFingerprints(
  contract_: GateCheckImpactContract,
  snapshot: GateWorkspaceSnapshot
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    contract_.toolIds.map((toolId) => [
      toolId,
      gateToolInputFingerprint(toolId, snapshot)
    ])
  );
}

export const baseGateCheckIds = Object.freeze(
  baseGateImpactContracts.map(({ checkId }) => checkId)
);
export const releaseGateCheckIds = Object.freeze([
  gateEnvironmentCheckId,
  releaseSnapshotCheckId,
  ...vibeNativeCheckIds,
  ...releaseRequiredPackageScripts.map(packageScriptCheckId),
  ...semanticGateChecks.map(({ checkId }) => checkId),
  releaseVersionCheckId,
  packSkillsCheckId
]);

export function gateCheckInputFingerprint(
  contract_: GateCheckImpactContract,
  snapshot: GateWorkspaceSnapshot
): string {
  return sha256([
    JSON.stringify({
      checkId: contract_.checkId,
      dependsOn: contract_.dependsOn,
      contractVersion: gateImpactContractVersion,
      toolFingerprints: gateCheckToolFingerprints(contract_, snapshot),
      toolIds: contract_.toolIds,
      toolchainFingerprint: snapshot.toolchainFingerprint,
      version: contract_.version
    })
  ]);
}

export function validateBaseGateImpactContracts(): readonly string[] {
  const expected = [
    "markdown-lint",
    ...releaseRequiredPackageScripts.map(packageScriptCheckId),
    ...semanticGateChecks
      .filter(
        (check) => !("requiredTag" in check) || check.requiredTag === undefined
      )
      .map(({ checkId }) => checkId)
  ].sort(compareText);
  const actual = [...baseGateCheckIds].sort(compareText);
  const invalidSubscription = baseGateImpactContracts.some(
    ({ toolIds }) =>
      toolIds.length === 0 ||
      new Set(toolIds).size !== toolIds.length ||
      toolIds.some((toolId) => !Object.hasOwn(gateToolInputs, toolId))
  );
  return !invalidSubscription &&
    expected.length === actual.length &&
    expected.every((checkId, index) => checkId === actual[index])
    ? []
    : [
        "project input contracts do not exactly cover the project Check catalog"
      ];
}
