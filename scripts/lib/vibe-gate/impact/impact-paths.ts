import { maintainedProjectFiles } from "../project-files.ts";

export const historicalContentExclusions = [
  "docs/investigations/_resources/**"
] as const;

export const investigationAuthoringDocumentExclusions = [
  "docs/investigations/_candidate.*"
] as const;

export const markdownSourcePatterns = [
  "**/*.[mM][dD]",
  "**/*.[mM][aA][rR][kK][dD][oO][wW][nN]"
] as const;
export const maintainedMarkdownFiles = maintainedProjectFiles([
  ...markdownSourcePatterns,
  ...[
    ...historicalContentExclusions,
    ...investigationAuthoringDocumentExclusions,
    "skills/**/references/upstream/**",
    "skills/**/reference-original.md"
  ].map((pattern) => `!${pattern}`)
]);

/** Disk inputs read by project commands, including ignored fixtures and generated files. */
export const gateInputDirectories = [
  "scripts",
  "tools",
  "skills",
  "docs",
  "changes",
  ".github",
  ".githooks",
  ".codex"
] as const;

export const gateConfigurationFiles = [
  ".gitattributes",
  ".gitignore",
  ".oxfmtrc.json",
  ".oxlintrc.json",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "skills.code-workspace",
  "AGENTS.md",
  "README.md",
  "skill-package.hash",
  "skill-package-lock.json"
] as const;

// Invocation/Definition imports are common even when a command does not consume
// the corresponding release implementation itself. Keep tests with their owner.
export const commonGateInputPatterns = [
  ...gateConfigurationFiles,
  "scripts/**/vibe-check{,-invocation}.ts",
  "scripts/lib/vibe-gate.ts",
  "scripts/lib/vibe-gate/**/!(*.test|*test-support).ts",
  "scripts/lib/vibe-gate/checks/*.ts",
  "scripts/lib/**/{oxc-config,project,skill-package-files,skill-package-hash,skill-package-release,skill-package-tree,skill-package-version-baseline,skill-package-versioning}.ts",
  "scripts/**/environment*.js",
  ".github/**",
  ".githooks/**",
  ".codex/**",
  "tools/shared/src/**/{node,markdown,version-control}/**",
  "tools/skill-package/src/**"
] as const;

export function isKnownGateInput(relativePath: string): boolean {
  if (relativePath.startsWith("tools/")) {
    return [
      "shared",
      "index-runtime",
      "record-operations",
      "skill-package",
      "skill-updater",
      "change-plan",
      "decision-records",
      "investigation-report",
      "task-graph",
      "test-evidence",
      "novel-cards",
      "lightweight-judgment",
      "video-understanding",
      "mcpshell-workspace-bridge",
      "skill-validator"
    ].some(
      (owner) =>
        relativePath === `tools/${owner}` ||
        relativePath.startsWith(`tools/${owner}/`)
    );
  }
  return (
    gateConfigurationFiles.some((file) => file === relativePath) ||
    gateInputDirectories.some(
      (directory) =>
        relativePath === directory || relativePath.startsWith(`${directory}/`)
    ) ||
    relativePath.startsWith(".codegraph/")
  );
}
