/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-package/src/native-release-manifest.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-package/src/native-release-manifest.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-package/src/native-release-manifest.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { createHash } from "node:crypto";
import * as v from "valibot";
import {
  skillReleaseManifestSchema,
  skillVersionSchema
} from "./release-manifest.ts";

export const nativeRoles = [
  "decision-records",
  "investigation-report"
] as const;
export const nativeTargets = [
  "x86_64-unknown-linux-gnu",
  "x86_64-pc-windows-msvc"
] as const;
export type NativeRole = (typeof nativeRoles)[number];
export type NativeTarget = (typeof nativeTargets)[number];

const digest = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/));
const version = v.pipe(
  v.string(),
  v.regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
);
const asset = v.strictObject({
  name: v.pipe(v.string(), v.regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.zip$/)),
  byteLength: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1),
    v.maxValue(Number.MAX_SAFE_INTEGER)
  ),
  sha256: digest
});
const extension = v.strictObject({
  schemaVersion: v.literal(1),
  runtimeVersion: version,
  sourceHash: digest,
  package: asset,
  targets: v.strictObject({
    "x86_64-unknown-linux-gnu": asset,
    "x86_64-pc-windows-msvc": asset
  }),
  bootstrap: asset
});
const nativeEntry = v.object({
  version: skillVersionSchema,
  native: extension
});
export type NativeRelease = v.InferOutput<typeof nativeEntry>;

/** Parse the raw manifest: the generic manifest parser deliberately drops extensions. */
export function parseNativeRelease(
  input: unknown,
  role: NativeRole
): NativeRelease {
  const base = v.safeParse(skillReleaseManifestSchema, input);
  if (!base.success) throw new Error("invalid base skill release manifest");
  const raw = input as { skills: Record<string, unknown> };
  const parsed = v.safeParse(nativeEntry, raw.skills[role]);
  if (!parsed.success)
    throw new Error(`invalid native release metadata: ${role}`);
  const value = parsed.output;
  const native = value.native;
  if (
    native.package.name !== `${role}-native.zip` ||
    native.bootstrap.name !== "record-native-installer.zip"
  )
    throw new Error(`invalid native package or bootstrap name: ${role}`);
  for (const target of nativeTargets) {
    if (
      native.targets[target].name !==
      `${role}-${native.runtimeVersion}-${target}.zip`
    )
      throw new Error(`invalid native target asset name: ${role} ${target}`);
  }
  const names = [
    native.package.name,
    native.bootstrap.name,
    ...nativeTargets.map((target) => native.targets[target].name)
  ];
  if (new Set(names).size !== names.length)
    throw new Error("duplicate native asset name");
  return value;
}

const descriptor = v.strictObject({
  schemaVersion: v.literal(1),
  role: v.picklist(nativeRoles),
  runtimeVersion: version,
  sourceHash: digest,
  targets: v.pipe(v.array(v.picklist(nativeTargets)), v.length(2))
});
export type NativeRuntimeDescriptor = v.InferOutput<typeof descriptor>;

/** Verify package identity before a candidate can be activated. */
export function parseNativeRuntimeDescriptor(
  input: unknown,
  role: NativeRole,
  release: NativeRelease
): NativeRuntimeDescriptor {
  const parsed = v.safeParse(descriptor, input);
  if (
    !parsed.success ||
    parsed.output.role !== role ||
    new Set(parsed.output.targets).size !== 2 ||
    parsed.output.runtimeVersion !== release.native.runtimeVersion ||
    parsed.output.sourceHash !== release.native.sourceHash
  )
    throw new Error(
      `native runtime descriptor does not match release: ${role}`
    );
  return parsed.output;
}

/** Validate the two independently versioned skills against one native build. */
export function parseNativeReleasePair(
  input: unknown
): Record<NativeRole, NativeRelease> {
  const decision = parseNativeRelease(input, "decision-records");
  const investigation = parseNativeRelease(input, "investigation-report");
  const left = decision.native;
  const right = investigation.native;
  if (
    left.runtimeVersion !== right.runtimeVersion ||
    left.sourceHash !== right.sourceHash ||
    left.bootstrap.name !== right.bootstrap.name ||
    left.bootstrap.sha256 !== right.bootstrap.sha256 ||
    left.bootstrap.byteLength !== right.bootstrap.byteLength
  )
    throw new Error(
      "native releases do not share a build and bootstrap identity"
    );
  return {
    "decision-records": decision,
    "investigation-report": investigation
  };
}

/** Reject missing, ambiguous or byte-mismatched assets before unpacking. */
export function verifyNativeAsset(
  expected: NativeRelease["native"]["package"],
  data: Uint8Array
): void {
  if (
    data.byteLength !== expected.byteLength ||
    createHash("sha256").update(data).digest("hex") !== expected.sha256
  )
    throw new Error(`native asset does not match manifest: ${expected.name}`);
}

export function selectNativeAsset<T extends { name: string }>(
  assets: readonly T[],
  name: string
): T {
  const matches = assets.filter((asset) => asset.name === name);
  if (matches.length !== 1)
    throw new Error(`native asset missing or ambiguous: ${name}`);
  return matches[0]!;
}
