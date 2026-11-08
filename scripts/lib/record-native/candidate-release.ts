import { verifyNativeBuildRecipe } from "./candidate-build-recipe.ts";
import type { SkillPackageFile } from "../skill-package/skill-package-hash.ts";
import { schemaFile, validateCandidateSchema } from "./candidate-schemas.ts";
import { extractNativeArchive } from "../../../tools/skill-updater/src/native/archive.ts";
import { readSkillPackageVersion } from "../skill-package/skill-package-hash.ts";
import { createHash } from "node:crypto";
import * as v from "valibot";
import {
  nativeRoles,
  nativeTargets,
  type NativeRole,
  type NativeTarget
} from "../../../tools/skill-package/src/native-release-manifest.ts";
import { skillReleaseManifestSchema } from "../../../tools/skill-package/src/release-manifest.ts";
import {
  verifyCandidatePackageManifest,
  type prepareCandidateSourcePackages
} from "./candidate-package.ts";
import { digestNativeSource, type NativeCandidateSnapshot } from "./capture.ts";

type Prepared = ReturnType<typeof prepareCandidateSourcePackages>;
type PlatformInput = Readonly<{
  revision: string;
  sourceFiles: readonly string[];
  sourceHash: string;
  buildDelivery: { sha256: string; files: string[] };
  metadata: unknown;
  archives: Readonly<Record<NativeRole, Uint8Array>>;
}>;
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/));
const reportSchema = v.object({
  schemaVersion: v.literal(1),
  runtimeVersion: v.string(),
  sourceHash: hash,
  target: v.picklist(nativeTargets),
  toolchain: v.object({ rustc: v.string(), cargo: v.string() }),
  environment: v.object({
    platform: v.string(),
    architecture: v.string(),
    kernel: v.string(),
    glibc: v.nullable(v.string())
  }),
  assets: v.array(
    v.object({
      role: v.picklist(nativeRoles),
      name: v.string(),
      byteLength: v.number(),
      sha256: hash
    })
  )
});
function asset(name: string, bytes: Uint8Array) {
  return {
    name,
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}
function validatePlatformBaseline(
  report: v.InferOutput<typeof reportSchema>,
  target: NativeTarget
): void {
  const expectedPlatform =
    target === "x86_64-pc-windows-msvc" ? "win32" : "linux";
  if (
    report.environment.platform !== expectedPlatform ||
    report.environment.architecture !== "x64" ||
    !report.environment.kernel ||
    (expectedPlatform === "linux"
      ? report.environment.glibc !== "2.35"
      : report.environment.glibc !== null) ||
    !report.toolchain.rustc.startsWith("rustc 1.98.1 ") ||
    !report.toolchain.rustc.includes(`host: ${target}`) ||
    !report.toolchain.cargo.startsWith("cargo 1.98.1 ")
  )
    throw new Error(`candidate platform baseline mismatch: ${target}`);
}
function validatePlatform(
  input: PlatformInput,
  target: NativeTarget,
  snapshot: NativeCandidateSnapshot,
  version: string,
  revision: string
): v.InferOutput<typeof reportSchema> {
  const report = v.parse(reportSchema, input.metadata);
  if (
    input.revision !== revision ||
    report.target !== target ||
    report.runtimeVersion !== version ||
    report.sourceHash !== snapshot.sourceHash ||
    input.sourceHash !== snapshot.sourceHash ||
    JSON.stringify(input.sourceFiles) !==
      JSON.stringify(snapshot.source.map((file) => file.path))
  )
    throw new Error(`candidate platform provenance mismatch: ${target}`);
  validatePlatformBaseline(report, target);
  for (const role of nativeRoles) {
    const name = `${role}-${version}-${target}.zip`;
    const entries = report.assets.filter(
      (item) => item.role === role && item.name === name
    );
    const actual = asset(name, input.archives[role]);
    if (
      entries.length !== 1 ||
      entries[0]?.byteLength !== actual.byteLength ||
      entries[0]?.sha256 !== actual.sha256
    )
      throw new Error(`candidate platform asset mismatch: ${role} ${target}`);
  }
  if (report.assets.length !== nativeRoles.length)
    throw new Error(`candidate platform asset set is invalid: ${target}`);
  return report;
}

function validateOtherArchives(
  snapshot: NativeCandidateSnapshot,
  versions: Record<string, { version: number }>,
  archives: Readonly<Record<string, Uint8Array>>
) {
  const expected = Object.keys(versions)
    .filter((name) => !nativeRoles.some((role) => role === name))
    .sort();
  if (JSON.stringify(Object.keys(archives).sort()) !== JSON.stringify(expected))
    throw new Error("other skill archive set differs from base manifest");
  return expected.map((name) => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name))
      throw new Error(`invalid other skill asset name: ${name}`);
    const files = snapshot.skills.filesBySkill.get(name);
    const bytes = archives[name];
    if (
      !files ||
      !bytes ||
      readSkillPackageVersion(name, files) !== versions[name]?.version
    )
      throw new Error(`other skill snapshot differs from manifest: ${name}`);
    const contents = extractNativeArchive(bytes);
    if (
      contents.size !== files.length ||
      files.some(
        (file) => !contents.get(`${name}/${file.path}`)?.equals(file.data)
      )
    )
      throw new Error(
        `other skill archive differs from frozen snapshot: ${name}`
      );
    return { asset: asset(`${name}.zip`, bytes), bytes };
  });
}

