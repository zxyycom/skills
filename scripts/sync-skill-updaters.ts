import fs from "node:fs/promises";
import path from "node:path";
import {
  addGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedFile,
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
import { skillPackageLockFileName } from "./lib/skill-package-hash.ts";

type UpdaterConfig = {
  packageLockAssetName: string;
  releaseAssetName: string;
  repo: string;
  skillName: string;
  sourcePath: string;
};

const templateRelativePath = "scripts/templates/update-skill.ts";
const updaterRelativePath = path.join("scripts", "update-skill.cjs");
const legacyUpdaterRelativePath = path.join("scripts", "update-skill.js");
const configPlaceholder = "__SKILL_UPDATE_CONFIG_JSON__";

function buildConfig(skill: SkillPackage): UpdaterConfig {
  return {
    packageLockAssetName: skillPackageLockFileName,
    releaseAssetName: `${skill.name}.zip`,
    repo: githubRepository,
    skillName: skill.name,
    sourcePath: toPosix(path.relative(rootDir, skill.directory))
  };
}

function renderUpdater(bundledTemplate: string, config: UpdaterConfig): string {
  const matches = bundledTemplate.match(new RegExp(configPlaceholder, "g")) ?? [];
  if (matches.length !== 1) {
    throw new Error(`Bundled ${templateRelativePath} must contain exactly one ${configPlaceholder} placeholder`);
  }

  const configJsonForStringLiteral = JSON.stringify(config).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  return addGeneratedFileHeader(
    bundledTemplate.replace(configPlaceholder, configJsonForStringLiteral),
    {
      additionalLines: [
        `Package lock asset: https://github.com/${config.repo}/releases/latest/download/${config.packageLockAssetName}`,
        `Release asset: https://github.com/${config.repo}/releases/latest/download/${config.releaseAssetName}`
      ],
      artifactName: "skill self-updater",
      rebuildCommand: "bun run sync:skill-updaters",
      repository: config.repo,
      skillSourcePath: config.sourcePath,
      sourcePath: templateRelativePath
    }
  );
}

async function buildBundledTemplate(): Promise<string> {
  return await bundleWithBun({
    cwd: rootDir,
    entryPath: path.join(rootDir, templateRelativePath),
    format: "cjs",
    minify: true
  });
}

async function syncSkillUpdater(
  skill: SkillPackage,
  expected: string,
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

  const result = await syncGeneratedFile(outputPath, expected, mode);
  if (result === "current") {
    return changed;
  }

  if (result === "stale") {
    console.error(`${toPosix(path.relative(rootDir, outputPath))} is missing or not generated from ${templateRelativePath}`);
    return true;
  }

  console.log(`Wrote ${toPosix(path.relative(rootDir, outputPath))}`);
  return true;
}

const mode = parseGeneratedFileMode(process.argv.slice(2));
const discovery = await discoverSkillPackages(rootDir);
if (discovery.errors.length > 0) {
  throw new Error(`Cannot sync skill updaters:\n- ${discovery.errors.join("\n- ")}`);
}

const bundledTemplate = await buildBundledTemplate();
let changed = false;

for (const skill of discovery.skills) {
  const config = buildConfig(skill);
  const expected = renderUpdater(bundledTemplate, config);
  changed = await syncSkillUpdater(skill, expected, mode) || changed;
}

if (mode === "check" && changed) {
  process.exit(1);
}

if (!changed) {
  console.log("Skill updater scripts are current.");
}
