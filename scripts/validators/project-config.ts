import fs from "node:fs/promises";
import path from "node:path";
import { pathExists, rootDir } from "../lib/project.ts";
import type { ReportValidationError } from "../lib/validation.ts";

type PackageJson = {
  scripts?: Record<string, unknown>;
};

const requiredPackageScripts = [
  "typecheck",
  "validate",
  "validate:decisions",
  "hash:skills",
  "pack:skills",
  "setup-hooks",
  "sync:skill-updaters",
  "check:skill-updaters",
  "check",
  "deploy:package"
] as const;

const requiredProjectFiles = [
  "skill-package-lock.json",
  "skills",
  "README.md",
  "AGENTS.md",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "scripts/setup-git-hooks.ts",
  "docs/tooling.md",
  "docs/skills",
  ".githooks/pre-commit",
  ".github/workflows/package-skills.yml"
] as const;

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

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
      const lock = JSON.parse(await fs.readFile(lockFilePath, "utf8")) as {
        aggregateHash?: unknown;
        schemaVersion?: unknown;
        skills?: unknown;
      };

      if (lock.schemaVersion !== 1) {
        report("skill-package-lock.json schemaVersion must be 1");
      }

      if (!isSha256(lock.aggregateHash)) {
        report("skill-package-lock.json aggregateHash must be a lowercase SHA-256 hash");
      }

      if (typeof lock.skills !== "object" || lock.skills === null || Array.isArray(lock.skills)) {
        report("skill-package-lock.json skills must be an object");
      } else {
        const skills = Object.entries(lock.skills as Record<string, unknown>);
        if (skills.length === 0) {
          report("skill-package-lock.json skills must not be empty");
        }

        for (const [skillName, hash] of skills) {
          if (!isSha256(hash)) {
            report(`skill-package-lock.json skills.${skillName} must be a lowercase SHA-256 hash`);
          }
        }
      }
    } catch {
      report("skill-package-lock.json must contain valid JSON");
    }
  }
}