function runtimeAssets(
  archives: Record<NativeRole, Record<NativeTarget, Uint8Array>>,
  version: string
) {
  return nativeRoles.flatMap((role) =>
    nativeTargets.map((target) => ({
      asset: asset(`${role}-${version}-${target}.zip`, archives[role][target]),
      bytes: archives[role][target]
    }))
  );
}

function verifySnapshot(
  snapshot: NativeCandidateSnapshot,
  revision: string
): void {
  if (!/^[a-f0-9]{40,64}$/.test(revision))
    throw new Error("invalid candidate revision");
  if (
    digestNativeSource(snapshot.source) !== snapshot.sourceHash ||
    digestNativeSource(snapshot.delivery) !== snapshot.deliveryHash
  )
    throw new Error("candidate snapshot digest changed");
}

/** Bind the platform's comparison record and source list to the pending snapshot. */
export function validatePlatformSourceEvidence(input: {
  source: unknown;
  comparison: unknown;
  snapshot: NativeCandidateSnapshot;
  version: string;
  revision: string;
  target: NativeTarget;
}): {
  source: { sha256: string; files: string[] };
  buildDelivery: { sha256: string; files: string[] };
} {
  const source = v.parse(
    v.strictObject({ sha256: hash, files: v.array(v.string()) }),
    input.source
  );
  const comparison = v.parse(
    v.object({
      revision: v.string(),
      delivery: v.object({ sha256: hash, files: v.array(v.string()) }),
      versions: v.array(v.string()),
      sources: v.array(v.object({ sha256: hash, files: v.array(v.string()) }))
    }),
    input.comparison
  );
  const index = comparison.versions.indexOf(input.version);
  if (
    comparison.revision !== input.revision ||
    index < 0 ||
    comparison.versions.length !== comparison.sources.length ||
    new Set(comparison.versions).size !== comparison.versions.length
  )
    throw new Error(
      `candidate platform revision or version missing: ${input.target}`
    );
  const selected = comparison.sources[index];
  if (
    !selected ||
    source.sha256 !== selected.sha256 ||
    source.sha256 !== input.snapshot.sourceHash ||
    JSON.stringify(source.files) !== JSON.stringify(selected.files) ||
    JSON.stringify(source.files) !==
      JSON.stringify(input.snapshot.source.map((file) => file.path))
  )
    throw new Error(
      `candidate platform source evidence differs: ${input.target}`
    );
  return { source, buildDelivery: comparison.delivery };
}

function buildCandidateManifestParts(
  input: CandidateReleaseInput,
  versions: Record<string, { version: number }>
) {
  const original = input.baseManifest as { skills: Record<string, unknown> };
  const skills: Record<string, unknown> = { ...original.skills };
  const targetArchives = {} as Record<
    NativeRole,
    Record<NativeTarget, Uint8Array>
  >;
  for (const role of nativeRoles) {
    if (
      !versions[role] ||
      input.prepared.versions[role] <= versions[role].version
    )
      throw new Error(
        `candidate version must exceed the legacy package: ${role}`
      );
    const targets = {} as Record<NativeTarget, ReturnType<typeof asset>>;
    targetArchives[role] = {} as Record<NativeTarget, Uint8Array>;
    for (const target of nativeTargets) {
      const bytes = input.platforms[target].archives[role];
      targetArchives[role][target] = bytes;
      targets[target] = asset(
        `${role}-${input.runtimeVersion}-${target}.zip`,
        bytes
      );
    }
    skills[role] = {
      version: input.prepared.versions[role],
      native: {
        schemaVersion: 1,
        runtimeVersion: input.runtimeVersion,
        sourceHash: input.snapshot.sourceHash,
        package: input.prepared.packages[role].asset,
        targets,
        bootstrap: input.prepared.bootstrap.asset
      }
    };
  }
  return { skills, targetArchives };
}

