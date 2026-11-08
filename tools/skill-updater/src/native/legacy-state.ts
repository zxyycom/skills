import { createHash } from "node:crypto";
import { assertNativeRelativePaths } from "../../../skill-package/src/native-paths.ts";
import { readSkillPackageIdentityFromMarkdown } from "../../../skill-package/src/version.ts";
import type { SkillFile } from "../types.ts";
import type { LegacyManifest, LegacyHandoffPlan } from "./legacy-plan.ts";
import { findUnknownLegacyDomainFiles } from "./legacy-namespaces.ts";

export const receiptPath = ".record-native-receipt.json";
export type LegacyTransactionOptions = Readonly<{
  target: string;
  role: string;
  legacy: LegacyManifest;
  files: readonly SkillFile[];
  runtimeVersion: string;
  sourceHash: string;
  confirm: (plan: LegacyHandoffPlan) => Promise<boolean>;
  validatePrepared: (target: string) => Promise<void>;
}>;

export function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
export function receipt(
  options: LegacyTransactionOptions,
  plan: LegacyHandoffPlan,
  backup: string,
  modes: ReadonlyMap<string, number>
): Buffer {
  return Buffer.from(
    `${JSON.stringify({ schemaVersion: 1, state: "cleanup-pending", role: options.role, runtimeVersion: options.runtimeVersion, sourceHash: options.sourceHash, legacyVersion: options.legacy.version, retired: plan.retire, backup, files: options.files.map((file) => ({ path: file.path, byteLength: file.data.length, sha256: digest(file.data), mode: modes.get(file.path) })) }, null, 2)}\n`
  );
}

export function assertFileModePolicy(
  files: readonly SkillFile[],
  modes: ReadonlyMap<string, number>
): void {
  for (const file of files) {
    const mode = modes.get(file.path);
    if (mode === undefined)
      throw new Error(`missing native file mode: ${file.path}`);
    if (process.platform === "win32") {
      // Windows chmod exposes the writable attribute, not POSIX execute/group bits.
      if ((mode & 0o200) === 0)
        throw new Error(
          `native file mode violates platform policy: ${file.path}`
        );
    } else {
      const expected = file.path.startsWith("bin/") ? 0o755 : 0o644;
      if (mode !== expected)
        throw new Error(
          `native file mode violates platform policy: ${file.path}`
        );
    }
  }
}

export async function rejectUnknownRetiredFiles(
  root: string,
  options: LegacyTransactionOptions
): Promise<void> {
  const known = new Set([
    ...Object.keys(options.legacy.files),
    ...options.files.map((file) => file.path)
  ]);
  const unknown = await findUnknownLegacyDomainFiles(root, options.role, known);
  if (unknown.length)
    throw new Error(
      `unknown files occupy retired domain paths: ${unknown.join(", ")}`
    );
}

export function validateTransactionOptions(options: LegacyTransactionOptions): {
  names: string[];
  entry: SkillFile;
} {
  const names = options.files.map((file) => file.path);
  assertNativeRelativePaths([...names, receiptPath]);
  const entry = options.files.find((file) => file.path === "SKILL.md");
  if (!entry) throw new Error("verified bundle is missing SKILL.md");
  const entryText = new TextDecoder("utf-8", { fatal: true }).decode(
    entry.data
  );
  const identity = readSkillPackageIdentityFromMarkdown(entryText);
  if (
    identity.name !== options.role ||
    identity.version === null ||
    identity.version <= options.legacy.version
  )
    throw new Error(
      "native skill identity must be newer than the legacy installation"
    );
  if (
    !/^[a-f0-9]{64}$/.test(options.sourceHash) ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(options.runtimeVersion)
  )
    throw new Error("invalid native runtime identity");
  return { names, entry };
}
