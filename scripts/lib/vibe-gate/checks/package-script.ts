import { defineCheck } from "@zxyycom/vibe-check";
import type { Check } from "@zxyycom/vibe-check";
import { externalProcessClaim } from "../contracts.ts";
import {
  executeGateCommand,
  type GateCommandRunner
} from "../command-runner.ts";

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
  "test:test-evidence-project",
  "typecheck",
  "lint",
  "validate",
  "check:investigations",
  "check:decisions",
  "check:test-evidence-cli",
  "check:test-evidence-catalog",
  "check:skill-validator",
  "check:investigation-report-check",
  "check:change-plan-cli",
  "check:decision-records-cli",
  "check:task-graph-cli",
  "check:skill-updaters",
  "test:generated-file",
  "format:check",
  "check:task-graph-index"
] as const;

export type GatePackageScript = (typeof releaseRequiredPackageScripts)[number];

export type GatePackageScriptCheckId = `script:${GatePackageScript}`;

export function packageScriptCheckId(
  script: GatePackageScript
): GatePackageScriptCheckId {
  return `script:${script}`;
}

const releaseOnlyGatePackageScripts: ReadonlySet<GatePackageScript> = new Set([
  "test:version-control",
  "test:skill-package-hash"
]);

export function isReleaseOnlyGatePackageScript(
  script: GatePackageScript
): boolean {
  return releaseOnlyGatePackageScripts.has(script);
}

export function createPackageScriptCheck(
  script: GatePackageScript,
  runner: GateCommandRunner
): Check {
  return defineCheck({
    checkId: packageScriptCheckId(script),
    displayName: `Script: ${script}`,
    resourceClaims: externalProcessClaim,
    async execution({ artifactDirectory, project, signal }) {
      return await executeGateCommand({
        artifactDirectory,
        command: { args: ["run", script], command: "bun" },
        projectRoot: project.root,
        runner,
        context: { kind: "package-script", script },
        signal
      });
    }
  });
}