/** Assemble only explicitly supplied artifacts from the same frozen source and revision. */
type CandidateReleaseInput = {
  snapshot: NativeCandidateSnapshot;
  prepared: Prepared;
  baseManifest: unknown;
  runtimeVersion: string;
  revision: string;
  pendingBaseRevision: string;
  pendingMatchesBase: boolean;
  platforms: Readonly<Record<NativeTarget, PlatformInput>>;
  otherArchives: Readonly<Record<string, Uint8Array>>;
  buildRecipe: readonly SkillPackageFile[];
};

export function assembleCandidateRelease(input: CandidateReleaseInput) {
  verifySnapshot(input.snapshot, input.revision);
  if (!/^[a-f0-9]{40,64}$/.test(input.pendingBaseRevision))
    throw new Error("invalid pending base revision");
  const recipeHashes = verifyNativeBuildRecipe(
    input.snapshot.delivery,
    input.buildRecipe
  );
  if (
    JSON.stringify(input.platforms[nativeTargets[0]].buildDelivery) !==
    JSON.stringify(input.platforms[nativeTargets[1]].buildDelivery)
  )
    throw new Error("candidate platform build delivery evidence differs");
  const base = v.parse(skillReleaseManifestSchema, input.baseManifest);
  const reports = Object.fromEntries(
    nativeTargets.map((target) => [
      target,
      validatePlatform(
        input.platforms[target],
        target,
        input.snapshot,
        input.runtimeVersion,
        input.revision
      )
    ])
  );
  const otherAssets = validateOtherArchives(
    input.snapshot,
    base.skills,
    input.otherArchives
  );
  const { skills, targetArchives } = buildCandidateManifestParts(
    input,
    base.skills
  );
  const schemas = {} as Record<NativeRole, Uint8Array>;
  for (const role of nativeRoles) {
    const name = `tools/record-contracts/schemas/${schemaFile(role)}`;
    const source = input.snapshot.delivery.find((file) => file.path === name);
    if (!source) throw new Error(`frozen schema missing: ${role}`);
    validateCandidateSchema(
      role,
      input.prepared.packages[role].bytes,
      source.data
    );
    schemas[role] = source.data;
  }
  const manifest = { schemaVersion: 1, skills };
  verifyCandidatePackageManifest(
    manifest,
    input.prepared,
    input.snapshot.sourceHash,
    input.runtimeVersion,
    targetArchives
  );
  const assets = [
    ...otherAssets,
    input.prepared.bootstrap,
    ...nativeRoles.map((role) => input.prepared.packages[role]),
    ...runtimeAssets(targetArchives, input.runtimeVersion)
  ];
  const provenance = {
    buildRevision: input.revision,
    pendingBaseRevision: input.pendingBaseRevision,
    pendingMatchesBase: input.pendingMatchesBase,
    buildDeliveryHash: input.platforms[nativeTargets[0]].buildDelivery.sha256,
    sourceHash: input.snapshot.sourceHash,
    currentDeliveryHash: input.snapshot.deliveryHash,
    recipeHashes,
    sourceFiles: input.snapshot.source.map((file) => file.path),
    buildDeliveryFiles: input.platforms[nativeTargets[0]].buildDelivery.files,
    skillInputHashes: Object.fromEntries(
      [...input.snapshot.skills.filesBySkill].map(([name, files]) => [
        name,
        digestNativeSource(files)
      ])
    ),
    platforms: reports,
    assetHashes: Object.fromEntries(
      assets.map((item) => [item.asset.name, item.asset.sha256])
    )
  };
  return { manifest, assets, schemas, provenance };
}

export { writeCandidateRelease } from "./candidate-release-output.ts";
