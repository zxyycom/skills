import { matches } from "./candidate-publish-validation.ts";
import type {
  CandidatePublishAsset,
  CandidatePublishRemote
} from "./candidate-publish.ts";
import type { PublishedAsset } from "../publishing/publish-skills-types.ts";

const legacy = ["decision-records.zip", "investigation-report.zip"] as const;
const manifestName = "skill-release-manifest.json";
export type PublishContext = {
  tag: string;
  commit: string;
  remote: CandidatePublishRemote;
  phase: string;
  oldTag: string | undefined;
  notes: string;
};
function check(
  items: readonly PublishedAsset[] | undefined,
  wanted: readonly CandidatePublishAsset[]
): boolean {
  return wanted.every((asset) =>
    matches(
      items?.find((item) => item.name === asset.name),
      asset
    )
  );
}
export async function publishSnapshot(
  context: PublishContext,
  assets: readonly CandidatePublishAsset[],
  existing: readonly PublishedAsset[] | undefined
): Promise<"created" | "reused"> {
  const { tag, commit, oldTag, remote } = context;
  if (existing) {
    if (
      oldTag !== commit ||
      existing.length !== assets.length ||
      !check(existing, assets) ||
      (await remote.readNotes(tag)) !== context.notes
    )
      throw new Error(
        "snapshot exists with missing, different or unexpected assets or tag"
      );
    return "reused";
  }
  if (oldTag !== undefined)
    throw new Error("snapshot tag exists without release");
  context.phase = "create snapshot";
  await remote.createRelease(tag, commit, assets, false, context.notes);
  context.phase = "verify snapshot";
  const current = await remote.readRelease(tag);
  if (
    (await remote.readTag(tag)) !== commit ||
    !current ||
    current.length !== assets.length ||
    !check(current, assets) ||
    (await remote.readNotes(tag)) !== context.notes
  )
    throw new Error("snapshot verification failed");
  return "created";
}
async function uploadPackages(
  context: PublishContext,
  packages: readonly CandidatePublishAsset[],
  existing: readonly PublishedAsset[]
): Promise<readonly PublishedAsset[]> {
  context.phase = "upload and verify assets";
  for (const asset of packages) {
    const current = existing.find((item) => item.name === asset.name);
    if (!matches(current, asset))
      await context.remote.upload(context.tag, asset, current !== undefined);
  }
  const current = await context.remote.readRelease(context.tag);
  if (!current || !check(current, packages))
    throw new Error(
      "uploaded assets do not match expected names, sizes and digests"
    );
  return current;
}
async function retireLegacy(
  context: PublishContext,
  packages: readonly CandidatePublishAsset[],
  existing: readonly PublishedAsset[]
): Promise<readonly PublishedAsset[]> {
  context.phase = "retire legacy assets";
  for (const name of legacy)
    if (existing.some((item) => item.name === name))
      await context.remote.deleteLegacy(name);
  const current = await context.remote.readRelease(context.tag);
  if (
    !current ||
    !check(current, packages) ||
    legacy.some((name) => current.some((item) => item.name === name))
  )
    throw new Error("legacy retirement or assets verification failed");
  return current;
}
async function updateTag(context: PublishContext): Promise<void> {
  context.phase = "update rolling tag";
  const currentTag = await context.remote.readTag(context.tag);
  if (currentTag !== context.commit) {
    if (currentTag !== context.oldTag)
      throw new Error("rolling tag changed concurrently");
    await context.remote.updateRollingTag(context.commit, context.oldTag);
  }
  if ((await context.remote.readTag(context.tag)) !== context.commit)
    throw new Error("rolling tag verification failed");
}
async function publishManifest(
  context: PublishContext,
  assets: readonly CandidatePublishAsset[],
  existing: readonly PublishedAsset[]
): Promise<void> {
  const manifest = assets[assets.length - 1]!;
  context.phase = "publish manifest";
  if (
    !matches(
      existing.find((item) => item.name === manifestName),
      manifest
    )
  )
    await context.remote.upload(
      context.tag,
      manifest,
      existing.some((item) => item.name === manifestName)
    );
  context.phase = "verify complete release";
  const current = await context.remote.readRelease(context.tag);
  if (
    !current ||
    !check(current, assets) ||
    legacy.some((name) => current.some((item) => item.name === name)) ||
    (await context.remote.readTag(context.tag)) !== context.commit
  )
    throw new Error("rolling release verification failed");
}
async function isRollingLatest(context: PublishContext): Promise<boolean> {
  const id = await context.remote.readReleaseId(context.tag);
  const latest = await context.remote.readLatest();
  return id !== undefined && latest?.id === id && latest.tag === context.tag;
}
async function ensureRollingLatest(
  context: PublishContext,
  assets: readonly CandidatePublishAsset[]
): Promise<void> {
  context.phase = "verify rolling latest";
  if (!(await isRollingLatest(context))) {
    context.phase = "mark rolling latest";
    await context.remote.markLatest();
  }
  context.phase = "verify rolling latest";
  const release = await context.remote.readRelease(context.tag);
  if (
    !(await isRollingLatest(context)) ||
    !release ||
    !check(release, assets) ||
    (await context.remote.readNotes(context.tag)) !== context.notes ||
    legacy.some((name) => release.some((item) => item.name === name)) ||
    (await context.remote.readTag(context.tag)) !== context.commit
  )
    throw new Error("rolling latest verification failed");
}

export async function publishRolling(
  context: PublishContext,
  assets: readonly CandidatePublishAsset[],
  runtime: ReadonlySet<string>,
  prior: readonly PublishedAsset[] | undefined
): Promise<"created" | "updated" | "unchanged"> {
  const { tag, commit, oldTag, remote } = context;
  const packages = assets.slice(0, -1);
  let existing = prior;
  if (
    existing &&
    oldTag === commit &&
    check(existing, assets) &&
    legacy.every((name) => !existing?.some((item) => item.name === name)) &&
    (await remote.readNotes(tag)) === context.notes &&
    (await isRollingLatest(context))
  )
    return "unchanged";
  for (const asset of packages) {
    const current = existing?.find((item) => item.name === asset.name);
    if (current && runtime.has(asset.name) && !matches(current, asset))
      throw new Error(`immutable runtime conflict: ${asset.name}`);
  }
  if (!existing) {
    context.phase = "update rolling tag";
    await remote.updateRollingTag(commit, oldTag);
    context.phase = "create rolling release";
    await remote.createRelease(tag, commit, [], true, context.notes);
    existing = await remote.readRelease(tag);
    if (!existing) throw new Error("rolling release not found after creation");
  }
  existing = await uploadPackages(context, packages, existing);
  existing = await retireLegacy(context, packages, existing);
  await updateTag(context);
  await publishManifest(context, assets, existing);
  context.phase = "verify bootstrap instructions";
  if ((await remote.readNotes(tag)) !== context.notes)
    await remote.updateNotes(tag, context.notes);
  if ((await remote.readNotes(tag)) !== context.notes)
    throw new Error("release bootstrap instructions differ");
  await ensureRollingLatest(context, assets);
  return oldTag === undefined ? "created" : "updated";
}
