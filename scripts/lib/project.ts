import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";

export type SkillPackage = {
  name: string;
  directory: string;
};

export type SkillDiscoveryResult = {
  errors: string[];
  skills: SkillPackage[];
};

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const skillsRootName = "skills";
export const ignoredDirectoryNames = [".git", "node_modules", "dist"] as const;

function shouldIgnoreDirectoryName(name: string): boolean {
  return name.startsWith(".") || (ignoredDirectoryNames as readonly string[]).includes(name);
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

export async function discoverSkillPackages(workspaceRoot: string = rootDir): Promise<SkillDiscoveryResult> {
  const skills: SkillPackage[] = [];
  const errors: string[] = [];
  const seenNames = new Set<string>();
  const skillsRoot = path.join(workspaceRoot, skillsRootName);

  if (!await pathExists(skillsRoot)) {
    return {
      errors: [`${skillsRootName}/ is required for the monorepo skill layout`],
      skills: []
    };
  }

  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (shouldIgnoreDirectoryName(entry.name)) {
      continue;
    }

    const skillDir = path.join(skillsRoot, entry.name);
    const skillMdPath = path.join(skillDir, "SKILL.md");
    if (!await pathExists(skillMdPath)) {
      errors.push(`${toPosix(path.relative(workspaceRoot, skillDir))} must contain SKILL.md`);
      continue;
    }

    if (seenNames.has(entry.name)) {
      errors.push(`Duplicate skill package name: ${entry.name}`);
      continue;
    }

    seenNames.add(entry.name);
    skills.push({ directory: skillDir, name: entry.name });
  }

  if (skills.length === 0) {
    errors.push(`No skill packages discovered under ${skillsRootName}/ directories`);
  }

  return {
    errors,
    skills: skills.sort((a, b) => a.name.localeCompare(b.name))
  };
}

export async function collectFiles(directory: string): Promise<string[]> {
  const files = await fg("**/*", {
    cwd: directory,
    dot: true,
    ignore: ignoredDirectoryNames.map((directoryName) => `${directoryName}/**`),
    onlyFiles: true
  });

  return files.sort((a, b) => a.localeCompare(b)).map((filePath) => path.join(directory, filePath));
}

export async function collectSkillFiles(skillDirectory: string): Promise<string[]> {
  const files = await fg("**/*", {
    cwd: skillDirectory,
    dot: true,
    onlyFiles: true
  });

  return files.sort((a, b) => a.localeCompare(b));
}

export async function collectMainMarkdownFiles(workspaceRoot: string = rootDir): Promise<string[]> {
  const ignoredPaths = [
    `${skillsRootName}/**`,
    ...ignoredDirectoryNames.map((directoryName) => `${directoryName}/**`)
  ];

  const markdownFiles = await fg("**/*.md", {
    cwd: workspaceRoot,
    dot: true,
    ignore: ignoredPaths,
    onlyFiles: true
  });

  return [...new Set(markdownFiles)]
    .sort((a, b) => a.localeCompare(b))
    .map((filePath) => path.join(workspaceRoot, filePath));
}
