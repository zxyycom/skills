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
  "README.md"
] as const;

export const commonGateInputPatterns = [
  ...gateConfigurationFiles,
  "scripts/**",
  ".github/**",
  ".githooks/**",
  ".codex/**",
  "tools/shared/**",
  "!tools/shared/src/file-text-search/**",
  "!tools/shared/src/graph/**",
  "tools/index-runtime/**",
  "tools/skill-package/**",
  "tools/skill-updater/**"
] as const;

export function isKnownGateInput(relativePath: string): boolean {
  if (relativePath.startsWith("tools/")) {
    return [
      "shared",
      "index-runtime",
      "skill-package",
      "skill-updater",
      "change-plan",
      "decision-records",
      "investigation-report",
      "task-graph",
      "test-evidence",
      "novel-cards",
      "lightweight-judgment",
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
