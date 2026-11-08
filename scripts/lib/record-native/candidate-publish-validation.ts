import { verifyAssetContents } from "./candidate-publish-content.ts";
import { createHash } from "node:crypto";
import * as v from "valibot";
import { skillReleaseManifestSchema } from "../../../tools/skill-package/src/release-manifest.ts";
import {
  nativeRoles,
  nativeTargets,
  parseNativeReleasePair
} from "../../../tools/skill-package/src/native-release-manifest.ts";
import type { assembleCandidateRelease } from "./candidate-release.ts";
import type { PublishedAsset } from "../publishing/publish-skills-types.ts";
import type { CandidatePublishAsset } from "./candidate-publish.ts";
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
export function prepareCandidatePublish(
  release: ReturnType<typeof assembleCandidateRelease>
): {
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
    ...other.map((name) => `${name}.zip`)
  ]);
  if (
    names.size !== expected.size + other.length ||
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
