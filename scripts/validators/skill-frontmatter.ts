import fs from "node:fs/promises";
import path from "node:path";
import { parseYamlFrontmatter } from "../lib/frontmatter.ts";
import { rootDir, toPosix, type SkillPackage } from "../lib/project.ts";
import type { ReportValidationError } from "../lib/validation.ts";

const allowedFrontmatterKeys = new Set(["name", "description", "license", "compatibility", "metadata"]);
const requiredFrontmatterKeys = ["name", "description"] as const;

export async function validateSkillFrontmatter(
  skill: SkillPackage,
  report: ReportValidationError,
  workspaceRoot: string = rootDir
): Promise<void> {
  const skillMdPath = path.join(skill.directory, "SKILL.md");
  const markdown = await fs.readFile(skillMdPath, "utf8");
  const frontmatter = parseYamlFrontmatter(markdown);
  const relativeSkillMdPath = toPosix(path.relative(workspaceRoot, skillMdPath));

  if (!frontmatter) {
    report(`${relativeSkillMdPath} must start with YAML frontmatter`);
    return;
  }

  if (frontmatter.error) {
    report(`${relativeSkillMdPath} frontmatter ${frontmatter.error}`);
    return;
  }

  const unknownKeys = frontmatter.keys.filter((key) => !allowedFrontmatterKeys.has(key));
  if (unknownKeys.length > 0) {
    report(`${relativeSkillMdPath} frontmatter has unsupported keys: ${unknownKeys.join(", ")}`);
  }

  for (const key of requiredFrontmatterKeys) {
    if (!frontmatter.keys.includes(key)) {
      report(`${relativeSkillMdPath} frontmatter is missing ${key}`);
    }
  }

  const name = frontmatter.values.name;
  if (name !== skill.name) {
    report(`${relativeSkillMdPath} name must be ${skill.name}`);
  }

  if (typeof name !== "string" || !/^[a-z0-9-]+$/.test(name)) {
    report(`${relativeSkillMdPath} name must use lowercase letters, digits, and hyphens`);
  }
}
