import fs from "node:fs/promises";
import path from "node:path";
import { type Zippable, zipSync } from "fflate";
import {
  collectSkillPackageFileSets,
  readSkillPackageVersion,
  type SkillPackageFile
} from "./lib/skill-package-hash.ts";
import {
  discoverSkillPackages,
  rootDir,
  type SkillPackage
} from "./lib/project.ts";
import {
  skillReleaseManifestFileName,
  stringifySkillReleaseManifest,
  type SkillReleaseManifest
} from "../tools/skill-package/src/release-manifest.ts";

const distDir = path.join(rootDir, "dist");
const zipEntryOptions = { level: 9 as const, mtime: new Date(1980, 0, 1) };

function buildZip(
  skill: SkillPackage,
  files: readonly SkillPackageFile[]
): Buffer {
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

const filesBySkill = await collectSkillPackageFileSets(discovery.skills);
for (const skill of discovery.skills) {
  const archive = buildZip(skill, filesBySkill.get(skill.name) ?? []);
  const outputPath = path.join(distDir, `${skill.name}.zip`);
  await fs.writeFile(outputPath, archive);
  console.log(`Packed ${skill.name} -> ${path.relative(rootDir, outputPath)} (${archive.length} bytes).`);
}

const releaseManifest: SkillReleaseManifest = {
  schemaVersion: 1,
  skills: Object.fromEntries(discovery.skills.map((skill) => [
    skill.name,
    {
      version: readSkillPackageVersion(
        skill.name,
        filesBySkill.get(skill.name) ?? []
      )
    }
  ]))
};
const manifestOutputPath = path.join(distDir, skillReleaseManifestFileName);
await fs.writeFile(
  manifestOutputPath,
  stringifySkillReleaseManifest(releaseManifest),
  "utf8"
);
console.log(
  `Generated ${skillReleaseManifestFileName} -> ${path.relative(rootDir, manifestOutputPath)}.`
);
