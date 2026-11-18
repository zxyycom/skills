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
