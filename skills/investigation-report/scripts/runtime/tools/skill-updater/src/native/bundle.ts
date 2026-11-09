/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/native/bundle.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/native/bundle.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/native/bundle.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { readSkillPackageIdentityFromMarkdown } from "../../../skill-package/src/version.ts";
import { assertNativeRelativePaths } from "../../../skill-package/src/native-paths.ts";
import {
  parseNativeRuntimeDescriptor,
  verifyNativeAsset,
  type NativeRole,
  type NativeTarget,
  type NativeRelease
} from "../../../skill-package/src/native-release-manifest.ts";
import { extractNativeArchive } from "./archive.ts";
import type { SkillFile } from "../types.ts";

const utf8 = new TextDecoder("utf-8", { fatal: true });

function readSkillFiles(
  role: NativeRole,
  packageZip: Uint8Array,
  release: NativeRelease
): SkillFile[] {
  const archive = extractNativeArchive(packageZip);
  const files: SkillFile[] = [];
  for (const [name, data] of archive) {
    if (!name.startsWith(`${role}/`))
      throw new Error(`package contains an unrelated member: ${name}`);
    files.push({ path: name.slice(role.length + 1), data });
  }
  const byName = new Map(files.map((file) => [file.path, file.data]));
  const entry = byName.get("SKILL.md");
  const descriptor = byName.get("native-runtime.json");
  const schema =
    role === "decision-records"
      ? "decision-index.schema.json"
      : "investigation-index.schema.json";
  if (
    !entry ||
    !descriptor ||
    !byName.has(`references/${schema}`) ||
    !byName.has("scripts/update-skill.ts")
  )
    throw new Error(
      "native package is missing required identity, schema or updater"
    );
  const identity = readSkillPackageIdentityFromMarkdown(utf8.decode(entry));
  if (identity.name !== role || identity.version !== release.version)
    throw new Error("native package skill identity does not match release");
  parseNativeRuntimeDescriptor(
    JSON.parse(utf8.decode(descriptor)),
    role,
    release
  );
  return files;
}

/** Validate the selected role and target from one validated release before producing files. */
export function prepareNativeBundle(input: {
  role: NativeRole;
  target: NativeTarget;
  release: NativeRelease;
  packageZip: Uint8Array;
  runtimeZip: Uint8Array;
}): SkillFile[] {
  const { role, target } = input;
  const { release } = input;
  verifyNativeAsset(release.native.package, input.packageZip);
  verifyNativeAsset(release.native.targets[target], input.runtimeZip);
  const files = readSkillFiles(role, input.packageZip, release);
  const executable = target === "x86_64-pc-windows-msvc" ? `${role}.exe` : role;
  const runtime = extractNativeArchive(input.runtimeZip);
  const binary = runtime.get(executable);
  if (runtime.size !== 1 || !binary)
    throw new Error(
      "native runtime archive does not contain exactly the selected binary"
    );
  files.push({ path: `bin/${executable}`, data: binary });
  assertNativeRelativePaths(files.map((file) => file.path));
  return files;
}
