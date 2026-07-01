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
  "sync:skill-updaters",
  "check:skill-updaters",
  "check",
  "deploy:package"
] as const;

const requiredProjectFiles = [
  ".gitmodules",
  "skill-package.hash",
  "README.md",
  "AGENTS.md",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "docs/tooling.md",
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

  const hashFilePath = path.join(workspaceRoot, "skill-package.hash");
  if (await pathExists(hashFilePath)) {
    const hash = (await fs.readFile(hashFilePath, "utf8")).trim();
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      report("skill-package.hash must contain one lowercase SHA-256 hash");
    }
  }
}
