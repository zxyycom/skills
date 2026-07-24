import { parseYamlFrontmatter } from "../../shared/src/markdown/frontmatter.ts";

export const skillEntryFileName = "SKILL.md";
export const skillVersionMetadataPath = "metadata.version";

const skillVersionPattern = /^[1-9]\d*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSkillVersion(
  value: unknown,
  source: string = skillVersionMetadataPath
): number {
  if (typeof value !== "string" || !skillVersionPattern.test(value)) {
    throw new Error(`${source} must be a string containing one positive integer`);
  }

  const version = Number(value);
  if (!Number.isSafeInteger(version)) {
    throw new Error(`${source} must contain a safe positive integer`);
  }

  return version;
}

export function readOptionalSkillVersionFromMarkdown(
  markdown: string,
  source: string = skillEntryFileName
): number | null {
  const frontmatter = parseYamlFrontmatter(markdown);
  if (frontmatter === null) {
    throw new Error(`${source} must start with YAML frontmatter`);
  }
  if (frontmatter.error !== null) {
    throw new Error(`${source} frontmatter ${frontmatter.error}`);
  }

  const metadata = frontmatter.values.metadata;
  if (metadata === undefined) {
    return null;
  }
  if (!isRecord(metadata)) {
    throw new Error(`${source} frontmatter metadata must be a mapping`);
  }
  if (!Object.hasOwn(metadata, "version")) {
    return null;
  }

  return parseSkillVersion(
    metadata.version,
    `${source} frontmatter ${skillVersionMetadataPath}`
  );
}

export function readSkillVersionFromMarkdown(
  markdown: string,
  source: string = skillEntryFileName
): number {
  const version = readOptionalSkillVersionFromMarkdown(markdown, source);
  if (version === null) {
    throw new Error(`${source} frontmatter ${skillVersionMetadataPath} is required`);
  }

  return version;
}
