import { commandCheck } from "@zxyycom/vibe-check";
import {
  externalProcessClaim,
  gateCheckDeclaration,
  projectActivationCondition,
  type GateCheckConfiguration
} from "../contracts.ts";
import { gateCodeToolIds, type GateToolSubscription } from "../impact-tools.ts";
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
  "test:check": [
    "gate-tests",
    "decision-test-catalog",
    "investigation-test-catalog"
  ],
  "test:skill-updater": ["skill-updater"],
  "test:skill-validator": ["skill-validator"],
  "test:relation-graph": ["relation-graph", "relation-graph-tests"],
  "test:file-text-search": ["file-text-search", "file-text-search-tests"],
  "test:version-control": ["version-control"],
  "test:skill-package-hash": ["skill-package-hash"],
  "test:skill-release-publisher": ["skill-release-publisher"],
  typecheck: ["typescript-program"],
  lint: ["typescript-program"],
  validate: ["repository-validation", "skill-validator"],
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
  "check:test-evidence-catalog": [
    "repository-material",
    "decision-test-catalog",
    "investigation-test-catalog"
  ],
  "check:skill-updaters": ["generated-artifacts"],
  "test:generated-file": ["generated-file"],
  "format:check": ["repository-code"],
  "check:task-graph-index": ["task-graph"]
} as const satisfies Readonly<Record<GatePackageScript, GateToolSubscription>>;

// Providers establish the trust boundary for tests that import distributed files.
export const packageScriptDependencies: Readonly<
  Partial<Record<GatePackageScript, readonly GatePackageScriptCheckId[]>>
> = {
  "test:skill-updater": ["script:check:skill-updaters"],
  "test:skill-validator": ["script:check:skill-updaters"]
};

// Keep the generated packages next to the consumers that import them.
export const packageScriptGenerationSkillNames: Readonly<
  Partial<Record<GatePackageScript, readonly string[]>>
> = {
  "test:skill-updater": ["ai-ready-docs"],
  "test:skill-validator": ["skill-maintainer"]
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
  const generationSkillNames =
    script === "check:skill-updaters" && configuration.scope === "selected"
      ? configuration.generationSkillNames
      : undefined;
  return commandCheck({
    checkId,
    displayName:
      script === "test:environment"
        ? "Repository bootstrap and maintenance wiring"
        : script === "check:skill-updaters"
          ? generationSkillNames === undefined
            ? "All skill runtime generation consistency"
            : "Selected skill runtime generation consistency"
          : `Script: ${script}`,
    ...gateCheckDeclaration(
      checkId,
      configuration,
      externalProcessClaim,
      packageScriptDependencies[script],
      projectActivationCondition(
        configuration.scope === "selected" &&
          (script === "typecheck" ||
            script === "lint" ||
            script === "format:check")
          ? gateCodeToolIds
          : packageScriptToolSubscriptions[script],
        configuration
      )
    ),
    ...gateCommandPolicy,
    executable: "bun",
    arguments: [
      "run",
      script,
      ...(generationSkillNames?.flatMap((name) => ["--skill", name]) ?? [])
    ]
  });
}
