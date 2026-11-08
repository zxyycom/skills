import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as v from "valibot";
import {
  parseNativeReleasePair,
  type NativeRole
} from "../../../skill-package/src/native-release-manifest.ts";
import {
  confirmUpdate,
  parseCliOptions,
  printGitHubAuthWarning
} from "../cli.ts";
import { resolveGitHubAuthentication } from "../github-auth.ts";
import { localSkillState } from "../installation.ts";
import { fetchGitHubRelease } from "../release.ts";
import type { CliOptions, SkillFile, UpdaterConfig } from "../types.ts";
import {
  prepareBundleWithEvidence,
  verifyInstalledNativeEvidence
} from "./installed-evidence.ts";
import {
  planLegacyHandoff,
  type LegacyHandoffPlan,
  type LegacyManifest
} from "./legacy-plan.ts";
import { activateLegacyBundle } from "./legacy-transaction.ts";
import { resumeLegacyCleanup } from "./legacy-resume.ts";
import { receiptPath } from "./legacy-state.ts";
import { planNativeHandoff } from "./native-plan.ts";
import { resumeNativeCleanup } from "./native-resume.ts";
import { activateNativeBundle } from "./native-transaction.ts";
import { loadNativeReleaseEvidence } from "./release.ts";
import {
  nativeHostTarget,
  validateNativeRuntime
} from "./runtime-validation.ts";
import { readTargetFile } from "./transaction-files.ts";

const legacySchema = v.object({
  skills: v.record(
    v.string(),
    v.object({
      version: v.number(),
      files: v.record(
        v.string(),
        v.object({ byteLength: v.number(), sha256: v.string() })
      )
    })
  )
});

async function trustedLegacy(role: NativeRole): Promise<LegacyManifest> {
  const raw: unknown = JSON.parse(
    await fs.readFile(
      new URL("./legacy-manifests.json", import.meta.url),
      "utf8"
    )
  );
  const parsed = v.safeParse(legacySchema, raw);
  const legacy = parsed.success ? parsed.output.skills[role] : undefined;
  if (!legacy)
    throw new Error(`supported legacy manifest is unavailable: ${role}`);
  return legacy;
}

function showHelp(script: string, bootstrap: boolean): void {
  console.log(
    [
      `Usage: node ${script} [--check] [--yes] [--target-dir <dir>] [--release-tag <tag>]`,
      bootstrap
        ? "Bootstrap requires --target-dir and never selects an existing user installation implicitly."
        : "Updates this native skill; no TypeScript domain fallback is used.",
      "Dependencies must already be installed; this command never installs them.",
      "--check performs a read-only readiness check; --yes confirms writes and recovery."
    ].join("\n")
  );
}

function reportPlan(plan: LegacyHandoffPlan): void {
  for (const key of ["add", "replace", "retire"] as const) {
    console.log(
      `${key}: ${plan[key].length ? plan[key].join(", ") : "(none)"}`
    );
  }
}

async function confirmPlan(
  options: CliOptions,
  plan: LegacyHandoffPlan
): Promise<boolean> {
  reportPlan(plan);
  return await confirmUpdate(options);
}

async function cleanupPending(
  root: string
): Promise<{ legacyVersion: number } | null> {
  const receipt = await readTargetFile(root, receiptPath);
  if (!receipt) return null;
  const raw: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(receipt.bytes)
  );
  const parsed = v.safeParse(
    v.object({
      state: v.picklist(["cleanup-pending", "complete"]),
      backup: v.string(),
      legacyVersion: v.pipe(v.number(), v.integer(), v.minValue(0))
    }),
    raw
  );
  if (!parsed.success) throw new Error("invalid native receipt");
  if (parsed.output.state === "cleanup-pending")
    return { legacyVersion: parsed.output.legacyVersion };
  try {
    await fs.lstat(parsed.output.backup);
    return { legacyVersion: parsed.output.legacyVersion };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw error;
  }
}

