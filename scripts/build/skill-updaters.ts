import fs from "node:fs/promises";
import path from "node:path";
import {
  buildGeneratedDeclaration,
  buildGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedArtifacts,
  type BunBundleResult,
  type GeneratedFileMode
} from "../lib/generated-file.ts";
import {
  discoverSkillPackages,
  githubRepository,
  rootDir,
  type SkillPackage
} from "../lib/project.ts";
import {
  pathExists,
  toPosix
} from "../../tools/shared/src/node/filesystem.ts";
import { skillPackageLockFileName } from "../../tools/skill-package/src/lock.ts";
import type { UpdaterConfig } from "../../tools/skill-updater/src/types.ts";

const templateRelativePath = "tools/skill-updater/src/index.ts";
const declarationSourceRelativePath = "tools/skill-updater/api/update-skill.d.mts";
const updaterRelativePath = path.join("scripts", "update-skill.mjs");
const declarationRelativePath = path.join("scripts", "update-skill.d.mts");
const skillNameTemplateToken = "__CODEX_SKILL_NAME__";
const legacyUpdaterRelativePaths = [
  path.join("scripts", "update-skill.cjs"),
  path.join("scripts", "update-skill.cjs.map"),
  path.join("scripts", "update-skill.d.cts"),
  path.join("scripts", "update-skill.js"),
  path.join("scripts", "update-skill.js.map")
];

type UpdaterArtifacts = {
  bundle: BunBundleResult;
  declaration: string;
};

function buildConfig(skill: SkillPackage): UpdaterConfig {
  return {
    packageLockAssetName: skillPackageLockFileName,
    releaseAssetName: `${skill.name}.zip`,
    repo: githubRepository,
    skillName: skill.name,
    sourcePath: toPosix(path.relative(rootDir, skill.directory))
  };
}

async function buildUpdater(
  skill: SkillPackage,
  config: UpdaterConfig
): Promise<UpdaterArtifacts> {
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
  const bundle = await bundleWithBun({
    banner: `${header}\nvar __SKILL_UPDATE_CONFIG__=${JSON.stringify(config)};`,
    cwd: rootDir,
    entryPath: path.join(rootDir, templateRelativePath),
    format: "esm",
    keepNames: true,
    minify: true,
    outputFileName: path.basename(updaterRelativePath),
    sourceMapBaseDirectory: path.dirname(path.join(skill.directory, updaterRelativePath)),
    sourceMap: true
  });
  const declaration = await buildGeneratedDeclaration({
    banner: buildGeneratedFileHeader({
      artifactName: "skill self-updater TypeScript declarations",
      rebuildCommand: "bun run sync:skill-updaters",
      repository: config.repo,
      skillSourcePath: config.sourcePath,
      sourcePath: declarationSourceRelativePath
    }),
    sourcePath: path.join(rootDir, declarationSourceRelativePath)
  });
  return { bundle, declaration };
}

function renderUpdater(
  template: UpdaterArtifacts,
  skillName: string
): UpdaterArtifacts {
  const render = (content: string): string =>
    content.replaceAll(skillNameTemplateToken, skillName);
  return {
    bundle: {
      code: render(template.bundle.code),
      sourceMap: template.bundle.sourceMap === null
        ? null
        : render(template.bundle.sourceMap)
    },
    declaration: render(template.declaration)
  };
}

async function syncSkillUpdater(
  skill: SkillPackage,
  expected: UpdaterArtifacts,
  mode: GeneratedFileMode
): Promise<boolean> {
  const outputPath = path.join(skill.directory, updaterRelativePath);
  let changed = false;

  for (const legacyRelativePath of legacyUpdaterRelativePaths) {
    const legacyOutputPath = path.join(skill.directory, legacyRelativePath);
    if (!await pathExists(legacyOutputPath)) {
      continue;
    }

    if (mode === "check") {
      console.error(
        `${toPosix(path.relative(rootDir, legacyOutputPath))} should be removed; `
        + "updater modules are generated as update-skill.mjs"
      );
      changed = true;
    } else {
      await fs.rm(legacyOutputPath);
      console.log(`Removed ${toPosix(path.relative(rootDir, legacyOutputPath))}`);
      changed = true;
    }
  }

  if (expected.bundle.sourceMap === null) {
    throw new Error(`Bundled ${templateRelativePath} must include a source map`);
  }

  return await syncGeneratedArtifacts(
    [
      { content: expected.bundle.code, path: outputPath },
      { content: expected.bundle.sourceMap, path: `${outputPath}.map` },
      {
        content: expected.declaration,
        path: path.join(skill.directory, declarationRelativePath),
        sourcePath: declarationSourceRelativePath
      }
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
const templateSkill: SkillPackage = {
  directory: path.join(rootDir, "skills", skillNameTemplateToken),
  name: skillNameTemplateToken
};
const updaterTemplate = await buildUpdater(
  templateSkill,
  buildConfig(templateSkill)
);

for (const skill of discovery.skills) {
  const expected = renderUpdater(updaterTemplate, skill.name);
  changed = await syncSkillUpdater(skill, expected, mode) || changed;
}

if (mode === "check" && changed) {
  process.exit(1);
}

if (!changed) {
  console.log("Skill updater scripts are current.");
}
