import fs from "node:fs/promises";
import path from "node:path";
import { checkPackageScripts } from "../lib/check-plan.ts";
import {
  formatPackageScripts,
  lintPackageScripts,
  validateOxcConfigurationFiles
} from "../lib/oxc-config.ts";
import { rootDir } from "../lib/project.ts";
import type { SkillPackage } from "../lib/project.ts";
import type { ReportValidationError } from "../lib/validation.ts";
import { pathExists } from "../../tools/shared/src/node/filesystem.ts";
import {
  readSkillVersionFromMarkdown,
  skillEntryFileName
} from "../../tools/skill-package/src/version.ts";

type PermissionDecision = "allow" | "prompt";

type PermissionRule = {
  command: readonly string[];
  decision: PermissionDecision;
};

export const maintenanceCliPackageScripts = {
  "change-plan": "node skills/change-plan/scripts/change-plan.mjs",
  "decision-records":
    "node skills/decision-records/scripts/decision-records.mjs",
  "investigation-report":
    "node skills/investigation-report/scripts/check-investigations.mjs",
  "task-graph": "node scripts/task-graph.js",
  "test-evidence":
    "node skills/test-evidence-review/scripts/test-evidence-catalog.mjs",
  "validate-skill": "node skills/skill-maintainer/scripts/validate-skill.mjs"
} as const satisfies Readonly<Record<string, string>>;

export type MaintenanceCliCommand = keyof typeof maintenanceCliPackageScripts;

