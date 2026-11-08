import { validatePlatform, type PlatformInput } from "./candidate-platform.ts";
export { validatePlatformSourceEvidence } from "./candidate-platform.ts";
import { verifyNativeBuildRecipe } from "./candidate-build-recipe.ts";
import type { SkillPackageFile } from "../skill-package/skill-package-hash.ts";
import { schemaFile, validateCandidateSchema } from "./candidate-schemas.ts";
import { extractNativeArchive } from "../../../tools/skill-updater/src/native/archive.ts";
import { readSkillPackageVersion } from "../skill-package/skill-package-hash.ts";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import * as v from "valibot";
import { zipSync } from "fflate";
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
function asset(name: string, bytes: Uint8Array) {
  return {
    name,
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
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

function verifyFormalPackages(input: CandidateReleaseInput): void {
  for (const role of nativeRoles) {
    const files = input.snapshot.skills.filesBySkill.get(role);
    const contents = extractNativeArchive(input.prepared.packages[role].bytes);
    if (
      !files ||
      contents.size !== files.length ||
      files.some(
        (file) => !contents.get(`${role}/${file.path}`)?.equals(file.data)
      )
    )
      throw new Error(`formal package differs from pending snapshot: ${role}`);
  }
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
      (input.formal
        ? input.prepared.versions[role] !== versions[role].version
        : input.prepared.versions[role] <= versions[role].version)
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
  formal?: boolean;
  recoveryBytes?: Uint8Array;
};

function verifyFrozenSchemas(
  input: CandidateReleaseInput
): Record<NativeRole, Uint8Array> {
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
  return schemas;
}

export function assembleCandidateRelease(input: CandidateReleaseInput) {
  verifySnapshot(input.snapshot, input.revision);
  if (input.formal) verifyFormalPackages(input);
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
  const schemas = verifyFrozenSchemas(input);
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
  if (input.formal)
    addFormalRecovery(input, recipeHashes, reports, targetArchives, assets);
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

function addFormalRecovery(
  input: CandidateReleaseInput,
  recipeHashes: Record<string, string>,
  reports: Record<string, unknown>,
  targetArchives: Record<NativeRole, Record<NativeTarget, Uint8Array>>,
  assets: { asset: ReturnType<typeof asset>; bytes: Uint8Array }[]
): void {
  const buildProof = {
    schemaVersion: 1,
    buildRevision: input.revision,
    runtimeVersion: input.runtimeVersion,
    source: {
      sha256: input.snapshot.sourceHash,
      files: input.snapshot.source.map((file) => file.path)
    },
    buildDelivery: input.platforms[nativeTargets[0]].buildDelivery,
    recipe: recipeHashes,
    platforms: reports,
    assets: runtimeAssets(targetArchives, input.runtimeVersion).map(
      (item) => item.asset
    )
  };
  const proofName = `record-native-build-${input.runtimeVersion}.json`;
  const oldMembers = input.recoveryBytes
    ? extractNativeArchive(input.recoveryBytes)
    : undefined;
  const oldProof = oldMembers?.get(proofName);
  if (
    oldMembers &&
    (!oldProof ||
      !isDeepStrictEqual(JSON.parse(oldProof.toString("utf8")), buildProof))
  )
    throw new Error("reused runtime recovery provenance differs");
  const bytes =
    oldProof ?? Buffer.from(`${JSON.stringify(buildProof, null, 2)}\n`);
  assets.push({ asset: asset(proofName, bytes), bytes });
  const runtime = runtimeAssets(targetArchives, input.runtimeVersion);
  const generatedRecovery = Buffer.from(
    zipSync(
      Object.fromEntries([
        [proofName, [bytes, { level: 9, mtime: new Date(1980, 0, 1) }]],
        ...runtime.map((item) => [
          item.asset.name,
          [item.bytes, { level: 9, mtime: new Date(1980, 0, 1) }]
        ])
      ])
    )
  );
  if (
    oldMembers &&
    (oldMembers.size !== runtime.length + 1 ||
      runtime.some(
        (item) =>
          !oldMembers.get(item.asset.name)?.equals(Buffer.from(item.bytes))
      ))
  )
    throw new Error("reused runtime recovery members differ");
  const recovery = input.recoveryBytes
    ? Buffer.from(input.recoveryBytes)
    : generatedRecovery;
  assets.unshift({
    asset: asset(
      `record-native-recovery-${input.runtimeVersion}.zip`,
      recovery
    ),
    bytes: recovery
  });
}
