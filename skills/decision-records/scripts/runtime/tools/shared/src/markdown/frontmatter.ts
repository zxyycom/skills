/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/markdown/frontmatter.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/markdown/frontmatter.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/markdown/frontmatter.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { parse as parseYaml } from "yaml";

export type Frontmatter = {
  error: string | null;
  keys: string[];
  values: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseYamlFrontmatter(markdown: string): Frontmatter | null {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return null;
  }

  try {
    const values = parseYaml(match[1]) as unknown;
    if (!isRecord(values)) {
      return { error: "must be a YAML mapping", keys: [], values: {} };
    }

    return { error: null, keys: Object.keys(values), values };
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid YAML";
    return { error: message, keys: [], values: {} };
  }
}
