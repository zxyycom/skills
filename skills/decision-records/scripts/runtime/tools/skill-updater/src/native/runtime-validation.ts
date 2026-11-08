/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/native/runtime-validation.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/native/runtime-validation.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/native/runtime-validation.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  compatibleUpdaterDependencies,
  updaterDependencyHook
} from "./updater-dependencies.ts";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import type {
  NativeRole,
  NativeTarget
} from "../../../skill-package/src/native-release-manifest.ts";

const glibcReportSchema = v.object({
  header: v.object({ glibcVersionRuntime: v.string() })
});

function assertGlibc(): void {
  const report = v.safeParse(glibcReportSchema, process.report.getReport());
  if (!report.success)
    throw new Error("native Linux runtime requires glibc 2.35 or newer");
  const match = /^(\d+)\.(\d+)/.exec(report.output.header.glibcVersionRuntime);
  const major = Number(match?.[1]);
  const minor = Number(match?.[2]);
  const supported = major > 2 || (major === 2 && minor >= 35);
  if (!supported)
    throw new Error("native Linux runtime requires glibc 2.35 or newer");
}

export function nativeHostTarget(): NativeTarget {
  if (process.arch !== "x64") throw new Error("native runtime requires x64");
  if (process.platform === "win32") return "x86_64-pc-windows-msvc";
  if (process.platform !== "linux")
    throw new Error("unsupported native platform");
  assertGlibc();
  return "x86_64-unknown-linux-gnu";
}

function runChecked(
  command: string,
  args: readonly string[],
  expected?: string
): void {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 1024 * 1024
  });
  if (
    result.error ||
    result.status !== 0 ||
    (expected !== undefined && result.stdout.trim() !== expected)
  )
    throw new Error(
      `prepared command failed: ${path.basename(command)} ${args.join(" ")}`
    );
}

/** Validate the actual final-path runtime before enabling SKILL.md. */
export async function validateNativeRuntime(
  root: string,
  role: NativeRole,
  target: NativeTarget,
  version: string
): Promise<void> {
  const binary = path.join(
    root,
    "bin",
    target === "x86_64-pc-windows-msvc" ? `${role}.exe` : role
  );
  runChecked(binary, ["--version"], `${role} ${version}`);
  runChecked(binary, ["--help"]);
  const schema =
    role === "decision-records"
      ? "decision-index.schema.json"
      : "investigation-index.schema.json";
  const value: unknown = JSON.parse(
    await fs.readFile(path.join(root, "references", schema), "utf8")
  );
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("prepared schema is invalid");
  await verifyPreparedUpdater(root);
}

/** Prefer target resolution; fallback only for missing known dependencies and compatible explicit inputs. */
export async function verifyPreparedUpdater(root: string): Promise<void> {
  const script = path.join(root, "scripts/update-skill.ts");
  const options = {
    encoding: "utf8" as const,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, NODE_OPTIONS: "" }
  };
  const direct = spawnSync(process.execPath, [script, "--help"], options);
  if (!direct.error && direct.status === 0) {
    return;
  }
  const missing = /Cannot find package ['"](fflate|valibot|yaml)['"]/u.exec(
    direct.stderr ?? ""
  );
  if (!missing || !(direct.stderr ?? "").includes("ERR_MODULE_NOT_FOUND")) {
    throw new Error(
      "prepared updater --help failed; install compatible dependencies explicitly"
    );
  }
  await compatibleUpdaterDependencies(root);
  const fallback = spawnSync(
    process.execPath,
    ["--import", updaterDependencyHook(), script, "--help"],
    options
  );
  if (fallback.error || fallback.status !== 0) {
    throw new Error(
      "prepared updater --help failed with the explicitly installed validation dependencies"
    );
  }
}
