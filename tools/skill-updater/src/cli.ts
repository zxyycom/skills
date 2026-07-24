import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import type { CliOptions, UpdaterConfig } from "./types.ts";

export type UpdaterLinks = {
  latestReleaseUrl: string;
  releaseAssetUrl: string;
  releaseManifestAssetUrl: string;
  skillSourceDirectoryUrl: string;
  sourceRepositoryUrl: string;
  updaterSourceUrl: string;
};

function defaultTargetDir(scriptPath: string): string {
  const scriptDir = path.dirname(scriptPath);
  return path.basename(scriptDir) === "scripts"
    ? path.dirname(scriptDir)
    : process.cwd();
}

export function getUpdaterLinks(config: UpdaterConfig): UpdaterLinks {
  const sourceRepositoryUrl = `https://github.com/${config.repo}`;
  const latestReleaseUrl = `${sourceRepositoryUrl}/releases/latest`;

  return {
    latestReleaseUrl,
    releaseAssetUrl: `${latestReleaseUrl}/download/${config.releaseAssetName}`,
    releaseManifestAssetUrl: `${latestReleaseUrl}/download/${config.releaseManifestAssetName}`,
    skillSourceDirectoryUrl: `${sourceRepositoryUrl}/tree/main/${config.sourcePath}`,
    sourceRepositoryUrl,
    updaterSourceUrl: `${sourceRepositoryUrl}/blob/main/tools/skill-updater/src/index.ts`
  };
}

export function printHelp(config: UpdaterConfig, scriptPath: string): void {
  const links = getUpdaterLinks(config);
  console.log([
    `Usage: node ${path.basename(scriptPath)} [--check] [--yes] [--target-dir <dir>] [--release-tag <tag>]`,
    "",
    `Checks and updates ${config.skillName} from ${config.repo} release assets.`,
    "",
    "Maintenance:",
    `  Repository: ${links.sourceRepositoryUrl}`,
    `  Updater source: ${links.updaterSourceUrl}`,
    `  Skill source directory: ${links.skillSourceDirectoryUrl}`,
    `  Default release: ${links.latestReleaseUrl}`,
    `  Release manifest asset: ${links.releaseManifestAssetUrl}`,
    `  Skill zip asset: ${links.releaseAssetUrl}`,
    "",
    "Options:",
    "  --check             Check whether the installed version differs from the remote version, without updating.",
    "  --yes, -y           Update without prompting.",
    "  --target-dir <dir>  Skill directory to check or update. Defaults to this script's parent skill directory.",
    "  --release-tag <tag> GitHub release tag to read from. Defaults to the latest release.",
    "  --help, -h          Show this help."
  ].join("\n"));
}

export function parseCliOptions(
  config: UpdaterConfig,
  argv: readonly string[],
  scriptPath: string
): CliOptions {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      check: { type: "boolean" },
      help: { short: "h", type: "boolean" },
      "release-tag": { type: "string" },
      "target-dir": { type: "string" },
      yes: { short: "y", type: "boolean" }
    },
    strict: true
  });

  return {
    check: values.check ?? false,
    help: values.help ?? false,
    releaseTag: values["release-tag"] ?? null,
    targetDir: path.resolve(values["target-dir"] ?? defaultTargetDir(scriptPath)),
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
    const answer = await rl.question("Apply these file replacements now? [y/N] ");
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
