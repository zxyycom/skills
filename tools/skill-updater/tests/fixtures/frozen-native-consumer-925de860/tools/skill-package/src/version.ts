import { parseYamlFrontmatter } from "../../shared/src/markdown/frontmatter.ts";

export const skillEntryFileName = "SKILL.md";
export const skillNameFrontmatterPath = "name";
export const skillVersionMetadataPath = "metadata.version";

const skillVersionPattern = /^[1-9]\d*$/;

export type SkillPackageIdentity = {
  name: string;
  version: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSkillName(
  value: unknown,
  source: string = skillNameFrontmatterPath
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${source} must be a non-empty string`);
  }

  return value;
}

export function parseSkillVersion(
  value: unknown,
  source: string = skillVersionMetadataPath
): number {
  if (typeof value !== "string" || !skillVersionPattern.test(value)) {
    throw new Error(
      `${source} must be a string containing one positive integer`
    );
  }

  const version = Number(value);
  if (!Number.isSafeInteger(version)) {
    throw new Error(`${source} must contain a safe positive integer`);
  }

  return version;
}

function readSkillFrontmatter(
  markdown: string,
  source: string = skillEntryFileName
): Record<string, unknown> {
  const frontmatter = parseYamlFrontmatter(markdown);
  if (frontmatter === null) {
    throw new Error(`${source} must start with YAML frontmatter`);
  }
  if (frontmatter.error !== null) {
    throw new Error(`${source} frontmatter ${frontmatter.error}`);
  }

  return frontmatter.values;
}

function readOptionalSkillVersion(
  frontmatter: Record<string, unknown>,
  source: string
): number | null {
  const metadata = frontmatter.metadata;
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

export function readSkillPackageIdentityFromMarkdown(
  markdown: string,
  source: string = skillEntryFileName
): SkillPackageIdentity {
  const frontmatter = readSkillFrontmatter(markdown, source);
  return {
    name: parseSkillName(
      frontmatter.name,
      `${source} frontmatter ${skillNameFrontmatterPath}`
    ),
    version: readOptionalSkillVersion(frontmatter, source)
  };
}

export function readOptionalSkillVersionFromMarkdown(
  markdown: string,
  source: string = skillEntryFileName
): number | null {
  return readOptionalSkillVersion(
    readSkillFrontmatter(markdown, source),
    source
  );
}

export function readSkillVersionFromMarkdown(
  markdown: string,
  source: string = skillEntryFileName
): number {
  const version = readOptionalSkillVersionFromMarkdown(markdown, source);
  if (version === null) {
    throw new Error(
      `${source} frontmatter ${skillVersionMetadataPath} is required`
    );
  }

  return version;
}
