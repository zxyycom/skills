import { prepareNativeBundle } from "../../../tools/skill-updater/src/native/bundle.ts";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { type Zippable, zipSync } from "fflate";
import { readSkillPackageIdentityFromMarkdown } from "../../../tools/skill-package/src/version.ts";
import * as v from "valibot";
import { assertNativeRelativePaths } from "../../../tools/skill-package/src/native-paths.ts";
import {
  nativeRoles,
  nativeTargets,
  parseNativeReleasePair,
  verifyNativeAsset,
  type NativeRole
} from "../../../tools/skill-package/src/native-release-manifest.ts";
import type { SkillPackageFile } from "../skill-package/skill-package-hash.ts";
import { digestNativeSource, type NativeCandidateSnapshot } from "./capture.ts";
import { assertRuntimeDirectory } from "./runtime.ts";

const zipOptions = { level: 9 as const, mtime: new Date(1980, 0, 1) };
type Asset = Readonly<{ name: string; byteLength: number; sha256: string }>;
type Archive = Readonly<{ asset: Asset; bytes: Buffer }>;

/** Inputs must be produced from the same frozen pending snapshot, not the worktree. */
export type CandidatePackageInputs = Readonly<{
  snapshot: NativeCandidateSnapshot;
  runtimeVersion: string;
  schemas: Readonly<Record<NativeRole, Buffer>>;
  bootstrap: Readonly<{ files: readonly SkillPackageFile[]; entry: string }>;
}>;

function required(files: readonly SkillPackageFile[], name: string): Buffer {
  const found = files.find((file) => file.path === name);
  if (!found || found.data.byteLength === 0)
    throw new Error(`candidate input missing or empty: ${name}`);
  return found.data;
}

function archive(
  name: string,
  prefix: string,
  files: readonly SkillPackageFile[]
): Archive {
  assertNativeRelativePaths(files.map((file) => file.path));
  const entries: Zippable = {};
  for (const file of [...files].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0
  ))
    entries[`${prefix}/${file.path}`] = [file.data, zipOptions];
  const bytes = Buffer.from(zipSync(entries, zipOptions));
  return {
    asset: {
      name,
      byteLength: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    },
    bytes
  };
}

function prepareRole(
  input: CandidatePackageInputs,
  role: NativeRole
): { version: number; archive: Archive } {
  const { snapshot, runtimeVersion } = input;
  const files = snapshot.skills.filesBySkill.get(role);
  if (!files || !snapshot.skills.skills.some((skill) => skill.name === role))
    throw new Error(`candidate skill missing: ${role}`);
  assertNativeRelativePaths(files.map((file) => file.path));
  required(files, "scripts/update-skill.ts");
  required(files, "package.json");
  required(files, "pnpm-lock.yaml");
  const schema =
    role === "decision-records"
      ? "decision-index.schema.json"
      : "investigation-index.schema.json";
  const frozenSchema = required(
    snapshot.delivery,
    `tools/record-contracts/schemas/${schema}`
  );
  if (
    !frozenSchema.equals(input.schemas[role]) ||
    !required(files, `references/${schema}`).equals(frozenSchema)
  )
    throw new Error(`candidate schema differs from frozen source: ${role}`);
  if (
    files.some(
      (file) =>
        /(^|\/)(bin|node_modules)\//.test(file.path) ||
        /\.(exe|dll|so|dylib)$/.test(file.path) ||
        /^scripts\/runtime\/tools\/(decision-records|investigation-report|record-operations|index-runtime)\//.test(
          file.path
        ) ||
        /^scripts\/(decision-records|check-investigations)(\.|-sdk\/)/i.test(
          file.path
        )
    )
  )
    throw new Error(
      `candidate contains a binary or retired domain SDK: ${role}`
    );
  let descriptor: unknown;
  try {
    descriptor = JSON.parse(
      required(files, "native-runtime.json").toString("utf8")
    );
  } catch {
    throw new Error(`invalid native descriptor: ${role}`);
  }
  const parsed = v.safeParse(
    v.strictObject({
      schemaVersion: v.literal(1),
      role: v.literal(role),
      runtimeVersion: v.literal(runtimeVersion),
      sourceHash: v.literal(snapshot.sourceHash),
      targets: v.pipe(v.array(v.picklist(nativeTargets)), v.length(2))
    }),
    descriptor
  );
  if (!parsed.success || new Set(parsed.output.targets).size !== 2)
    throw new Error(
      `native runtime descriptor does not match frozen source: ${role}`
    );
  const identity = readSkillPackageIdentityFromMarkdown(
    required(files, "SKILL.md").toString("utf8")
  );
  if (identity.name !== role || identity.version === null)
    throw new Error(`candidate skill identity mismatch: ${role}`);
  return {
    version: identity.version,
    archive: archive(`${role}-native.zip`, role, files)
  };
}

