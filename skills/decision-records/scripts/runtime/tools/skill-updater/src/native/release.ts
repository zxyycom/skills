/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/native/release.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/native/release.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/native/release.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  selectNativeAsset,
  parseNativeReleasePair,
  type NativeRelease,
  type NativeReleasePair,
  type NativeRole,
  type NativeTarget
} from "../../../skill-package/src/native-release-manifest.ts";
import { prepareNativeBundle } from "./bundle.ts";
import type { SkillFile } from "../types.ts";

type ReleaseAsset = Readonly<{ name: string; url: string }>;
export type NativeReleaseInput = Readonly<{
  repo: string;
  assets: readonly ReleaseAsset[];
  role: NativeRole;
  target: NativeTarget;
  token: string | null;
}>;
const MANIFEST = "skill-release-manifest.json";
const MAX_ASSET = 128 * 1024 * 1024;

function assertAssetOrigin(repo: string, asset: ReleaseAsset): void {
  const parts = repo.split("/");
  if (
    parts.length !== 2 ||
    parts.some((part) => !/^[a-zA-Z0-9_.-]+$/.test(part))
  )
    throw new Error("invalid repository identity");
  const url = new URL(asset.url);
  const expected = `/repos/${parts[0]}/${parts[1]}/releases/assets/`;
  const hasExtraParts = [
    url.port,
    url.username,
    url.password,
    url.search,
    url.hash
  ].some(Boolean);
  const expectedPath = url.pathname
    .toLowerCase()
    .startsWith(expected.toLowerCase());
  const assetId = url.pathname.slice(expected.length);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "api.github.com" ||
    hasExtraParts ||
    !expectedPath ||
    !/^\d+$/.test(assetId)
  )
    throw new Error(
      `release asset origin does not match repository: ${asset.name}`
    );
}

async function boundedBody(response: Response, limit: number): Promise<Buffer> {
  if (!response.body) throw new Error("release asset response has no body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new Error("release asset exceeds download limit");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

async function downloadAsset(
  input: NativeReleaseInput,
  name: string,
  limit: number
): Promise<Buffer> {
  const asset = selectNativeAsset(input.assets, name);
  assertAssetOrigin(input.repo, asset);
  const headers: Record<string, string> = {
    Accept: "application/octet-stream",
    "User-Agent": "skill-self-updater",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (input.token) headers.Authorization = `Bearer ${input.token}`;
  const response = await fetch(asset.url, { headers });
  if (!response.ok)
    throw new Error(
      `release asset request failed: ${name} (${response.status})`
    );
  return await boundedBody(response, limit);
}

/** Read the release manifest without downloading either archive. */
export async function loadNativeManifest(
  input: NativeReleaseInput
): Promise<NativeReleasePair> {
  const data = await downloadAsset(input, MANIFEST, 1024 * 1024);
  const manifest: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(data)
  );
  return parseNativeReleasePair(manifest);
}

/** Download and verify the selected package and runtime against one manifest. */
export async function loadNativeReleaseBundle(
  input: NativeReleaseInput,
  release: NativeRelease
): Promise<SkillFile[]> {
  const packageZip = await downloadAsset(
    input,
    release.native.package.name,
    MAX_ASSET
  );
  const runtimeZip = await downloadAsset(
    input,
    release.native.targets[input.target].name,
    MAX_ASSET
  );
  return prepareNativeBundle({
    ...input,
    release,
    packageZip,
    runtimeZip
  });
}
