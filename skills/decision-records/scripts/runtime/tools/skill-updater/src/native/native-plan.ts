/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/native/native-plan.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/native/native-plan.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/native/native-plan.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import fs from "node:fs/promises";
import * as v from "valibot";
import { validateRecoveryPath } from "./legacy-resume.ts";
import { assertNativeDirectory } from "./directory.ts";
import path from "node:path";
import { assertNativeRelativePaths } from "../../../skill-package/src/native-paths.ts";
import {
  type NativeRole,
  type NativeTarget
} from "../../../skill-package/src/native-release-manifest.ts";
import { readSkillPackageIdentityFromMarkdown } from "../../../skill-package/src/version.ts";
import type { SkillFile } from "../types.ts";
import { verifyInstalledNativeEvidence } from "./installed-evidence.ts";
import { receiptPath } from "./legacy-state.ts";
import { readTargetFile } from "./transaction-files.ts";
import { findUnknownLegacyDomainFiles } from "./legacy-namespaces.ts";
import type { LegacyHandoffPlan } from "./legacy-plan.ts";

async function existingDirectory(root: string): Promise<boolean> {
  try {
    await assertNativeDirectory(root);
    return true;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
    const parent = path.dirname(root);
    await assertNativeDirectory(parent);
    return false;
  }
}

function incomingVersion(
  files: readonly SkillFile[],
  role: NativeRole
): number {
  const names = files.map((file) => file.path);
  assertNativeRelativePaths([...names, receiptPath]);
  const entry = files.find((file) => file.path === "SKILL.md");
  if (!entry || !names.includes("native-runtime.json"))
    throw new Error("native package is missing its entry or descriptor");
  const identity = readSkillPackageIdentityFromMarkdown(
    new TextDecoder("utf-8", { fatal: true }).decode(entry.data)
  );
  if (identity.name !== role || identity.version === null)
    throw new Error("native package has wrong skill identity");
  return identity.version;
}

async function classifyPaths(
  root: string,
  exists: boolean,
  old: readonly string[],
  names: readonly string[]
): Promise<LegacyHandoffPlan> {
  assertNativeRelativePaths([...new Set([...old, ...names])]);
  const oldSet = new Set(old);
  const add: string[] = [],
    replace: string[] = [];
  for (const name of names) {
    if (oldSet.has(name)) replace.push(name);
    else {
      if (exists && (await readTargetFile(root, name)))
        throw new Error(`native path conflicts with local file: ${name}`);
      add.push(name);
    }
  }
  const next = new Set(names);
  return {
    add: add.sort(),
    replace: replace.sort(),
    retire: old.filter((name) => !next.has(name)).sort()
  };
}

async function assertNoPendingRecovery(
  root: string,
  bytes: Buffer
): Promise<void> {
  const raw: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  );
  const parsed = v.safeParse(v.object({ backup: v.string() }), raw);
  if (!parsed.success) throw new Error("invalid native recovery receipt");
  const stage = validateRecoveryPath(root, parsed.output.backup);
  try {
    await fs.lstat(stage);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return;
    throw error;
  }
  throw new Error(
    "native cleanup pending; resume before starting another update"
  );
}

/** Read-only fresh or previously verified native plan. No receipt alone authorizes a deletion. */
export async function planNativeHandoff(input: {
  target: string;
  role: NativeRole;
  platform: NativeTarget;
  files: readonly SkillFile[];
}): Promise<LegacyHandoffPlan> {
  const root = path.resolve(input.target);
  const version = incomingVersion(input.files, input.role);
  const exists = await existingDirectory(root);
  const previousReceipt = exists
    ? await readTargetFile(root, receiptPath)
    : null;
  const previous = previousReceipt
    ? await verifyInstalledNativeEvidence(root, input.role, input.platform)
    : [];
  if (previousReceipt)
    await assertNoPendingRecovery(root, previousReceipt.bytes);
  const old = previous.map((file) => file.path);
  if (previousReceipt) {
    old.push(receiptPath);
    if (version < incomingVersion(previous, input.role))
      throw new Error("native downgrade is not supported");
  }
  const names = [...input.files.map((file) => file.path), receiptPath];
  const known = new Set([...old, ...names]);
  const unknown = exists
    ? await findUnknownLegacyDomainFiles(root, input.role, known)
    : [];
  if (unknown.length)
    throw new Error(
      `unknown files occupy retired domain paths: ${unknown.join(", ")}`
    );
  return await classifyPaths(root, exists, old, names);
}
