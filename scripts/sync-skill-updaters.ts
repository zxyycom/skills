import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { addGeneratedFileHeader } from "./lib/generated-file.ts";
import {
  discoverSkillPackages,
  pathExists,
  rootDir,
  toPosix,
  type SkillPackage
} from "./lib/project.ts";
import { skillPackageLockFileName } from "./lib/skill-package-hash.ts";

type Mode = "check" | "write";

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
const sourceRepo = "zxyycom/skills";
const sourceRepositoryUrl = `https://github.com/${sourceRepo}`;
const updaterSourceUrl = `${sourceRepositoryUrl}/blob/main/${templateRelativePath}`;

function parseArgs(argv: string[]): Mode {
  let mode: Mode | null = null;

  for (const arg of argv) {
    if (arg === "--check" || arg === "--write") {
      const nextMode = arg === "--write" ? "write" : "check";
      if (mode !== null && mode !== nextMode) {
        throw new Error("--check and --write cannot be used together");
      }

      mode = nextMode;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return mode ?? "check";
}

function buildConfig(skill: SkillPackage): UpdaterConfig {
  return {
    packageLockAssetName: skillPackageLockFileName,
    releaseAssetName: `${skill.name}.zip`,
    repo: sourceRepo,
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
      repositoryUrl: `https://github.com/${config.repo}`,
      skillSourceUrl: `https://github.com/${config.repo}/tree/main/${config.sourcePath}`,
      sourcePath: templateRelativePath,
      sourceUrl: updaterSourceUrl
    }
  );
}

function runBunBuild(entryPath: string, outputPath: string): Promise<void> {
  const args = [
    "build",
    entryPath,
    "--target=node",
    "--format=cjs",
    "--minify",
    "--packages=bundle",
    `--outfile=${outputPath}`
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const output = Buffer.concat([...stdout, ...stderr]).toString("utf8").trim();
      reject(new Error(output || `bun build exited with code ${code}`));
    });
  });
}

async function buildBundledTemplate(): Promise<string> {
  const tempDir = path.join(rootDir, ".skill-updater-build");
  const outputPath = path.join(tempDir, "update-skill.cjs");

  try {
    await fs.rm(tempDir, { force: true, recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    await runBunBuild(path.join(rootDir, templateRelativePath), outputPath);
    const bundled = await fs.readFile(outputPath, "utf8");
    return bundled.startsWith("#!") ? bundled : `#!/usr/bin/env node\n${bundled}`;
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

async function isSameFileContent(filePath: string, expected: string): Promise<boolean> {
  return await pathExists(filePath) && await fs.readFile(filePath, "utf8") === expected;
}

async function syncSkillUpdater(skill: SkillPackage, expected: string, mode: Mode): Promise<boolean> {
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

  if (await isSameFileContent(outputPath, expected)) {
    return changed;
  }

  if (mode === "check") {
    console.error(`${toPosix(path.relative(rootDir, outputPath))} is missing or not generated from ${templateRelativePath}`);
    return true;
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, expected, "utf8");
  console.log(`Wrote ${toPosix(path.relative(rootDir, outputPath))}`);
  return true;
}

const mode = parseArgs(process.argv.slice(2));
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
