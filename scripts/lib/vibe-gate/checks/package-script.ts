import { commandCheck } from "@zxyycom/vibe-check";
import {
  externalProcessClaim,
  gateCheckDeclaration,
  projectActivationCondition,
  type GateCheckConfiguration
} from "../contracts.ts";
import type { GateToolSubscription } from "../impact-tools.ts";
import { gateCommandPolicy } from "../command-runner.ts";

export const compatibilityTestPackageScripts = [
  "test:decision-records-cli",
  "test:change-plan-cli",
  "test:task-graph-cli",
  "test:test-evidence-cli",
  "test:investigation-report-check"
] as const;

// Package scripts remain stable manual aggregation entry points. Gate execution
// uses the separate semantic catalog instead of treating those containers as leaves.
export const releaseRequiredPackageScripts = [
  "test:environment",
  "test:index-runtime",
  "test:check",
  "test:skill-updater",
  "test:skill-validator",
  "test:relation-graph",
  "test:file-text-search",
  "test:version-control",
  "test:skill-package-hash",
  "test:skill-release-publisher",
  "typecheck",
  "lint",
  "validate",
  "check:investigations",
  "check:decisions",
  "check:test-evidence-catalog",
  "check:skill-updaters",
  "test:generated-file",
  "format:check",
  "check:task-graph-index"
] as const;

export type GatePackageScript = (typeof releaseRequiredPackageScripts)[number];

export type GatePackageScriptCheckId = `script:${GatePackageScript}`;

export const packageScriptToolSubscriptions = {
  "test:environment": ["environment"],
  "test:index-runtime": ["index-runtime"],
  "test:check": ["gate-tests"],
  "test:skill-updater": ["skill-updater"],
  "test:skill-validator": ["skill-validator"],
  "test:relation-graph": ["relation-graph", "relation-graph-tests"],
  "test:file-text-search": ["file-text-search", "file-text-search-tests"],
  "test:version-control": ["version-control"],
  "test:skill-package-hash": ["skill-package-hash"],
  "test:skill-release-publisher": ["skill-release-publisher"],
  typecheck: ["repository-code"],
  lint: ["repository-code"],
  validate: ["repository-validation"],
  "check:investigations": [
    "investigation-record",
    "investigation-query",
    "investigation-maintenance",
    "investigation-stage",
    "investigation-cli",
    "investigation-collection",
    "file-text-search",
    "relation-graph"
  ],
  "check:decisions": [
    "decision-record",
    "decision-query",
    "decision-maintenance",
    "decision-stage",
    "decision-cli",
    "decision-collection",
    "file-text-search",
    "relation-graph"
  ],
  "check:test-evidence-catalog": ["repository-material"],
  "check:skill-updaters": ["generated-artifacts"],
  "test:generated-file": ["generated-file"],
  "format:check": ["repository-code"],
  "check:task-graph-index": ["task-graph"]
} as const satisfies Readonly<Record<GatePackageScript, GateToolSubscription>>;

// Providers establish the trust boundary for tests that import distributed files.
export const packageScriptDependencies: Readonly<
  Partial<Record<GatePackageScript, readonly GatePackageScriptCheckId[]>>
> = {
  "test:skill-updater": ["script:check:skill-updaters"]
};

export function packageScriptCheckId(
  script: GatePackageScript
): GatePackageScriptCheckId {
  return `script:${script}`;
}

export function createPackageScriptCheck(
  script: GatePackageScript,
  configuration: GateCheckConfiguration = {}
) {
  const checkId = packageScriptCheckId(script);
  return commandCheck({
    checkId,
    displayName: `Script: ${script}`,
    ...gateCheckDeclaration(
      checkId,
      configuration,
      externalProcessClaim,
      packageScriptDependencies[script],
      projectActivationCondition(
        packageScriptToolSubscriptions[script],
        configuration
      )
    ),
    ...gateCommandPolicy,
    executable: "bun",
    arguments: ["run", script]
  });
}
