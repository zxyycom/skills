import fs from "node:fs/promises";
import path from "node:path";
import {
  compatibilityTestPackageScripts,
  releaseRequiredPackageScripts,
  releaseVersionPackageScript
} from "../lib/vibe-gate.ts";
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

export const authoritativeGatePackageScripts = {
  check: "bun scripts/vibe-check.ts",
  "test:check": "bun test ./scripts/vibe-check.test.ts"
} as const satisfies Readonly<Record<string, string>>;

type ExactPackageScriptRequirement = Readonly<{
  commands: Readonly<Record<string, string>>;
  diagnostic(scriptName: string, expectedCommand: string): string;
}>;

const commandPackageScriptRequirements: readonly ExactPackageScriptRequirement[] =
  [
    {
      commands: maintenanceCliPackageScripts,
      diagnostic: (scriptName, expectedCommand) =>
        `package.json script ${scriptName} must delegate to ${expectedCommand}`
    },
    {
      commands: authoritativeGatePackageScripts,
      diagnostic: (scriptName, expectedCommand) =>
        `package.json script ${scriptName} must be ${expectedCommand}; ` +
        "restore the authoritative Vibe Check entry"
    }
  ];

const qualityPackageScriptRequirements: readonly ExactPackageScriptRequirement[] =
  [
    {
      commands: formatPackageScripts,
      diagnostic: (scriptName, expectedCommand) =>
        `package.json script ${scriptName} must be ${expectedCommand}; ` +
        "restore the repository Oxfmt command"
    },
    {
      commands: lintPackageScripts,
      diagnostic: (scriptName, expectedCommand) =>
        `package.json script ${scriptName} must be ${expectedCommand}; ` +
        "restore the repository Oxlint preflight command"
    }
  ];

export const requiredPackageScripts = [
  ...compatibilityTestPackageScripts,
  ...releaseRequiredPackageScripts,
  releaseVersionPackageScript,
  "pack:skills",
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
  "scripts/environment.js",
  "scripts/setup-git-hooks.js",
  "scripts/setup-repository.js",
  "scripts/task-graph.js",
  "scripts/lint.ts",
  "scripts/vibe-check.ts",
  "scripts/vibe-check.test.ts",
  "scripts/lib/vibe-gate.ts",
  "scripts/lib/vibe-jscpd.js",
  "scripts/lib/vibe-lizard.js",
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

async function readPackageScripts(
  packageJsonPath: string,
  report: ReportValidationError
): Promise<Record<string, unknown> | null> {
  if (!(await pathExists(packageJsonPath))) {
    report(
      "package.json is required for local validation and packaging scripts"
    );
    return null;
  }

  let packageJson: unknown;
  try {
    packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  } catch (error) {
    report(
      `package.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
  if (!isRecord(packageJson) || !isRecord(packageJson.scripts)) {
    report("package.json scripts must be an object");
    return null;
  }
  return packageJson.scripts;
}

function validateRequiredPackageScripts(
  scripts: Readonly<Record<string, unknown>>,
  report: ReportValidationError
): void {
  for (const scriptName of requiredPackageScripts) {
    if (typeof scripts[scriptName] !== "string") {
      report(`package.json is missing script ${scriptName}`);
    }
  }
}

function validateExactPackageScripts(
  scripts: Readonly<Record<string, unknown>>,
  requirements: readonly ExactPackageScriptRequirement[],
  report: ReportValidationError
): void {
  for (const requirement of requirements) {
    for (const [scriptName, expectedCommand] of Object.entries(
      requirement.commands
    )) {
      if (scripts[scriptName] !== expectedCommand) {
        report(requirement.diagnostic(scriptName, expectedCommand));
      }
    }
  }
}

export async function validatePackageScripts(
  report: ReportValidationError,
  workspaceRoot: string = rootDir
): Promise<void> {
  const packageJsonPath = path.join(workspaceRoot, "package.json");
  const scripts = await readPackageScripts(packageJsonPath, report);
  if (scripts === null) {
    return;
  }

  validateRequiredPackageScripts(scripts, report);
  validateExactPackageScripts(
    scripts,
    commandPackageScriptRequirements,
    report
  );
  if (Object.hasOwn(scripts, "vibe-check")) {
    report(
      "package.json must not define the retired vibe-check candidate; use check"
    );
  }
  validateExactPackageScripts(
    scripts,
    qualityPackageScriptRequirements,
    report
  );
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
