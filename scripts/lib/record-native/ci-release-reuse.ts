import { createHash } from "node:crypto";
import * as v from "valibot";
import { extractNativeArchive } from "../../../tools/skill-updater/src/native/archive.ts";
import { nativeBuildRecipePaths } from "./candidate-build-recipe.ts";
import {
  nativeRoles,
  nativeTargets
} from "../../../tools/skill-package/src/native-release-manifest.ts";

const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/));
const identity = v.strictObject({ sha256: hash, files: v.array(v.string()) });
const asset = v.strictObject({
  name: v.string(),
  byteLength: v.pipe(v.number(), v.integer(), v.minValue(1)),
  sha256: hash
});
const provenanceSchema = v.strictObject({
  schemaVersion: v.literal(1),
  buildRevision: v.pipe(v.string(), v.regex(/^[a-f0-9]{40,64}$/)),
  runtimeVersion: v.string(),
  source: identity,
  buildDelivery: identity,
  recipe: v.record(v.string(), hash),
  platforms: v.record(v.string(), v.unknown()),
  assets: v.array(asset)
});
export type BuildProvenance = v.InferOutput<typeof provenanceSchema>;
export type RemoteAsset = {
  id: number;
  name: string;
  size: number;
  digest: string | null;
};
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

type BuildInputs = {
  runtimeVersion: string;
  source: { sha256: string; files: readonly string[] };
  recipe: Readonly<Record<string, string>>;
  releaseId: number;
};
function validateBuildIdentity(
  proofBytes: Uint8Array,
  input: BuildInputs
): BuildProvenance {
  const previous = v.parse(
    provenanceSchema,
    JSON.parse(Buffer.from(proofBytes).toString("utf8")) as unknown
  );
  if (previous.runtimeVersion !== input.runtimeVersion)
    throw new Error("runtime version does not match frozen source");
  if (!Number.isSafeInteger(input.releaseId) || input.releaseId <= 0)
    throw new Error("invalid pinned release ID");
  if (
    previous.source.sha256 !== input.source.sha256 ||
    JSON.stringify(previous.source.files) !== JSON.stringify(input.source.files)
  )
    throw new Error(
      "runtime source changed; a new runtime version is required"
    );
  validateBuildRecipeAndAssets(previous, input.recipe);
  return previous;
}

function validateBuildRecipeAndAssets(
  previous: BuildProvenance,
  recipe: Readonly<Record<string, string>>
): void {
  const recipeNames = [...nativeBuildRecipePaths].sort();
  if (
    JSON.stringify(Object.keys(previous.recipe).sort()) !==
      JSON.stringify(recipeNames) ||
    JSON.stringify(Object.keys(recipe).sort()) !==
      JSON.stringify(recipeNames) ||
    recipeNames.some((name) => previous.recipe[name] !== recipe[name])
  )
    throw new Error(
      "runtime recipe changed; a new runtime version is required"
    );
  const names = nativeRoles
    .flatMap((role) => runtimeNames(role, previous.runtimeVersion))
    .sort();
  const assetNames = previous.assets.map((entry) => entry.name).sort();
  if (
    JSON.stringify(assetNames) !== JSON.stringify(names) ||
    JSON.stringify(Object.keys(previous.platforms).sort()) !==
      JSON.stringify([...nativeTargets].sort())
  )
    throw new Error("runtime provenance asset or platform set differs");
}

function runtimeNames(
  role: (typeof nativeRoles)[number],
  runtimeVersion: string
): string[] {
  return nativeTargets.map(
    (target) => `${role}-${runtimeVersion}-${target}.zip`
  );
}

