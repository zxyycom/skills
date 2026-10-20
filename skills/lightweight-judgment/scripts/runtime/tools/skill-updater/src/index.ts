/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/index.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/index.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/index.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/lightweight-judgment
 * Rebuild: bun run sync:lightweight-judgment-cli
 */
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  confirmUpdate,
  getUpdaterLinks,
  parseCliOptions,
  printHelp
} from "./cli.ts";
import {
  installSkillFiles,
  localSkillState,
  planSkillUpdate
} from "./installation.ts";
import {
  fetchGitHubRelease,
  loadRemoteSkillFiles,
  resolveRemoteSkillPackage
} from "./release.ts";
import type {
  LocalSkillState,
  SkillUpdatePlanEntry,
  UpdaterConfig
} from "./types.ts";

function formatLocalVersion(state: LocalSkillState): string {
  if (state.state === "versioned") {
    return String(state.version);
  }

  return state.state === "missing" ? "(target missing)" : "(unversioned)";
}

function printUpdatePlan(plan: readonly SkillUpdatePlanEntry[]): void {
  const replacements = plan.filter((entry) => entry.action === "replace");
  const additions = plan.filter((entry) => entry.action === "add");

  console.log("Files to replace:");
  if (replacements.length === 0) {
    console.log("  (none)");
  } else {
    for (const entry of replacements) {
      console.log(`  ${entry.path}`);
    }
  }

  console.log("Files to add:");
  if (additions.length === 0) {
    console.log("  (none)");
  } else {
    for (const entry of additions) {
      console.log(`  ${entry.path}`);
    }
  }
  console.log("Other local files will be kept.");
}

export async function runSkillUpdaterCli(
  skillUpdaterConfig: Readonly<UpdaterConfig>,
  updaterModuleUrl: string,
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  const updaterScriptPath = fileURLToPath(updaterModuleUrl);
  const options = parseCliOptions(skillUpdaterConfig, argv, updaterScriptPath);
  if (options.help) {
    printHelp(skillUpdaterConfig, updaterScriptPath);
    return 0;
  }
  const links = getUpdaterLinks(skillUpdaterConfig);

  console.log(`Skill: ${skillUpdaterConfig.skillName}`);
  console.log(`Repository: ${links.sourceRepositoryUrl}`);
  console.log(`Updater source: ${links.updaterSourceUrl}`);
  console.log(`Skill source directory: ${links.skillSourceDirectoryUrl}`);
  console.log(`Release: ${options.releaseTag ?? "latest"}`);
  console.log(
    `Release manifest asset: ${skillUpdaterConfig.releaseManifestAssetName}`
  );
  console.log(`Release asset: ${skillUpdaterConfig.releaseAssetName}`);
  console.log(`Target: ${options.targetDir}`);

  const currentState = await localSkillState(
    options.targetDir,
    skillUpdaterConfig.skillName
  );
  const release = await fetchGitHubRelease(
    skillUpdaterConfig,
    options.releaseTag
  );
  console.log(`Resolved release: ${release.tag_name} (${release.html_url})`);

  const remotePackage = await resolveRemoteSkillPackage(
    skillUpdaterConfig,
    release
  );
  console.log(`Remote version: ${remotePackage.version}`);
  console.log(`Local version: ${formatLocalVersion(currentState)}`);

  if (
    currentState.state === "versioned" &&
    currentState.version === remotePackage.version
  ) {
    console.log("Status: current");
    return 0;
  }

  if (currentState.state === "missing") {
    console.log("Status: target missing");
  } else if (currentState.state === "unversioned") {
    console.log("Status: update available (local version unknown)");
  } else if (currentState.version < remotePackage.version) {
    console.log("Status: update available");
  } else {
    console.log("Status: selected release is older than the installed version");
  }
  if (options.check) {
    return 1;
  }

  const remoteFiles = await loadRemoteSkillFiles(
    skillUpdaterConfig,
    release,
    remotePackage
  );
  const updatePlan = await planSkillUpdate(remoteFiles, options.targetDir);
  printUpdatePlan(updatePlan);

  if (!(await confirmUpdate(options))) {
    return 1;
  }

  await installSkillFiles(remoteFiles, options.targetDir);
  console.log("Updated skill successfully.");
  return 0;
}