/** Builds only source ZIPs; binary/platform provenance and installability remain separate gates. */
export function prepareCandidateSourcePackages(
  input: CandidatePackageInputs
): Readonly<{
  packages: Readonly<Record<NativeRole, Archive>>;
  bootstrap: Archive;
  versions: Readonly<Record<NativeRole, number>>;
}> {
  const { snapshot, runtimeVersion } = input;
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(runtimeVersion))
    throw new Error("invalid native runtime version");
  if (digestNativeSource(snapshot.source) !== snapshot.sourceHash)
    throw new Error("native source snapshot digest changed");
  assertNativeRelativePaths(snapshot.delivery.map((file) => file.path));
  if (digestNativeSource(snapshot.delivery) !== snapshot.deliveryHash)
    throw new Error("native delivery snapshot digest changed");
  const packages = {} as Record<NativeRole, Archive>;
  const versions = {} as Record<NativeRole, number>;
  for (const role of nativeRoles) {
    const prepared = prepareRole(input, role);
    versions[role] = prepared.version;
    packages[role] = prepared.archive;
  }
  const { files, entry } = input.bootstrap;
  assertNativeRelativePaths(files.map((file) => file.path));
  required(files, entry);
  required(files, "package.json");
  required(files, "pnpm-lock.yaml");
  required(files, "README.md");
  if (
    files.some(
      (file) =>
        /(^|\/)(bin|node_modules)\//.test(file.path) ||
        /\.(exe|dll|so|dylib)$/.test(file.path) ||
        /^scripts\/runtime\/tools\/(decision-records|investigation-report|record-operations|index-runtime)\//.test(
          file.path
        )
    )
  )
    throw new Error("bootstrap contains a binary or retired domain SDK");
  return {
    packages,
    bootstrap: archive(
      "record-native-installer.zip",
      "record-native-installer",
      files
    ),
    versions
  };
}

/** Exclusive child of an already owned candidate stage; never deletes existing output. */
export async function writeCandidateSourcePackages(
  stage: string,
  prepared: ReturnType<typeof prepareCandidateSourcePackages>
): Promise<string> {
  await assertRuntimeDirectory(stage);
  const output = path.join(stage, "candidate-source-packages");
  await mkdir(output);
  for (const item of [
    prepared.bootstrap,
    ...nativeRoles.map((role) => prepared.packages[role])
  ])
    await writeFile(path.join(output, item.asset.name), item.bytes, {
      flag: "wx"
    });
  return output;
}

/** Check a completed manifest against these exact source archives and explicit target assets. */
export function verifyCandidatePackageManifest(
  rawManifest: unknown,
  prepared: ReturnType<typeof prepareCandidateSourcePackages>,
  sourceHash: string,
  runtimeVersion: string,
  targetArchives: Readonly<
    Record<
      NativeRole,
      Readonly<Record<(typeof nativeTargets)[number], Uint8Array>>
    >
  >
): void {
  const releases = parseNativeReleasePair(rawManifest);
  for (const role of nativeRoles) {
    const release = releases[role];
    if (
      release.version !== prepared.versions[role] ||
      release.native.sourceHash !== sourceHash ||
      release.native.runtimeVersion !== runtimeVersion
    )
      throw new Error(`candidate manifest identity mismatch: ${role}`);
    verifyNativeAsset(release.native.package, prepared.packages[role].bytes);
    verifyNativeAsset(release.native.bootstrap, prepared.bootstrap.bytes);
    for (const target of nativeTargets) {
      const data = targetArchives[role][target];
      verifyNativeAsset(release.native.targets[target], data);
      prepareNativeBundle({
        role,
        target,
        release,
        packageZip: prepared.packages[role].bytes,
        runtimeZip: data
      });
    }
  }
}
