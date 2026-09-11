import type { GateImpactTag } from "./impact-catalog.ts";
import { compareText } from "./impact-values.ts";

const ownerTagsByName = new Map<string, GateImpactTag>([
  ["change-plan", "change-plan"],
  ["decision-records", "decision-records"],
  ["index-runtime", "index-runtime"],
  ["investigation-report", "investigation-report"],
  ["skill-updater", "skill-updater"],
  ["skill-updaters", "skill-updater"],
  ["skill-validator", "skill-validator"],
  ["task-graph", "task-graph"],
  ["test-evidence", "test-evidence"]
]);

function ownerTagForName(value: string | undefined): GateImpactTag | null {
  return value === undefined ? null : (ownerTagsByName.get(value) ?? null);
}

const documentationOwnerTags = new Map<string, GateImpactTag>([
  ["decisions", "decision-records"],
  ["investigations", "investigation-report"],
  ["task-graph", "task-graph"],
  ["test-evidence", "test-evidence"]
]);

function documentationOwnerTag(
  second: string | undefined,
  third: string | undefined
): GateImpactTag {
  if (second === "skills") return ownerTagForName(third) ?? "skills";
  return second === undefined
    ? "documentation"
    : (documentationOwnerTags.get(second) ?? "documentation");
}

const toolOwnerTags = new Map<string, GateImpactTag>([
  ["index-runtime", "index-runtime"],
  ["mcpshell-workspace-bridge", "global"],
  ["shared", "shared-tools"],
  ["skill-package", "skill-release"]
]);

function toolOwnerTag(second: string | undefined): GateImpactTag | null {
  if (second === undefined) return null;
  return toolOwnerTags.get(second) ?? ownerTagForName(second);
}

const scriptOwnerRules = [
  {
    matches: (relativePath: string) =>
      relativePath.includes("vibe-check") ||
      relativePath.includes("vibe-gate") ||
      relativePath === "scripts/lib/project.ts",
    tag: "global"
  },
  {
    matches: (relativePath: string) =>
      ["environment", "auto-push", "project-config", "setup-"].some((name) =>
        relativePath.includes(name)
      ),
    tag: "environment"
  },
  {
    matches: (relativePath: string) =>
      relativePath.includes("generated-") ||
      relativePath === "scripts/lib/oxc-config.ts" ||
      relativePath === "scripts/lib/source-map.ts" ||
      relativePath === "scripts/lint.ts",
    tag: "build-system"
  },
  {
    matches: (relativePath: string) =>
      ["skill-package", "pack-skills", "publish-skills", "hash-skills"].some(
        (name) => relativePath.includes(name)
      ),
    tag: "skill-release"
  },
  {
    matches: (relativePath: string) => relativePath.includes("task-graph"),
    tag: "task-graph"
  },
  {
    matches: (relativePath: string) => relativePath.includes("validat"),
    tag: "skill-validator"
  }
] as const satisfies readonly Readonly<{
  matches: (relativePath: string) => boolean;
  tag: GateImpactTag;
}>[];

function scriptOwnerTag(
  relativePath: string,
  second: string | undefined,
  third: string | undefined
): GateImpactTag | null {
  if (second === "test-evidence") return "test-evidence";
  if (second === "build") {
    return ownerTagForName(third?.split(".")[0]) ?? "global";
  }
  return (
    scriptOwnerRules.find(({ matches }) => matches(relativePath))?.tag ?? null
  );
}

function ownerTagForPath(relativePath: string): GateImpactTag | null {
  const [topLevel, second, third] = relativePath.split("/");
  const fixedOwner = topLevelOwnerTags.get(topLevel ?? "");
  if (fixedOwner !== undefined) return fixedOwner;
  if (topLevel === "docs") return documentationOwnerTag(second, third);
  if (topLevel === "scripts") {
    return scriptOwnerTag(relativePath, second, third);
  }
  if (topLevel === "skills") return ownerTagForName(second) ?? "skills";
  return topLevel === "tools" ? toolOwnerTag(second) : null;
}

const topLevelOwnerTags = new Map<string, GateImpactTag>([
  [".codegraph", "global"],
  [".codex", "global"],
  [".github", "global"],
  [".githooks", "environment"],
  ["AGENTS.md", "documentation"],
  ["README.md", "documentation"],
  ["changes", "change-plan"]
]);

const rootConfigurationFiles = new Set([
  ".gitattributes",
  ".gitignore",
  ".oxfmtrc.json",
  ".oxlintrc.json",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "skills.code-workspace",
  "tsconfig.json"
]);

function isRootConfiguration(relativePath: string): boolean {
  return (
    relativePath.startsWith(".github/") ||
    rootConfigurationFiles.has(relativePath)
  );
}

function isMaintainedCode(relativePath: string): boolean {
  return (
    (relativePath.startsWith("scripts/") ||
      relativePath.startsWith("tools/")) &&
    /\.(?:js|ts)$/u.test(relativePath)
  );
}

function isSecretSurface(relativePath: string): boolean {
  return (
    /\.(?:code-workspace|example|html|js|json|jsonl|md|mjs|mts|rules|toml|ts|txt|yaml|yml)$/u.test(
      relativePath
    ) ||
    relativePath === ".gitattributes" ||
    relativePath === ".gitignore" ||
    relativePath.startsWith(".githooks/")
  );
}

const impactTagRules = [
  {
    matches: (relativePath: string) => relativePath.startsWith("skills/"),
    tag: "skills"
  },
  { matches: isRootConfiguration, tag: "global" },
  {
    matches: (relativePath: string) => relativePath.startsWith(".githooks/"),
    tag: "environment"
  },
  {
    matches: (relativePath: string) =>
      relativePath === "AGENTS.md" || relativePath === "README.md",
    tag: "documentation"
  },
  { matches: isMaintainedCode, tag: "maintained-code" },
  {
    matches: (relativePath: string) => relativePath.endsWith(".md"),
    tag: "markdown"
  },
  {
    matches: (relativePath: string) => relativePath.endsWith(".json"),
    tag: "json"
  },
  { matches: isSecretSurface, tag: "secret-surface" }
] as const satisfies readonly Readonly<{
  matches: (relativePath: string) => boolean;
  tag: GateImpactTag;
}>[];

export function impactTagsForPath(relativePath: string): Readonly<{
  tags: readonly GateImpactTag[];
  unclassified: boolean;
}> {
  const tags = new Set<GateImpactTag>(["path-inventory"]);
  const ownerTag = ownerTagForPath(relativePath);
  if (ownerTag !== null) tags.add(ownerTag);
  for (const rule of impactTagRules) {
    if (rule.matches(relativePath)) tags.add(rule.tag);
  }
  const unclassified = ownerTag === null && !isRootConfiguration(relativePath);
  if (unclassified) tags.add("global");
  return { tags: [...tags].sort(compareText), unclassified };
}
