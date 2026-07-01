import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";

export type SkillPackage = {
  name: string;
  directory: string;
  submodulePath: string;
};

export type SkillDiscoveryResult = {
  errors: string[];
  skills: SkillPackage[];
  submodulePaths: string[];
};

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const ignoredDirectoryNames = [".git", "node_modules", "dist"] as const;

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

async function readSubmodulePaths(workspaceRoot: string): Promise<{ errors: string[]; submodulePaths: string[] }> {
  const gitmodulesPath = path.join(workspaceRoot, ".gitmodules");
  if (!await pathExists(gitmodulesPath)) {
    return {
      errors: [".gitmodules is required for the multi-repository skill layout"],
      submodulePaths: []
    };
  }

  const gitmodules = await fs.readFile(gitmodulesPath, "utf8");
  const submodulePaths = [...gitmodules.matchAll(/^\s*path\s*=\s*(.+?)\s*$/gm)].map((match) => match[1]);
  return { errors: [], submodulePaths };
}

export async function discoverSkillPackages(workspaceRoot: string = rootDir): Promise<SkillDiscoveryResult> {
  const skills: SkillPackage[] = [];
  const errors: string[] = [];
  const seenNames = new Set<string>();
  const submoduleDiscovery = await readSubmodulePaths(workspaceRoot);
  errors.push(...submoduleDiscovery.errors);

  for (const submodulePath of submoduleDiscovery.submodulePaths) {
    const submoduleDir = path.join(workspaceRoot, submodulePath);
    const skillRoot = path.join(submoduleDir, "skill");

    if (!await pathExists(skillRoot)) {
      errors.push(`${submodulePath} must contain a skill/ directory`);
      continue;
    }

    const entries = await fs.readdir(skillRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillDir = path.join(skillRoot, entry.name);
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
      skills.push({ directory: skillDir, name: entry.name, submodulePath });
    }
  }

  if (skills.length === 0) {
    errors.push("No skill packages discovered under submodule skill/ directories");
  }

  return {
    errors,
    skills: skills.sort((a, b) => a.name.localeCompare(b.name)),
    submodulePaths: submoduleDiscovery.submodulePaths
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

export async function collectMainMarkdownFiles(
  submodulePaths: string[],
  workspaceRoot: string = rootDir
): Promise<string[]> {
  const ignoredPaths = [
    ...submodulePaths.map((submodulePath) => `${toPosix(submodulePath)}/**`),
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
