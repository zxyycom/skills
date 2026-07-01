import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";
import { type Zippable, zipSync } from "fflate";

type SkillPackage = {
  name: string;
  directory: string;
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const zipEntryOptions = { level: 9 as const, mtime: new Date(1980, 0, 1) };

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readSubmodulePaths(): Promise<string[]> {
  const gitmodulesPath = path.join(rootDir, ".gitmodules");
  const gitmodules = await fs.readFile(gitmodulesPath, "utf8");
  return [...gitmodules.matchAll(/^\s*path\s*=\s*(.+?)\s*$/gm)].map((match) => match[1]);
}

async function discoverSkills(): Promise<SkillPackage[]> {
  const skills: SkillPackage[] = [];
  const seenNames = new Set<string>();

  for (const submodulePath of await readSubmodulePaths()) {
    const skillRoot = path.join(rootDir, submodulePath, "skill");
    if (!await exists(skillRoot)) {
      throw new Error(`${submodulePath} must contain a skill/ directory`);
    }

    const entries = await fs.readdir(skillRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillDir = path.join(skillRoot, entry.name);
      if (!await exists(path.join(skillDir, "SKILL.md"))) {
        continue;
      }

      if (seenNames.has(entry.name)) {
        throw new Error(`Duplicate skill package name: ${entry.name}`);
      }

      seenNames.add(entry.name);
      skills.push({ directory: skillDir, name: entry.name });
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function collectSkillFiles(skillDir: string): Promise<string[]> {
  const files = await fg("**/*", { cwd: skillDir, dot: true, onlyFiles: true });
  return files.sort((a, b) => a.localeCompare(b));
}

async function buildZip(skill: SkillPackage): Promise<Buffer> {
  const files = await collectSkillFiles(skill.directory);
  const entries: Zippable = {};

  for (const relativePath of files) {
    const zipPath = `${skill.name}/${relativePath}`;
    const data = await fs.readFile(path.join(skill.directory, relativePath));
    entries[zipPath] = [data, zipEntryOptions];
  }

  return Buffer.from(zipSync(entries, zipEntryOptions));
}

await fs.mkdir(distDir, { recursive: true });

for (const skill of await discoverSkills()) {
  const archive = await buildZip(skill);
  const outputPath = path.join(distDir, `${skill.name}.zip`);
  await fs.writeFile(outputPath, archive);
  console.log(`Packed ${skill.name} -> ${path.relative(rootDir, outputPath)} (${archive.length} bytes).`);
}
