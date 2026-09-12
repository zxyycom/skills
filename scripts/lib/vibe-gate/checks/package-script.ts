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

export const releaseBunTestPackageFiles = {
  "test:environment": [
    "./scripts/auto-push.test.ts",
    "./scripts/environment.test.ts",
    "./scripts/validators/project-config.test.ts"
  ],
  "test:index-runtime": ["./tools/index-runtime/tests/run.ts"],
  "test:skill-updater": ["./tools/skill-updater/tests/run.ts"],
  "test:skill-validator": ["./tools/skill-validator/tests/run.ts"],
  "test:relation-graph": ["./tools/shared/tests/relation-graph.test.ts"],
  "test:file-text-search": ["./tools/shared/tests/file-text-search.test.ts"],
  "test:skill-package-hash": ["./scripts/lib/skill-package-hash.test.ts"],
  "test:skill-release-publisher": ["./scripts/publish-skills.test.ts"],
  "test:generated-file": ["./scripts/lib/generated-file.test.ts"]
} as const satisfies Partial<
  Readonly<Record<GatePackageScript, readonly string[]>>
>;

export function packageScriptCheckId(
  script: GatePackageScript
): GatePackageScriptCheckId {
  return `script:${script}`;
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
