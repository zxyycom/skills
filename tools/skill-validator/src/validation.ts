import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import fastGlob from "fast-glob";
import { parseYamlFrontmatter } from "../../shared/src/markdown/frontmatter.ts";
import { validateMarkdownLinks } from "../../shared/src/markdown/links.ts";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";

const requiredFrontmatterKeys = ["name", "description"] as const;
const resourceDirectoryNames = ["references", "scripts", "assets"] as const;
const skillNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SkillStructureValidationOptions = {
  allowedFrontmatterKeys?: readonly string[];
};

export type SkillStructureValidationResult = {
  errors: string[];
  markdownFileCount: number;
  skillDirectory: string;
};

async function statOrNull(targetPath: string): Promise<Stats | null> {
  try {
    return await fs.stat(targetPath);
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return null;
    }
    throw error;
  }
}

function validateFrontmatter(
  markdown: string,
  directoryName: string,
  options: SkillStructureValidationOptions,
  report: (message: string) => void
): void {
  const frontmatter = parseYamlFrontmatter(markdown);
  if (frontmatter === null) {
    report("SKILL.md must start with YAML frontmatter");
    return;
  }

  if (frontmatter.error !== null) {
    report(`SKILL.md frontmatter ${frontmatter.error}`);
    return;
  }

  if (options.allowedFrontmatterKeys !== undefined) {
    const allowedKeys = new Set(options.allowedFrontmatterKeys);
    const unknownKeys = frontmatter.keys.filter((key) => !allowedKeys.has(key));
    if (unknownKeys.length > 0) {
      report(`SKILL.md frontmatter has unsupported keys: ${unknownKeys.join(", ")}`);
    }
  }

  for (const key of requiredFrontmatterKeys) {
    if (!frontmatter.keys.includes(key)) {
      report(`SKILL.md frontmatter is missing ${key}`);
    }
  }

  const name = frontmatter.values.name;
  if (frontmatter.keys.includes("name")) {
    if (typeof name !== "string" || name.trim().length === 0) {
      report("SKILL.md frontmatter name must be a non-empty string");
    } else {
      if (!skillNamePattern.test(name)) {
        report("SKILL.md frontmatter name must use kebab-case");
      }
      if (name !== directoryName) {
        report(`SKILL.md frontmatter name must match directory name ${directoryName}`);
      }
    }
  }

  const description = frontmatter.values.description;
  if (
    frontmatter.keys.includes("description")
    && (typeof description !== "string" || description.trim().length === 0)
  ) {
    report("SKILL.md frontmatter description must be a non-empty string");
  }
}

function validateBody(markdown: string, report: (message: string) => void): void {
  const frontmatterMatch = markdown.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  if (frontmatterMatch !== null && markdown.slice(frontmatterMatch[0].length).trim().length === 0) {
    report("SKILL.md body must contain executable guidance");
  }
}

export async function validateSkillDirectory(
  directory: string,
  options: SkillStructureValidationOptions = {}
): Promise<SkillStructureValidationResult> {
  const skillDirectory = path.resolve(directory);
  const errors: string[] = [];
  const report = (message: string): void => {
    errors.push(message);
  };

  const directoryStat = await statOrNull(skillDirectory);
  if (directoryStat === null) {
    report("skill directory does not exist");
    return { errors, markdownFileCount: 0, skillDirectory };
  }
  if (!directoryStat.isDirectory()) {
    report("skill path must be a directory");
    return { errors, markdownFileCount: 0, skillDirectory };
  }

  const skillMdPath = path.join(skillDirectory, "SKILL.md");
  const skillMdStat = await statOrNull(skillMdPath);
  if (skillMdStat === null) {
    report("SKILL.md is required");
  } else if (!skillMdStat.isFile()) {
    report("SKILL.md must be a file");
  } else {
    const markdown = await fs.readFile(skillMdPath, "utf8");
    validateFrontmatter(markdown, path.basename(skillDirectory), options, report);
    validateBody(markdown, report);
  }

  for (const directoryName of resourceDirectoryNames) {
    const resourcePath = path.join(skillDirectory, directoryName);
    const resourceStat = await statOrNull(resourcePath);
    if (resourceStat !== null && !resourceStat.isDirectory()) {
      report(`${directoryName}/ must be a directory when present`);
    }
  }

  const markdownFiles = (await fastGlob("**/*.md", {
    absolute: true,
    cwd: skillDirectory,
    dot: true,
    followSymbolicLinks: false,
    ignore: ["**/.git/**", "**/node_modules/**"],
    onlyFiles: true
  })).sort((left, right) => left.localeCompare(right));
  await validateMarkdownLinks(markdownFiles, report, skillDirectory);

  return {
    errors,
    markdownFileCount: markdownFiles.length,
    skillDirectory
  };
}
