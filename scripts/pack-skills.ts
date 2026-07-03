import fs from "node:fs/promises";
import path from "node:path";
import { type Zippable, zipSync } from "fflate";
import {
  collectSkillPackageFiles,
  getSkillPackageLockFilePath,
  skillPackageLockFileName
} from "./lib/skill-package-hash.ts";
import {
  discoverSkillPackages,
  rootDir,
  type SkillPackage
} from "./lib/project.ts";

const distDir = path.join(rootDir, "dist");
const zipEntryOptions = { level: 9 as const, mtime: new Date(1980, 0, 1) };

async function buildZip(skill: SkillPackage): Promise<Buffer> {
  const files = await collectSkillPackageFiles(skill);
  const entries = Object.fromEntries(
    files.map((file) => [
      `${skill.name}/${file.path}`,
      [file.data, zipEntryOptions]
    ])
  ) as Zippable;

  return Buffer.from(zipSync(entries, zipEntryOptions));
}

const discovery = await discoverSkillPackages(rootDir);
if (discovery.errors.length > 0) {
  throw new Error(`Cannot pack skills:\n- ${discovery.errors.join("\n- ")}`);
}

await fs.rm(distDir, { force: true, recursive: true });
await fs.mkdir(distDir, { recursive: true });

for (const skill of discovery.skills) {
  const archive = await buildZip(skill);
  const outputPath = path.join(distDir, `${skill.name}.zip`);
  await fs.writeFile(outputPath, archive);
  console.log(`Packed ${skill.name} -> ${path.relative(rootDir, outputPath)} (${archive.length} bytes).`);
}

const lockOutputPath = path.join(distDir, skillPackageLockFileName);
await fs.copyFile(getSkillPackageLockFilePath(rootDir), lockOutputPath);
console.log(`Copied ${skillPackageLockFileName} -> ${path.relative(rootDir, lockOutputPath)}.`);
