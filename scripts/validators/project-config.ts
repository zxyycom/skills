import fs from "node:fs/promises";
import path from "node:path";
import { checkPackageScripts } from "../check.ts";
import { pathExists, rootDir } from "../lib/project.ts";
import { validateSkillPackageLock } from "../lib/skill-package-lock.ts";
import type { ReportValidationError } from "../lib/validation.ts";

type PackageJson = {
  scripts?: Record<string, unknown>;
};

const requiredPackageScripts = [
  ...checkPackageScripts,
  "hash:skills",
  "setup-hooks",
  "sync:skill-updaters",
  "sync:skill-validator",
  "sync:decision-records-cli",
  "sync:test-evidence-cli",
  "sync:test-evidence-fixture",
  "check"
] as const;

const requiredProjectFiles = [
  "skill-package-lock.json",
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

  if (await pathExists(path.join(workspaceRoot, "skill-package.hash"))) {
    report("skill-package.hash must not exist; use skill-package-lock.json as the package state file");
  }

  const lockFilePath = path.join(workspaceRoot, "skill-package-lock.json");
  if (await pathExists(lockFilePath)) {
    try {
      const validation = validateSkillPackageLock(
        JSON.parse(await fs.readFile(lockFilePath, "utf8"))
      );
      if (!validation.success) {
        for (const issue of validation.issues) {
          report(`skill-package-lock.json ${issue}`);
        }
      }
    } catch {
      report("skill-package-lock.json must contain valid JSON");
    }
  }
}