/** Verify a durable first-upload bundle and every already published member. */
export function validateRuntimeRecovery(
  input: BuildInputs & {
    recoveryId: number;
    remoteAssets: readonly RemoteAsset[];
    downloaded: ReadonlyMap<number, Uint8Array>;
  }
): BuildProvenance {
  if (!Number.isSafeInteger(input.recoveryId) || input.recoveryId <= 0)
    throw new Error("invalid recovery asset ID");
  const recoveryName = `record-native-recovery-${input.runtimeVersion}.zip`;
  const proofName = `record-native-build-${input.runtimeVersion}.json`;
  const recovery = input.remoteAssets.filter(
    (item) => item.id === input.recoveryId && item.name === recoveryName
  );
  const recoveryBytes = input.downloaded.get(input.recoveryId);
  if (
    recovery.length !== 1 ||
    !recovery[0] ||
    !recoveryBytes ||
    recovery[0].size !== recoveryBytes.byteLength ||
    recovery[0].digest !== `sha256:${sha(recoveryBytes)}`
  )
    throw new Error("published recovery identity mismatch");
  const members = extractNativeArchive(recoveryBytes);
  const proofBytes = members.get(proofName);
  if (!proofBytes) throw new Error("recovery provenance missing");
  const previous = validateBuildIdentity(proofBytes, input);
  const names = [proofName, ...previous.assets.map((item) => item.name)].sort();
  if (JSON.stringify([...members.keys()].sort()) !== JSON.stringify(names))
    throw new Error("recovery member set differs");
  const entries = [
    {
      name: names.find((name) => name.endsWith(".json"))!,
      byteLength: proofBytes.byteLength,
      sha256: sha(proofBytes)
    },
    ...previous.assets
  ];
  const ids = new Set<number>([input.recoveryId]);
  verifyRecoveryMembers(entries, members, input, ids);
  return previous;
}

function verifyRecoveryMembers(
  entries: BuildProvenance["assets"],
  members: ReadonlyMap<string, Buffer>,
  input: {
    remoteAssets: readonly RemoteAsset[];
    downloaded: ReadonlyMap<number, Uint8Array>;
  },
  ids: Set<number>
): void {
  for (const entry of entries) {
    const bytes = members.get(entry.name);
    if (
      !bytes ||
      bytes.byteLength !== entry.byteLength ||
      sha(bytes) !== entry.sha256
    )
      throw new Error(`recovery member mismatch: ${entry.name}`);
    const matches = input.remoteAssets.filter(
      (item) => item.name === entry.name
    );
    if (matches.length > 1)
      throw new Error(`duplicate published asset: ${entry.name}`);
    if (matches.length === 0) continue;
    const remote = matches[0]!;
    const published = input.downloaded.get(remote.id);
    if (
      !Number.isSafeInteger(remote.id) ||
      remote.id <= 0 ||
      ids.has(remote.id) ||
      remote.size !== entry.byteLength ||
      remote.digest !== `sha256:${entry.sha256}` ||
      !published ||
      published.byteLength !== entry.byteLength ||
      sha(published) !== entry.sha256
    )
      throw new Error(`published asset conflicts with recovery: ${entry.name}`);
    ids.add(remote.id);
  }
}

/** Verify reuse against immutable build inputs and actual bytes, not version names alone. */
export function validateRuntimeReuse(
  input: BuildInputs & {
    provenanceId: number;
    remoteAssets: readonly RemoteAsset[];
    downloaded: ReadonlyMap<number, Uint8Array>;
  }
): BuildProvenance {
  const proofName = `record-native-build-${input.runtimeVersion}.json`;
  const proof = input.remoteAssets.filter(
    (item) => item.id === input.provenanceId && item.name === proofName
  );
  const proofAsset = proof[0];
  const proofBytes = input.downloaded.get(input.provenanceId);
  if (
    proof.length !== 1 ||
    !proofAsset ||
    !proofBytes ||
    proofAsset.size !== proofBytes.byteLength ||
    proofAsset.digest !== `sha256:${sha(proofBytes)}`
  )
    throw new Error("published build provenance identity mismatch");
  const previous = validateBuildIdentity(proofBytes, input);
  const ids = new Set<number>([input.provenanceId]);
  verifyPublishedRuntimes(previous.assets, input, ids);
  return previous;
}

function verifyPublishedRuntimes(
  assets: BuildProvenance["assets"],
  input: {
    remoteAssets: readonly RemoteAsset[];
    downloaded: ReadonlyMap<number, Uint8Array>;
  },
  ids: Set<number>
): void {
  for (const entry of assets) {
    const matches = input.remoteAssets.filter(
      (item) => item.name === entry.name
    );
    const remote = matches[0];
    if (
      matches.length !== 1 ||
      !remote ||
      !Number.isSafeInteger(remote.id) ||
      remote.id <= 0 ||
      ids.has(remote.id) ||
      remote.size !== entry.byteLength ||
      remote.digest !== `sha256:${entry.sha256}`
    )
      throw new Error(`published runtime identity mismatch: ${entry.name}`);
    ids.add(remote.id);
    const bytes = input.downloaded.get(remote.id);
    if (
      !bytes ||
      bytes.byteLength !== entry.byteLength ||
      sha(bytes) !== entry.sha256
    )
      throw new Error(`published runtime bytes mismatch: ${entry.name}`);
  }
}
