import { verifyAssetContents } from "./candidate-publish-content.ts";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { extractNativeArchive } from "../../../tools/skill-updater/src/native/archive.ts";
import * as v from "valibot";
import { skillReleaseManifestSchema } from "../../../tools/skill-package/src/release-manifest.ts";
import {
  nativeRoles,
  nativeTargets,
  parseNativeReleasePair
} from "../../../tools/skill-package/src/native-release-manifest.ts";
import type { PublishedAsset } from "../publishing/publish-skills-types.ts";
import type {
  CandidatePublishAsset,
  CandidatePublishInput
} from "./candidate-publish.ts";
const manifestName = "skill-release-manifest.json";
function digest(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
export function matches(
  actual: PublishedAsset | undefined,
  expected: CandidatePublishAsset
): boolean {
  return (
    actual?.name === expected.name &&
    actual.size === expected.size &&
    actual.digest === expected.digest
  );
}
export function prepareCandidatePublish(release: CandidatePublishInput): {
  assets: CandidatePublishAsset[];
  runtime: Set<string>;
} {
  const base = v.parse(skillReleaseManifestSchema, release.manifest);
  const pair = parseNativeReleasePair(release.manifest);
  if (pair["decision-records"].native.runtimeVersion === "0.1.0")
    throw new Error("private runtime 0.1.0 cannot be published");
  const expected = new Map<
    string,
    { name: string; byteLength: number; sha256: string }
  >();
  const runtime = new Set<string>();
  const buildProof = `record-native-build-${pair["decision-records"].native.runtimeVersion}.json`;
  const recoveryName = `record-native-recovery-${pair["decision-records"].native.runtimeVersion}.zip`;
  for (const role of nativeRoles) {
    const native = pair[role].native;
    for (const item of [
      native.package,
      native.bootstrap,
      ...nativeTargets.map((target) => native.targets[target])
    ]) {
      const previous = expected.get(item.name);
      if (
        previous &&
        (previous.sha256 !== item.sha256 ||
          previous.byteLength !== item.byteLength)
      )
        throw new Error(`conflicting manifest asset ${item.name}`);
      expected.set(item.name, item);
    }
    for (const target of nativeTargets)
      runtime.add(native.targets[target].name);
  }
  const other = Object.keys(base.skills).filter(
    (name) => !nativeRoles.some((role) => role === name)
  );
  for (const name of other)
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name))
      throw new Error(`invalid skill name: ${name}`);
  const names = new Set([
    ...expected.keys(),
    ...other.map((name) => `${name}.zip`),
    buildProof,
    recoveryName
  ]);
  if (
    names.size !== expected.size + other.length + 2 ||
    release.assets.length !== names.size
  )
    throw new Error("candidate asset set mismatch");
  const assets = release.assets.map(({ asset, bytes }) => {
    if (
      !names.delete(asset.name) ||
      asset.byteLength <= 0 ||
      !Number.isSafeInteger(asset.byteLength) ||
      !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      bytes.byteLength !== asset.byteLength ||
      digest(bytes) !== `sha256:${asset.sha256}`
    )
      throw new Error(`candidate asset mismatch: ${asset.name}`);
    const reference = expected.get(asset.name);
    if (
      reference &&
      (reference.byteLength !== asset.byteLength ||
        reference.sha256 !== asset.sha256)
    )
      throw new Error(`manifest asset mismatch: ${asset.name}`);
    const copy = Uint8Array.from(bytes);
    return {
      name: asset.name,
      bytes: copy,
      size: copy.byteLength,
      digest: digest(copy)
    };
  });
  if (names.size) throw new Error("missing candidate assets");
  verifyRecoveryAssets(
    release,
    pair,
    assets,
    runtime,
    buildProof,
    recoveryName
  );
  assets.sort(
    (a, b) => Number(b.name === recoveryName) - Number(a.name === recoveryName)
  );
  verifyAssetContents(release.manifest, assets, release.schemas);
  const bytes = Buffer.from(`${JSON.stringify(release.manifest, null, 2)}\n`);
  assets.push({
    name: manifestName,
    bytes,
    size: bytes.byteLength,
    digest: digest(bytes)
  });
  return { assets, runtime };
}

function verifyRecoveryAssets(
  release: CandidatePublishInput,
  pair: ReturnType<typeof parseNativeReleasePair>,
  assets: CandidatePublishAsset[],
  runtime: Set<string>,
  buildProof: string,
  recoveryName: string
): void {
  const proofAsset = assets.find((item) => item.name === buildProof);
  if (!proofAsset) throw new Error("formal runtime build provenance missing");
  const provenance = release.provenance;
  const proof = {
    schemaVersion: 1,
    buildRevision: provenance.buildRevision,
    runtimeVersion: pair["decision-records"].native.runtimeVersion,
    source: { sha256: provenance.sourceHash, files: provenance.sourceFiles },
    buildDelivery: {
      sha256: provenance.buildDeliveryHash,
      files: provenance.buildDeliveryFiles
    },
    recipe: provenance.recipeHashes,
    platforms: provenance.platforms,
    assets: nativeRoles.flatMap((role) =>
      nativeTargets.map((target) => pair[role].native.targets[target])
    )
  };
  if (
    !isDeepStrictEqual(
      JSON.parse(Buffer.from(proofAsset.bytes).toString("utf8")),
      proof
    )
  )
    throw new Error(
      "formal runtime build provenance differs from verified assets"
    );
  runtime.add(buildProof);
  const recovery = assets.find((item) => item.name === recoveryName);
  if (!recovery) throw new Error("formal runtime recovery asset missing");
  const members = extractNativeArchive(recovery.bytes);
  const required = [
    proofAsset,
    ...assets.filter(
      (item) => runtime.has(item.name) && item.name !== buildProof
    )
  ];
  if (
    members.size !== required.length ||
    required.some(
      (item) => !members.get(item.name)?.equals(Buffer.from(item.bytes))
    )
  )
    throw new Error(
      "formal runtime recovery bytes differ from verified assets"
    );
  runtime.add(recoveryName);
}
