import fs from "node:fs/promises";
import path from "node:path";
import { checkPackageScripts } from "../check.ts";
import { rootDir } from "../lib/project.ts";
import type { SkillPackage } from "../lib/project.ts";
import type { ReportValidationError } from "../lib/validation.ts";
import { pathExists } from "../../tools/shared/src/node/filesystem.ts";
import {
  readSkillVersionFromMarkdown,
  skillEntryFileName
} from "../../tools/skill-package/src/version.ts";

type PackageJson = {
  scripts?: Record<string, unknown>;
};

const requiredPackageScripts = [
  ...checkPackageScripts,
  "setup-hooks",
  "sync:skill-updaters",
  "sync:change-plan-cli",
  "sync:skill-validator",
  "sync:investigation-report-check",
  "sync:decision-records-cli",
  "sync:test-evidence-cli",
  "sync:test-evidence-fixture",
  "check"
] as const;

const requiredProjectFiles = [
  "skills",
  "README.md",
  "AGENTS.md",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "scripts/check.ts",
  "scripts/setup-git-hooks.ts",
  "docs/tooling.md",
  "docs/skills",
  ".githooks/pre-commit",
  ".github/workflows/package-skills.yml"
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
  if (!await pathExists(packageJsonPath)) {
    report("package.json is required for local validation and packaging scripts");
    return;
  }

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as PackageJson;
  for (const scriptName of requiredPackageScripts) {
    if (typeof packageJson.scripts?.[scriptName] !== "string") {
      report(`package.json is missing script ${scriptName}`);
    }
  }
}

export async function validateRequiredProjectFiles(
  report: ReportValidationError,
  workspaceRoot: string = rootDir
): Promise<void> {
  for (const relativePath of requiredProjectFiles) {
    if (!await pathExists(path.join(workspaceRoot, relativePath))) {
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

export async function validateSkillPackageVersions(
  report: ReportValidationError,
  skills: readonly SkillPackage[]
): Promise<void> {
  for (const skill of skills) {
    const relativePath = `skills/${skill.name}/${skillEntryFileName}`;
    const skillEntryPath = path.join(skill.directory, skillEntryFileName);
    if (!await pathExists(skillEntryPath)) {
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
