import { commandCheck } from "@zxyycom/vibe-check";
import {
  externalProcessClaim,
  gateCheckDeclaration,
  projectActivationFlag,
  type GateCheckConfiguration
} from "../contracts.ts";
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
      projectActivationFlag(checkId, configuration)
    ),
    ...gateCommandPolicy,
    executable: "bun",
    arguments: ["run", script]
  });
}