function sameFiles(
  left: readonly SkillFile[],
  right: readonly SkillFile[]
): boolean {
  const independent = (file: SkillFile) =>
    file.path !== ".record-native-evidence/manifest.json";
  const lookup = new Map(
    left.filter(independent).map((file) => [file.path, file.data])
  );
  const selected = right.filter(independent);
  return (
    lookup.size === selected.length &&
    selected.every((file) => lookup.get(file.path)?.equals(file.data))
  );
}

/** Shared entry for the native skill updater and explicit isolated bootstrap. */
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
    showHelp(script, bootstrap);
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
  const state = await localSkillState(options.targetDir, role);
  const authentication = resolveGitHubAuthentication();
  if (authentication.token === null)
    printGitHubAuthWarning(authentication.reason);
  const release = await fetchGitHubRelease(
    config,
    options.releaseTag,
    authentication.token
  );
  const evidence = await loadNativeReleaseEvidence({
    repo: config.repo,
    assets: release.assets,
    role,
    target,
    token: authentication.token
  });
  const raw: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(evidence.manifestBytes)
  );
  const remote = parseNativeReleasePair(raw)[role];
  const files = prepareBundleWithEvidence(evidence);
  const isNative =
    (await readTargetFile(options.targetDir, receiptPath)) !== null;
  const pending = isNative ? await cleanupPending(options.targetDir) : null;
  const validatePrepared = async (root: string) =>
    await validateNativeRuntime(
      root,
      role,
      target,
      remote.native.runtimeVersion
    );
  const confirm = async (plan: LegacyHandoffPlan) =>
    await confirmPlan(options, plan);
  if (pending) {
    if (options.check) {
      console.log("Status: cleanup pending");
      return 1;
    }
    const legacy = await trustedLegacy(role);
    if (pending.legacyVersion === legacy.version) {
      await resumeLegacyCleanup({
        target: options.targetDir,
        role,
        legacy,
        files,
        runtimeVersion: remote.native.runtimeVersion,
        sourceHash: remote.native.sourceHash,
        confirm,
        validatePrepared
      });
    } else {
      await resumeNativeCleanup({
        ...evidence,
        destination: options.targetDir,
        confirm,
        validatePrepared
      });
    }
    console.log("Native cleanup complete.");
    return 0;
  }
  if (isNative) {
    const installed = await verifyInstalledNativeEvidence(
      options.targetDir,
      role,
      target
    );
    if (state.state === "versioned" && state.version === remote.version) {
      if (!sameFiles(installed, files))
        throw new Error(
          "same skill version has different native assets; select a new release version"
        );
      if (options.check) {
        console.log("Status: current");
        return 0;
      }
    }
    const plan = await planNativeHandoff({
      target: options.targetDir,
      role,
      platform: target,
      files
    });
    if (options.check) {
      reportPlan(plan);
      return 1;
    }
    await activateNativeBundle({
      ...evidence,
      destination: options.targetDir,
      confirm,
      validatePrepared
    });
  } else if (state.state === "versioned") {
    const legacy = await trustedLegacy(role);
    if (remote.version <= legacy.version)
      throw new Error(
        "native release version must exceed the supported legacy version"
      );
    const plan = await planLegacyHandoff(options.targetDir, role, legacy, [
      ...files.map((file) => file.path),
      receiptPath
    ]);
    if (options.check) {
      reportPlan(plan);
      return 1;
    }
    await activateLegacyBundle({
      target: options.targetDir,
      role,
      legacy,
      files,
      runtimeVersion: remote.native.runtimeVersion,
      sourceHash: remote.native.sourceHash,
      confirm,
      validatePrepared
    });
  } else {
    const plan = await planNativeHandoff({
      target: options.targetDir,
      role,
      platform: target,
      files
    });
    if (options.check) {
      reportPlan(plan);
      return 1;
    }
    await activateNativeBundle({
      ...evidence,
      destination: options.targetDir,
      confirm,
      validatePrepared
    });
  }
  console.log("Native skill activation and cleanup complete.");
  return 0;
}