export const requiredPackageScripts = [
  ...checkPackageScripts,
  "fix",
  "format",
  "lint:fix",
  "setup-hooks",
  "setup-repository",
  "sync:skill-updaters",
  "sync:change-plan-cli",
  "sync:skill-validator",
  "sync:investigation-report-check",
  "sync:decision-records-cli",
  "sync:task-graph-cli",
  "sync:test-evidence-cli",
  "sync:test-evidence-catalog",
  "vibe-check",
  "check"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const requiredProjectFiles = [
  "skills",
  "README.md",
  "AGENTS.md",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  ".codex/rules/bun.rules",
  "scripts/check.ts",
  "scripts/environment.js",
  "scripts/setup-git-hooks.js",
  "scripts/setup-repository.js",
  "scripts/task-graph.js",
  "scripts/lint.ts",
  "scripts/vibe-check.ts",
  "docs/tooling.md",
  "docs/skills",
  ".githooks/pre-commit",
  ".github/workflows/package-skills.yml"
] as const;

const requiredPermissionRules = [
  { command: ["bun", "run", "setup-hooks"], decision: "prompt" },
  { command: ["bun", "run", "setup-repository"], decision: "prompt" },
  { command: ["node", "scripts/environment.js", "check"], decision: "allow" },
  { command: ["node", "scripts/environment.js", "setup"], decision: "prompt" },
  { command: ["node", "scripts/setup-git-hooks.js"], decision: "prompt" },
  { command: ["node", "scripts/setup-repository.js"], decision: "prompt" }
] as const satisfies readonly PermissionRule[];

// Build removed paths from segments so active-source searches cannot mistake
// the validator's deny list for another copyable command reference.
const forbiddenPermissionRuleReferences = [
  ["scripts", ["env", "js"].join(".")].join("/"),
  ["scripts", ["setup-git-hooks", "ts"].join(".")].join("/")
] as const;

const forbiddenBlanketPermissionRules = [
  ["bun", "run", "task-graph"],
  ["node", "scripts/task-graph.js"]
] as const;

const forbiddenPackageStateFiles = [
  "skill-package.hash",
  "skill-package-lock.json"
] as const;

export async function validatePackageScripts(
  report: ReportValidationError,
  workspaceRoot: string = rootDir
): Promise<void> {
  const packageJsonPath = path.join(workspaceRoot, "package.json");
  if (!(await pathExists(packageJsonPath))) {
    report(
      "package.json is required for local validation and packaging scripts"
    );
    return;
  }

  let packageJson: unknown;
  try {
    packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  } catch (error) {
    report(
      `package.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
    return;
  }
  if (!isRecord(packageJson) || !isRecord(packageJson.scripts)) {
    report("package.json scripts must be an object");
    return;
  }

  for (const scriptName of requiredPackageScripts) {
    if (typeof packageJson.scripts[scriptName] !== "string") {
      report(`package.json is missing script ${scriptName}`);
    }
  }
  for (const [scriptName, expectedCommand] of Object.entries(
    maintenanceCliPackageScripts
  )) {
    if (packageJson.scripts[scriptName] !== expectedCommand) {
      report(
        `package.json script ${scriptName} must delegate to ${expectedCommand}`
      );
    }
  }
  for (const [scriptName, expectedCommand] of Object.entries(
    formatPackageScripts
  )) {
    if (packageJson.scripts[scriptName] !== expectedCommand) {
      report(
        `package.json script ${scriptName} must be ${expectedCommand}; ` +
          "restore the repository Oxfmt command"
      );
    }
  }
  for (const [scriptName, expectedCommand] of Object.entries(
    lintPackageScripts
  )) {
    if (packageJson.scripts[scriptName] !== expectedCommand) {
      report(
        `package.json script ${scriptName} must be ${expectedCommand}; ` +
          "restore the repository Oxlint preflight command"
      );
    }
  }
}

export async function validateRequiredProjectFiles(
  report: ReportValidationError,
  workspaceRoot: string = rootDir
): Promise<void> {
  for (const relativePath of requiredProjectFiles) {
    if (!(await pathExists(path.join(workspaceRoot, relativePath)))) {
      report(`${relativePath} is required`);
    }
  }

  for (const relativePath of forbiddenPackageStateFiles) {
    if (await pathExists(path.join(workspaceRoot, relativePath))) {
      report(
        `${relativePath} must not exist; calculate package hashes on demand with hash:skills`
      );
    }
  }
}

export { validateOxcConfigurationFiles };

function permissionRuleSource(rule: PermissionRule): string {
  const pattern = rule.command.map((part) => JSON.stringify(part)).join(", ");
  return `prefix_rule(pattern=[${pattern}], decision="${rule.decision}")`;
}

export async function validateRepositoryPermissionRules(
  report: ReportValidationError,
  workspaceRoot: string = rootDir
): Promise<void> {
  const relativePath = ".codex/rules/bun.rules";
  const rulesPath = path.join(workspaceRoot, relativePath);
  if (!(await pathExists(rulesPath))) {
    return;
  }

  const source = await fs.readFile(rulesPath, "utf8");
  for (const rule of requiredPermissionRules) {
    if (!source.includes(permissionRuleSource(rule))) {
      report(`${relativePath} must ${rule.decision} ${rule.command.join(" ")}`);
    }
  }
  for (const reference of forbiddenPermissionRuleReferences) {
    if (source.includes(reference)) {
      report(`${relativePath} must not reference removed entry ${reference}`);
    }
  }
  for (const command of forbiddenBlanketPermissionRules) {
    for (const decision of ["allow", "prompt"] as const) {
      if (source.includes(permissionRuleSource({ command, decision }))) {
        report(
          `${relativePath} must not blanket ${decision} ${command.join(" ")}`
        );
      }
    }
  }
}

export async function validateSkillPackageVersions(
  report: ReportValidationError,
  skills: readonly SkillPackage[]
): Promise<void> {
  for (const skill of skills) {
    const relativePath = `skills/${skill.name}/${skillEntryFileName}`;
    const skillEntryPath = path.join(skill.directory, skillEntryFileName);
    if (!(await pathExists(skillEntryPath))) {
      report(`${relativePath} is required`);
      continue;
    }

    try {
      readSkillVersionFromMarkdown(
        await fs.readFile(skillEntryPath, "utf8"),
        relativePath
      );
    } catch (error) {
      report(error instanceof Error ? error.message : String(error));
    }
  }
}
