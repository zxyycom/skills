import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  discoverSkillPackages,
  pathExists,
  rootDir,
  toPosix,
  type SkillPackage
} from "./lib/project.ts";

type Mode = "check" | "write";

type Gitmodule = {
  path: string;
  url: string;
};

type UpdaterConfig = {
  ref: string;
  repo: string;
  skillName: string;
  sourcePath: string;
};

const templateRelativePath = "scripts/templates/update-skill.ts";
const updaterRelativePath = path.join("scripts", "update-skill.cjs");
const legacyUpdaterRelativePath = path.join("scripts", "update-skill.js");
const configPlaceholder = "__SKILL_UPDATE_CONFIG_JSON__";
const updaterSourceUrl = "https://raw.githubusercontent.com/zxyycom/skills/main/scripts/templates/update-skill.ts";
const defaultRef = "main";

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

async function readGitmodules(): Promise<Gitmodule[]> {
  const gitmodules = await fs.readFile(path.join(rootDir, ".gitmodules"), "utf8");
  const modules: Gitmodule[] = [];
  let current: Partial<Gitmodule> = {};

  for (const line of gitmodules.split(/\r?\n/)) {
    if (/^\s*\[submodule\s+"/.test(line)) {
      if (current.path && current.url) {
        modules.push({ path: current.path, url: current.url });
      }

      current = {};
      continue;
    }

    const match = line.match(/^\s*(path|url)\s*=\s*(.+?)\s*$/);
    if (!match) {
      continue;
    }

    current[match[1] as keyof Gitmodule] = match[2];
  }

  if (current.path && current.url) {
    modules.push({ path: current.path, url: current.url });
  }

  return modules;
}

function githubRepoFromUrl(url: string): string {
  const httpsMatch = url.match(/^https:\/\/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/);
  if (httpsMatch) {
    return httpsMatch[1];
  }

  const sshMatch = url.match(/^git@github\.com:([^/]+\/[^/.]+)(?:\.git)?$/);
  if (sshMatch) {
    return sshMatch[1];
  }

  const sshUrlMatch = url.match(/^ssh:\/\/git@github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/);
  if (sshUrlMatch) {
    return sshUrlMatch[1];
  }

  throw new Error(`Cannot derive GitHub repo from submodule URL: ${url}`);
}

async function buildConfig(skill: SkillPackage, modulesByPath: Map<string, Gitmodule>): Promise<UpdaterConfig> {
  const gitmodule = modulesByPath.get(skill.submodulePath);
  if (!gitmodule) {
    throw new Error(`No .gitmodules entry found for ${skill.submodulePath}`);
  }

  const submoduleDir = path.join(rootDir, skill.submodulePath);
  return {
    ref: defaultRef,
    repo: githubRepoFromUrl(gitmodule.url),
    skillName: skill.name,
    sourcePath: toPosix(path.relative(submoduleDir, skill.directory))
  };
}

function renderUpdater(bundledTemplate: string, config: UpdaterConfig): string {
  const matches = bundledTemplate.match(new RegExp(configPlaceholder, "g")) ?? [];
  if (matches.length !== 1) {
    throw new Error(`Bundled ${templateRelativePath} must contain exactly one ${configPlaceholder} placeholder`);
  }

  const configJsonForStringLiteral = JSON.stringify(config).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  return addGeneratedHeader(
    bundledTemplate.replace(configPlaceholder, configJsonForStringLiteral),
    config
  );
}

function addGeneratedHeader(script: string, config: UpdaterConfig): string {
  const header = [
    "/*",
    " * Generated skill self-updater. Do not edit this bundled file directly.",
    ` * Source template: ${updaterSourceUrl}`,
    ` * Skill source directory: https://github.com/${config.repo}/tree/${config.ref}/${config.sourcePath}`,
    " */",
    ""
  ].join("\n");

  if (!script.startsWith("#!")) {
    return `${header}${script}`;
  }

  const firstLineEnd = script.indexOf("\n");
  if (firstLineEnd === -1) {
    return `${script}\n${header}`;
  }

  return `${script.slice(0, firstLineEnd + 1)}${header}${script.slice(firstLineEnd + 1)}`;
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

const modulesByPath = new Map((await readGitmodules()).map((gitmodule) => [gitmodule.path, gitmodule]));
const bundledTemplate = await buildBundledTemplate();
let changed = false;

for (const skill of discovery.skills) {
  const config = await buildConfig(skill, modulesByPath);
  const expected = renderUpdater(bundledTemplate, config);
  changed = await syncSkillUpdater(skill, expected, mode) || changed;
}

if (mode === "check" && changed) {
  process.exit(1);
}

if (!changed) {
  console.log("Skill updater scripts are current.");
}
