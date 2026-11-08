/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/native/legacy-plan.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/native/legacy-plan.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/native/legacy-plan.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import fs from "node:fs/promises";
import path from "node:path";
import { assertNativeRelativePaths } from "../../../skill-package/src/native-paths.ts";
import { localSkillState } from "../installation.ts";
import { findUnknownLegacyDomainFiles } from "./legacy-namespaces.ts";
import {
  verifyLegacyInstallation,
  type LegacyFile
} from "./legacy-preflight.ts";

export type LegacyManifest = Readonly<{
  version: number;
  files: Readonly<Record<string, LegacyFile>>;
}>;
export type LegacyHandoffPlan = Readonly<{
  add: readonly string[];
  replace: readonly string[];
  retire: readonly string[];
}>;

async function missingDestination(
  root: string,
  relative: string
): Promise<boolean> {
  const parts = relative.split("/");
  let current = root;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]!);
    try {
      const info = await fs.lstat(current);
      if (
        index === parts.length - 1 ||
        info.isSymbolicLink() ||
        !info.isDirectory()
      )
        return false;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return true;
      throw error;
    }
  }
  return false;
}

function validateIncomingPaths(incoming: readonly string[]): void {
  assertNativeRelativePaths(incoming);
  if (
    !incoming.includes("SKILL.md") ||
    !incoming.includes("native-runtime.json")
  )
    throw new Error("native package is missing its entry or descriptor");
  if (
    incoming.some((name) =>
      name.split("/").some((part) => part.toLowerCase() === "node_modules")
    )
  )
    throw new Error("native package must not replace installed dependencies");
}

/** A conflict-free plan is evidence for preflight, not authorization to write. */
export async function planLegacyHandoff(
  target: string,
  role: string,
  legacy: LegacyManifest,
  incoming: readonly string[]
): Promise<LegacyHandoffPlan> {
  validateIncomingPaths(incoming);
  const root = path.resolve(target);
  const state = await localSkillState(root, role);
  if (state.state !== "versioned" || state.version !== legacy.version)
    throw new Error(`unsupported legacy skill version for ${role}`);
  const conflicts = await verifyLegacyInstallation(root, legacy.files);
  if (conflicts.length)
    throw new Error(
      `legacy managed files changed or missing: ${conflicts.join(", ")}`
    );
  const old = Object.keys(legacy.files);
  const unknown = await findUnknownLegacyDomainFiles(root, role, new Set(old));
  if (unknown.length)
    throw new Error(
      `unknown files occupy retired domain paths: ${unknown.join(", ")}`
    );
  assertNativeRelativePaths([...new Set([...old, ...incoming])]);
  const oldPaths = new Set(old);
  const add: string[] = [];
  const replace: string[] = [];
  for (const name of incoming) {
    if (oldPaths.has(name)) {
      replace.push(name);
      continue;
    }
    if (!(await missingDestination(root, name)))
      throw new Error(`native path conflicts with local file: ${name}`);
    add.push(name);
  }
  const next = new Set(incoming);
  return {
    add: add.sort(),
    replace: replace.sort(),
    retire: old.filter((name) => !next.has(name)).sort()
  };
}
