import process from "node:process";
import {
  confirmUpdate,
  getUpdaterLinks,
  parseCliOptions
} from "./update-skill/cli.ts";
import {
  installSkillFiles,
  localSkillFingerprint
} from "./update-skill/installation.ts";
import {
  fetchGitHubRelease,
  loadRemoteSkillFiles,
  resolveRemoteSkillPackage
} from "./update-skill/release.ts";
import type { UpdaterConfig } from "./update-skill/types.ts";

const UPDATE_CONFIG = JSON.parse("__SKILL_UPDATE_CONFIG_JSON__") as UpdaterConfig;

async function main(): Promise<void> {
  const options = parseCliOptions(UPDATE_CONFIG, process.argv.slice(2));
  const links = getUpdaterLinks(UPDATE_CONFIG);

  console.log(`Skill: ${UPDATE_CONFIG.skillName}`);
  console.log(`Repository: ${links.sourceRepositoryUrl}`);
  console.log(`Updater source: ${links.updaterSourceUrl}`);
  console.log(`Skill source directory: ${links.skillSourceDirectoryUrl}`);
  console.log(`Release: ${options.releaseTag ?? "latest"}`);
  console.log(`Package lock asset: ${UPDATE_CONFIG.packageLockAssetName}`);
  console.log(`Release asset: ${UPDATE_CONFIG.releaseAssetName}`);
  console.log(`Target: ${options.targetDir}`);

  const release = await fetchGitHubRelease(UPDATE_CONFIG, options.releaseTag);
  console.log(`Resolved release: ${release.tag_name} (${release.html_url})`);

  const remotePackage = await resolveRemoteSkillPackage(UPDATE_CONFIG, release);
  if (remotePackage.source === "package-lock") {
    console.log(`Package lock asset: ${UPDATE_CONFIG.packageLockAssetName}`);
    console.log(`Package aggregate fingerprint: ${remotePackage.aggregateHash}`);
  } else {
    console.log(
      `Package lock asset: ${UPDATE_CONFIG.packageLockAssetName}`
      + " (missing; falling back to zip fingerprint)"
    );
  }

  const currentFingerprint = await localSkillFingerprint(
    UPDATE_CONFIG,
    options.targetDir
  );
  console.log(`Remote fingerprint: ${remotePackage.fingerprint}`);
  console.log(`Local fingerprint: ${currentFingerprint ?? "(missing)"}`);

  if (currentFingerprint === remotePackage.fingerprint) {
    console.log("Status: current");
    return;
  }

  console.log(currentFingerprint ? "Status: update available" : "Status: target missing");
  if (options.check) {
    process.exitCode = 1;
    return;
  }

  if (!await confirmUpdate(options)) {
    process.exitCode = 1;
    return;
  }

  const remoteFiles = await loadRemoteSkillFiles(
    UPDATE_CONFIG,
    release,
    remotePackage
  );
  await installSkillFiles(remoteFiles, options.targetDir);
  console.log("Updated skill successfully.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
