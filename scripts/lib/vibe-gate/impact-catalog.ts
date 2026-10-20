import { vibeNativeCheckIds } from "./checks/native.ts";
import { gateEnvironmentCheckId } from "./checks/environment.ts";
import {
  packageScriptCheckId,
  releaseRequiredPackageScripts
} from "./checks/package-script.ts";
import {
  packSkillsCheckId,
  releaseSnapshotCheckId,
  releaseVersionCheckId
} from "./checks/release.ts";
import { semanticGateChecks } from "./checks/semantic.ts";
import { commonGateInputPatterns } from "./impact-paths.ts";
import type { GateWorkspaceSnapshot } from "./impact-snapshot.ts";
import { compareText, sha256 } from "./impact-values.ts";

export const gateImpactContractVersion = "project-input-receipts-v3";

export type GateCheckImpactContract = Readonly<{
  checkId: string;
  patterns: readonly string[];
  version: string;
}>;

// Shared feature inputs follow actual imports, including their transitive local modules.
// New imports into another shared feature require the consuming owner declaration to change.
const domainInputs: Readonly<Record<string, readonly string[]>> = {
  "change-plan": [
    "tools/change-plan/**",
    "skills/change-plan/**",
    "changes/**"
  ],
  "decision-records": [
    "tools/decision-records/**",
    "skills/decision-records/**",
    "docs/decisions/**",
    "tools/shared/src/file-text-search/**",
    "tools/shared/src/graph/**"
  ],
  "investigation-report": [
    "tools/investigation-report/**",
    "skills/investigation-report/**",
    "docs/investigations/**",
    "tools/shared/src/file-text-search/**",
    "tools/shared/src/graph/**"
  ],
  "task-graph": [
    "tools/task-graph/**",
    "skills/task-graph/**",
    "docs/task-graph/**"
  ],
  "test-evidence": [
    "tools/test-evidence/**",
    "skills/test-evidence-review/**",
    "docs/test-evidence/**",
    "tools/shared/src/file-text-search/**",
    "!tools/shared/src/file-text-search/record-search-output.ts"
  ],
  "novel-cards": ["tools/novel-cards/**", "skills/novel-cards/**"],
  "lightweight-judgment": [
    "tools/lightweight-judgment/**",
    "skills/lightweight-judgment/**"
  ],
  mcpshell: [
    "tools/mcpshell-workspace-bridge/**",
    "skills/mcpshell-workspace-tools/**"
  ],
  "skill-validator": [
    "tools/skill-validator/**",
    "skills/skill-maintainer/**",
    "skills/**/SKILL.md"
  ]
};

const codeInputs = [...commonGateInputPatterns, "tools/**"];

const projectInputs: Readonly<Record<string, readonly string[]>> = {
  // Broad repository consumers cover all material, not just source extensions.
  "script:validate": ["**"],
  "script:check:test-evidence-catalog": ["**"],
  "script:test:check": [...commonGateInputPatterns, "tools/*/tests/**"],
  "script:test:environment": commonGateInputPatterns,
  "script:check:skill-updaters": [...codeInputs, "skills/**"],
  "script:typecheck": codeInputs,
  "script:lint": codeInputs,
  "script:format:check": codeInputs,
  // The updater tests import and copy this real distribution fixture (tests/support.ts).
  "script:test:skill-updater": [
    ...commonGateInputPatterns,
    "skills/ai-ready-docs/**"
  ],
  // Shared utility and release tests consume their fixtures and project adapters.
  "script:test:index-runtime": commonGateInputPatterns,
  "script:test:relation-graph": [
    ...commonGateInputPatterns,
    "tools/shared/src/graph/**"
  ],
  "script:test:file-text-search": [
    ...commonGateInputPatterns,
    "tools/shared/src/file-text-search/**",
    "!tools/shared/src/file-text-search/record-search-output.ts"
  ],
  "script:test:version-control": commonGateInputPatterns,
  "script:test:generated-file": codeInputs,
  "script:test:skill-package-hash": commonGateInputPatterns,
  "script:test:skill-release-publisher": commonGateInputPatterns
};

function inputPatterns(checkId: string): readonly string[] {
  const projectInput = projectInputs[checkId];
  if (projectInput !== undefined) return projectInput;
  const owner = Object.keys(domainInputs).find(
    (name) =>
      checkId.includes(name) ||
      (name === "investigation-report" &&
        checkId === "script:check:investigations") ||
      (name === "decision-records" && checkId === "script:check:decisions")
  );
  if (owner !== undefined)
    return [...commonGateInputPatterns, ...domainInputs[owner]!];
  // A newly added Check without a reviewed closure must never reuse a proof.
  return [];
}

export const baseGateImpactContracts: readonly GateCheckImpactContract[] =
  Object.freeze(
    [
      ...releaseRequiredPackageScripts.map(packageScriptCheckId),
      ...semanticGateChecks
        .filter(
          (check) =>
            !("requiredTag" in check) || check.requiredTag === undefined
        )
        .map(({ checkId }) => checkId)
    ].map((checkId) => ({
      checkId,
      patterns: inputPatterns(checkId),
      version: "1"
    }))
  );

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
      contractVersion: gateImpactContractVersion,
      inputDigest: snapshot.inputDigests[contract_.checkId],
      patterns: contract_.patterns,
      toolchainFingerprint: snapshot.toolchainFingerprint,
      version: contract_.version
    })
  ]);
}

export function validateBaseGateImpactContracts(): readonly string[] {
  const expected = [
    ...releaseRequiredPackageScripts.map(packageScriptCheckId),
    ...semanticGateChecks
      .filter(
        (check) => !("requiredTag" in check) || check.requiredTag === undefined
      )
      .map(({ checkId }) => checkId)
  ].sort(compareText);
  const actual = [...baseGateCheckIds].sort(compareText);
  return expected.length === actual.length &&
    expected.every((checkId, index) => checkId === actual[index])
    ? []
    : [
        "project input contracts do not exactly cover the project Check catalog"
      ];
}
