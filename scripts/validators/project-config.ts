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
  "pack:skills",
  "check",
  "deploy:package"
] as const;

const requiredProjectFiles = [
  ".gitmodules",
  "README.md",
  "AGENTS.md",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "docs/tooling.md",
  ".github/workflows/package-skills.yml"
] as const;

const requiredWorkflowPatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: "package job", pattern: /^\s*package:\s*$/m },
  { label: "publish job", pattern: /^\s*publish:\s*$/m },
  { label: "artifact upload", pattern: /actions\/upload-artifact@v4/ },
  { label: "artifact download", pattern: /actions\/download-artifact@v4/ },
  { label: "main branch publish guard", pattern: /github\.ref == 'refs\/heads\/main'/ },
  { label: "release write permission", pattern: /contents:\s*write/ },
  { label: "latest release tag", pattern: /RELEASE_TAG:\s*skills-latest/ },
  { label: "release creation", pattern: /gh release create/ },
  { label: "release asset upload", pattern: /gh release upload/ },
  { label: "all skill zips", pattern: /dist\/\*\.zip/ }
];

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
}

export async function validateCiWorkflow(
  report: ReportValidationError,
  workspaceRoot: string = rootDir
): Promise<void> {
  const workflowPath = path.join(workspaceRoot, ".github", "workflows", "package-skills.yml");
  if (!await pathExists(workflowPath)) {
    return;
  }

  const workflow = await fs.readFile(workflowPath, "utf8");
  for (const { label, pattern } of requiredWorkflowPatterns) {
    if (!pattern.test(workflow)) {
      report(`CI workflow is missing ${label}`);
    }
  }
}
