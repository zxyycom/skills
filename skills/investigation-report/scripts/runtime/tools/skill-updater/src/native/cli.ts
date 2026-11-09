/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/native/cli.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/native/cli.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/native/cli.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { fileURLToPath } from "node:url";
import { type NativeRole } from "../../../skill-package/src/native-release-manifest.ts";
import {
  confirmUpdate,
  parseCliOptions,
  printGitHubAuthWarning
} from "../cli.ts";
import { resolveGitHubAuthentication } from "../github-auth.ts";
import { localSkillState } from "../installation.ts";
import { fetchGitHubRelease } from "../release.ts";
import type { UpdaterConfig } from "../types.ts";
import { applyOverlay, planOverlay } from "./overlay.ts";
import { existingNativeAncestor } from "./directory.ts";
import { loadNativeManifest, loadNativeReleaseBundle } from "./release.ts";
import {
  nativeHostTarget,
  validateNativeRuntime
} from "./runtime-validation.ts";

/** Shared entry for the native updater and explicit installer. */
export async function runNativeUpdaterCli(
  config: Readonly<UpdaterConfig>,
  role: NativeRole,
  moduleUrl: string,
  argv: readonly string[] = process.argv.slice(2),
  bootstrap = false
): Promise<number> {
  const script = fileURLToPath(moduleUrl);
  const options = parseCliOptions(config, argv, script);
  if (options.help) {
    console.log(
      `Usage: node ${script} [--check] [--yes] [--target-dir <dir>] [--release-tag <tag>]\n${bootstrap ? "Installer requires an explicit --target-dir and can reinstall the same version." : "Updates this native skill."}\n--check compares versions only; --yes confirms the listed writes.`
    );
    return 0;
  }
  if (
    bootstrap &&
    !argv.some(
      (arg) => arg === "--target-dir" || arg.startsWith("--target-dir=")
    )
  )
    throw new Error("bootstrap requires an explicit --target-dir");
  if (config.skillName !== role)
    throw new Error("native role does not match updater configuration");
  const target = nativeHostTarget();
  await existingNativeAncestor(options.targetDir);
  const state = await localSkillState(options.targetDir, role);
  const authentication = resolveGitHubAuthentication();
  if (authentication.token === null)
    printGitHubAuthWarning(authentication.reason);
  const release = await fetchGitHubRelease(
    config,
    options.releaseTag,
    authentication.token
  );
  const input = {
    repo: config.repo,
    assets: release.assets,
    role,
    target,
    token: authentication.token
  };
  const manifest = await loadNativeManifest(input);
  const remote = manifest[role];
  const current =
    state.state === "versioned" && state.version === remote.version;
  if (options.check || (current && !bootstrap)) {
    console.log(
      current
        ? "Status: current version (files not checked)"
        : "Status: update available or not installed"
    );
    return current ? 0 : 1;
  }
  if (state.state === "versioned" && state.version > remote.version)
    throw new Error("native downgrade is not supported");
  const files = await loadNativeReleaseBundle(input, remote);
  const plan = await planOverlay(options.targetDir, files);
  for (const key of ["add", "replace"] as const)
    console.log(
      `${key}: ${plan[key].length ? plan[key].join(", ") : "(none)"}`
    );
  console.log("Other local files are preserved.");
  if (!(await confirmUpdate(options))) return 1;
  await applyOverlay(
    options.targetDir,
    files,
    async () =>
      await validateNativeRuntime(
        options.targetDir,
        role,
        target,
        remote.native.runtimeVersion
      )
  );
  console.log("Native skill installed.");
  return 0;
}
