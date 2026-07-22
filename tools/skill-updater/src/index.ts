import process from "node:process";
import { fileURLToPath } from "node:url";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  confirmUpdate,
  getUpdaterLinks,
  parseCliOptions,
  printHelp
} from "./cli.ts";
import {
  installSkillFiles,
  localSkillFingerprint
} from "./installation.ts";
import {
  fetchGitHubRelease,
  loadRemoteSkillFiles,
  resolveRemoteSkillPackage
} from "./release.ts";
import type { UpdaterConfig } from "./types.ts";

declare const __SKILL_UPDATE_CONFIG__: UpdaterConfig;

const UPDATE_CONFIG = __SKILL_UPDATE_CONFIG__;
const updaterScriptPath = fileURLToPath(import.meta.url);

export const skillUpdaterConfig: Readonly<UpdaterConfig> = Object.freeze({
  ...UPDATE_CONFIG
});

export async function runSkillUpdaterCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
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
  console.log(`Package lock asset: ${skillUpdaterConfig.packageLockAssetName}`);
  console.log(`Release asset: ${skillUpdaterConfig.releaseAssetName}`);
  console.log(`Target: ${options.targetDir}`);

  const release = await fetchGitHubRelease(skillUpdaterConfig, options.releaseTag);
  console.log(`Resolved release: ${release.tag_name} (${release.html_url})`);

  const remotePackage = await resolveRemoteSkillPackage(skillUpdaterConfig, release);
  if (remotePackage.source === "package-lock") {
    console.log(`Package lock asset: ${skillUpdaterConfig.packageLockAssetName}`);
    console.log(`Package aggregate fingerprint: ${remotePackage.aggregateHash}`);
  } else {
    console.log(
      `Package lock asset: ${skillUpdaterConfig.packageLockAssetName}`
      + " (missing; falling back to zip fingerprint)"
    );
  }

  const currentFingerprint = await localSkillFingerprint(
    skillUpdaterConfig,
    options.targetDir
  );
  console.log(`Remote fingerprint: ${remotePackage.fingerprint}`);
  console.log(`Local fingerprint: ${currentFingerprint ?? "(missing)"}`);

  if (currentFingerprint === remotePackage.fingerprint) {
    console.log("Status: current");
    return 0;
  }

  console.log(currentFingerprint ? "Status: update available" : "Status: target missing");
  if (options.check) {
    return 1;
  }

  if (!await confirmUpdate(options)) {
    return 1;
  }

  const remoteFiles = await loadRemoteSkillFiles(
    skillUpdaterConfig,
    release,
    remotePackage
  );
  await installSkillFiles(remoteFiles, options.targetDir);
  console.log("Updated skill successfully.");
  return 0;
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runSkillUpdaterCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
