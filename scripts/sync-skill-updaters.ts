import fs from "node:fs/promises";
import path from "node:path";
import {
  buildGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedArtifacts,
  type BunBundleResult,
  type GeneratedFileMode
} from "./lib/generated-file.ts";
import {
  discoverSkillPackages,
  githubRepository,
  pathExists,
  rootDir,
  toPosix,
  type SkillPackage
} from "./lib/project.ts";
import { skillPackageLockFileName } from "./lib/skill-package-lock.ts";
import type { UpdaterConfig } from "./templates/update-skill/types.ts";

const templateRelativePath = "scripts/templates/update-skill.ts";
const updaterRelativePath = path.join("scripts", "update-skill.cjs");
const legacyUpdaterRelativePath = path.join("scripts", "update-skill.js");

function buildConfig(skill: SkillPackage): UpdaterConfig {
  return {
    packageLockAssetName: skillPackageLockFileName,
    releaseAssetName: `${skill.name}.zip`,
    repo: githubRepository,
    skillName: skill.name,
    sourcePath: toPosix(path.relative(rootDir, skill.directory))
  };
}

async function buildUpdater(skill: SkillPackage, config: UpdaterConfig): Promise<BunBundleResult> {
  const header = buildGeneratedFileHeader({
    additionalLines: [
      `Package lock asset: https://github.com/${config.repo}/releases/latest/download/${config.packageLockAssetName}`,
      `Release asset: https://github.com/${config.repo}/releases/latest/download/${config.releaseAssetName}`
    ],
    artifactName: "skill self-updater",
    rebuildCommand: "bun run sync:skill-updaters",
    repository: config.repo,
    skillSourcePath: config.sourcePath,
    sourcePath: templateRelativePath
  });
  return await bundleWithBun({
    banner: `${header}\nvar __SKILL_UPDATE_CONFIG__=${JSON.stringify(config)};`,
    cwd: rootDir,
    entryPath: path.join(rootDir, templateRelativePath),
    format: "cjs",
    keepNames: true,
    minify: true,
    outputFileName: path.basename(updaterRelativePath),
    sourceMapBaseDirectory: path.dirname(path.join(skill.directory, updaterRelativePath)),
    sourceMap: true
  });
}

async function syncSkillUpdater(
  skill: SkillPackage,
  expected: BunBundleResult,
  mode: GeneratedFileMode
): Promise<boolean> {
  const outputPath = path.join(skill.directory, updaterRelativePath);
  const legacyOutputPath = path.join(skill.directory, legacyUpdaterRelativePath);
  let changed = false;

  if (await pathExists(legacyOutputPath)) {
    if (mode === "check") {
      console.error(`${toPosix(path.relative(rootDir, legacyOutputPath))} should be removed; updater scripts are generated as update-skill.cjs`);
      changed = true;
    } else {
      await fs.rm(legacyOutputPath);
      console.log(`Removed ${toPosix(path.relative(rootDir, legacyOutputPath))}`);
      changed = true;
    }
  }

  if (expected.sourceMap === null) {
    throw new Error(`Bundled ${templateRelativePath} must include a source map`);
  }

  return await syncGeneratedArtifacts(
    [
      { content: expected.code, path: outputPath },
      { content: expected.sourceMap, path: `${outputPath}.map` }
    ],
    mode,
    rootDir,
    templateRelativePath
  ) || changed;
}

const mode = parseGeneratedFileMode(process.argv.slice(2));
const discovery = await discoverSkillPackages(rootDir);
if (discovery.errors.length > 0) {
  throw new Error(`Cannot sync skill updaters:\n- ${discovery.errors.join("\n- ")}`);
}

let changed = false;

for (const skill of discovery.skills) {
  const config = buildConfig(skill);
  const expected = await buildUpdater(skill, config);
  changed = await syncSkillUpdater(skill, expected, mode) || changed;
}

if (mode === "check" && changed) {
  process.exit(1);
}

if (!changed) {
  console.log("Skill updater scripts are current.");
}
