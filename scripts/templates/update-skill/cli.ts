import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import type { CliOptions, UpdaterConfig } from "./types.ts";

export type UpdaterLinks = {
  latestReleaseUrl: string;
  packageLockAssetUrl: string;
  releaseAssetUrl: string;
  skillSourceDirectoryUrl: string;
  sourceRepositoryUrl: string;
  updaterSourceUrl: string;
};

function currentScriptPath(): string {
  return path.resolve(process.argv[1] ?? process.cwd());
}

function defaultTargetDir(): string {
  const scriptDir = path.dirname(currentScriptPath());
  return path.basename(scriptDir) === "scripts"
    ? path.dirname(scriptDir)
    : process.cwd();
}

export function getUpdaterLinks(config: UpdaterConfig): UpdaterLinks {
  const sourceRepositoryUrl = `https://github.com/${config.repo}`;
  const latestReleaseUrl = `${sourceRepositoryUrl}/releases/latest`;

  return {
    latestReleaseUrl,
    packageLockAssetUrl: `${latestReleaseUrl}/download/${config.packageLockAssetName}`,
    releaseAssetUrl: `${latestReleaseUrl}/download/${config.releaseAssetName}`,
    skillSourceDirectoryUrl: `${sourceRepositoryUrl}/tree/main/${config.sourcePath}`,
    sourceRepositoryUrl,
    updaterSourceUrl: `${sourceRepositoryUrl}/blob/main/scripts/templates/update-skill.ts`
  };
}

function printHelp(config: UpdaterConfig): void {
  const links = getUpdaterLinks(config);
  console.log([
    `Usage: node ${path.basename(currentScriptPath())} [--check] [--yes] [--target-dir <dir>] [--release-tag <tag>]`,
    "",
    `Checks and updates ${config.skillName} from ${config.repo} release assets.`,
    "",
    "Maintenance:",
    `  Repository: ${links.sourceRepositoryUrl}`,
    `  Updater source: ${links.updaterSourceUrl}`,
    `  Skill source directory: ${links.skillSourceDirectoryUrl}`,
    `  Default release: ${links.latestReleaseUrl}`,
    `  Package lock asset: ${links.packageLockAssetUrl}`,
    `  Skill zip asset: ${links.releaseAssetUrl}`,
    "",
    "Options:",
    "  --check             Check whether the target differs from the remote source, without updating.",
    "  --yes, -y           Update without prompting.",
    "  --target-dir <dir>  Skill directory to check or update. Defaults to this script's parent skill directory.",
    "  --release-tag <tag> GitHub release tag to read from. Defaults to the latest release.",
    "  --help, -h          Show this help."
  ].join("\n"));
}

export function parseCliOptions(config: UpdaterConfig, argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      check: { type: "boolean" },
      help: { short: "h", type: "boolean" },
      "release-tag": { type: "string" },
      "target-dir": { type: "string" },
      yes: { short: "y", type: "boolean" }
    },
    strict: true
  });

  if (values.help) {
    printHelp(config);
    process.exit(0);
  }

  return {
    check: values.check ?? false,
    releaseTag: values["release-tag"] ?? null,
    targetDir: path.resolve(values["target-dir"] ?? defaultTargetDir()),
    yes: values.yes ?? false
  };
}

export async function confirmUpdate(options: CliOptions): Promise<boolean> {
  if (options.yes) {
    return true;
  }

  if (!process.stdin.isTTY) {
    console.error("Update available. Run again with --yes to update without an interactive prompt.");
    return false;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const answer = await rl.question("Update this skill now? [y/N] ");
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
