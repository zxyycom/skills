import { vibeNativeCheckIds } from "./checks/native.ts";
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
import type { GateWorkspaceSnapshot } from "./impact-snapshot.ts";
import { compareText, sha256 } from "./impact-values.ts";

export const gateImpactContractVersion = "incremental-gate-v2";

export type GateImpactTag =
  | "build-system"
  | "change-plan"
  | "decision-records"
  | "documentation"
  | "environment"
  | "global"
  | "index-runtime"
  | "investigation-report"
  | "json"
  | "maintained-code"
  | "markdown"
  | "path-inventory"
  | "secret-surface"
  | "shared-tools"
  | "skill-release"
  | "skill-updater"
  | "skill-validator"
  | "skills"
  | "task-graph"
  | "test-evidence";

export type GateCheckImpactContract = Readonly<{
  checkId: string;
  inputTags: readonly GateImpactTag[];
  version: string;
}>;

export const allImpactTags = [
  "build-system",
  "change-plan",
  "decision-records",
  "documentation",
  "environment",
  "global",
  "index-runtime",
  "investigation-report",
  "json",
  "maintained-code",
  "markdown",
  "path-inventory",
  "secret-surface",
  "shared-tools",
  "skill-release",
  "skill-updater",
  "skill-validator",
  "skills",
  "task-graph",
  "test-evidence"
] as const satisfies readonly GateImpactTag[];

const tagDependencies: Readonly<
  Partial<Record<GateImpactTag, readonly GateImpactTag[]>>
> = Object.freeze({
  "build-system": ["shared-tools"],
  "change-plan": ["build-system", "shared-tools"],
  "decision-records": ["build-system", "index-runtime", "shared-tools"],
  environment: ["shared-tools", "skill-release"],
  "index-runtime": ["shared-tools"],
  "investigation-report": ["build-system", "index-runtime", "shared-tools"],
  "skill-release": ["shared-tools"],
  "skill-updater": ["build-system", "shared-tools", "skill-release"],
  "skill-validator": ["build-system", "shared-tools"],
  "task-graph": ["build-system", "shared-tools"],
  "test-evidence": ["build-system", "index-runtime", "shared-tools"]
});

const contract = (
  checkId: string,
  inputTags: readonly GateImpactTag[]
): GateCheckImpactContract => ({
  checkId,
  inputTags,
  version: "1"
});

const packageContracts = [
  contract("script:test:environment", [
    "environment",
    "shared-tools",
    "skill-release"
  ]),
  contract("script:test:index-runtime", ["index-runtime"]),
  contract("script:test:check", ["global"]),
  contract("script:test:skill-updater", ["skill-updater", "skill-release"]),
  contract("script:test:skill-validator", ["skill-validator"]),
  contract("script:test:relation-graph", ["shared-tools"]),
  contract("script:test:file-text-search", ["shared-tools"]),
  contract("script:test:version-control", ["shared-tools"]),
  contract("script:test:skill-package-hash", ["build-system", "skill-release"]),
  contract("script:test:skill-release-publisher", ["skill-release"]),
  contract("script:typecheck", ["maintained-code"]),
  contract("script:lint", ["maintained-code"]),
  contract("script:validate", [
    "shared-tools",
    "skill-release",
    "skill-validator",
    "skills"
  ]),
  contract("script:check:investigations", ["investigation-report"]),
  contract("script:check:decisions", ["decision-records"]),
  contract("script:check:test-evidence-cli", ["test-evidence"]),
  contract("script:check:test-evidence-catalog", [
    "maintained-code",
    "skills",
    "test-evidence"
  ]),
  contract("script:check:skill-validator", ["skill-validator"]),
  contract("script:check:investigation-report-check", ["investigation-report"]),
  contract("script:check:change-plan-cli", ["change-plan"]),
  contract("script:check:decision-records-cli", ["decision-records"]),
  contract("script:check:task-graph-cli", ["task-graph"]),
  contract("script:check:skill-updaters", ["skill-release", "skill-updater"]),
  contract("script:test:generated-file", ["build-system", "shared-tools"]),
  contract("script:format:check", ["maintained-code"]),
  contract("script:check:task-graph-index", ["task-graph"])
] as const;

const nativeContracts = [
  contract("duplicate-detection", ["maintained-code"]),
  contract("secret-detection", ["secret-surface"]),
  contract("json-validation", ["json"]),
  contract("json-schema-validation", ["task-graph", "test-evidence"]),
  contract("markdown-link-validation", ["markdown", "path-inventory"]),
  contract("file-metrics", ["maintained-code"]),
  contract("function-metrics", ["maintained-code"])
] as const;

function semanticImpactTags(checkId: string): readonly GateImpactTag[] {
  if (checkId.startsWith("test:change-plan:")) return ["change-plan"];
  if (checkId.startsWith("test:decision-records:")) {
    return ["decision-records"];
  }
  if (checkId.startsWith("test:investigation-report:")) {
    return ["investigation-report"];
  }
  if (checkId.startsWith("test:task-graph:")) return ["task-graph"];
  if (checkId.startsWith("test:test-evidence:")) return ["test-evidence"];
  return ["global"];
}

const semanticContracts = semanticGateChecks.map(({ checkId }) =>
  contract(checkId, semanticImpactTags(checkId))
);

export const baseGateImpactContracts = Object.freeze([
  ...nativeContracts,
  ...packageContracts,
  ...semanticContracts
]);

export const baseGateCheckIds = Object.freeze(
  baseGateImpactContracts.map(({ checkId }) => checkId)
);

export const releaseGateCheckIds = Object.freeze([
  releaseSnapshotCheckId,
  ...vibeNativeCheckIds,
  ...releaseRequiredPackageScripts.map(packageScriptCheckId),
  ...semanticGateChecks.map(({ checkId }) => checkId),
  releaseVersionCheckId,
  packSkillsCheckId
]);

function effectiveTagsForContract(
  contract_: GateCheckImpactContract
): readonly GateImpactTag[] {
  const effective = new Set<GateImpactTag>(["global"]);
  const visit = (tag: GateImpactTag): void => {
    if (effective.has(tag)) return;
    effective.add(tag);
    for (const dependency of tagDependencies[tag] ?? []) visit(dependency);
  };
  for (const tag of contract_.inputTags) visit(tag);
  return [...effective].sort(compareText);
}

export function gateCheckInputFingerprint(
  contract_: GateCheckImpactContract,
  snapshot: GateWorkspaceSnapshot
): string {
  return sha256([
    JSON.stringify({
      checkId: contract_.checkId,
      contractVersion: gateImpactContractVersion,
      inputs: effectiveTagsForContract(contract_).map((tag) => [
        tag,
        snapshot.tagDigests[tag]
      ]),
      toolchainFingerprint: snapshot.toolchainFingerprint,
      version: contract_.version
    })
  ]);
}

export function validateBaseGateImpactContracts(): readonly string[] {
  const expected = [
    ...vibeNativeCheckIds,
    ...releaseRequiredPackageScripts.map(packageScriptCheckId),
    ...semanticGateChecks
      .filter(({ requiredTag }) => requiredTag === undefined)
      .map(({ checkId }) => checkId)
  ].sort(compareText);
  const actual = [...baseGateCheckIds].sort(compareText);
  return expected.length === actual.length &&
    expected.every((checkId, index) => checkId === actual[index])
    ? []
    : [
        "base Gate impact contracts do not exactly cover the base Check catalog"
      ];
}
