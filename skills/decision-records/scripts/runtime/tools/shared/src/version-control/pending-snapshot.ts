/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/version-control/pending-snapshot.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/version-control/pending-snapshot.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/version-control/pending-snapshot.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  selectedPendingBlobs,
  materializedFiles,
  payloadFingerprints,
  sameFingerprints
} from "./git/pending/git-pending-snapshot-content.ts";
import {
  extendsPendingSnapshotIdentity,
  samePendingSnapshotIdentities,
  type SnapshotIdentity
} from "./pending-snapshot-proof.ts";
import { sameBytes } from "../node/bytes.ts";
import type { GitRepositoryContext } from "./git/git-context.ts";
import {
  fileKindForGitMode,
  operationError,
  type GitIndexEntry
} from "./git/git-core.ts";
import { gitContextForRepository } from "./git/git-repository.ts";
import { runPendingReplacement } from "./git/pending/git-pending-replacement.ts";
import {
  createPendingEntries,
  listPendingEntries,
  validatePendingEntries,
  writePendingEntries
} from "./git/pending/git-pending.ts";
import {
  type NormalizedPendingReplacementFile,
  normalizePendingReplacement,
  pendingConflictError,
  pendingReplacementError,
  sameGitIndexEntries,
  sameVersionControlFiles
} from "./git/pending/git-pending-values.ts";
import {
  normalizeRepositoryPath,
  normalizeRepositoryPaths
} from "./repository-path.ts";
import type {
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "./types.ts";

export type PendingFileUpdate =
  | VersionControlFile
  | Readonly<{ path: string; data: null }>;
export type PendingPayloadScope = "scope" | "content-paths";
export type PendingSnapshot = Readonly<{
  pathScope: string;
  members: readonly Pick<VersionControlFile, "path" | "kind">[];
  files: readonly VersionControlFile[];
}>;

const identities = new WeakMap<PendingSnapshot, SnapshotIdentity>();

/** Complete member identity; payload validation is full-scope unless explicitly narrowed. */
export async function readPendingSnapshot(
  repository: VersionControlRepository,
  options: Readonly<{
    pathScope: string;
    contentPaths: readonly string[];
    payloadScope?: PendingPayloadScope;
  }>
): Promise<PendingSnapshot> {
  const scope = normalizeRepositoryPath(options.pathScope);
  const paths = normalizedContentPaths(options.contentPaths, scope);
  const payloadScope = options.payloadScope ?? "scope";
  const context = gitContextForRepository(repository);
  const entries = await listPendingEntries(context, [scope]);
  validatePendingEntries(entries);
  const blobs = await selectedPendingBlobs(
    context,
    entries,
    paths,
    payloadScope
  );
  const snapshot: PendingSnapshot = Object.freeze({
    pathScope: scope,
    members: Object.freeze(
      entries.map((entry) =>
        Object.freeze({
          path: entry.path,
          kind: fileKindForGitMode(entry.mode)
        })
      )
    ),
    files: Object.freeze(materializedFiles(entries, blobs, paths))
  });
  identities.set(snapshot, {
    repository,
    pathScope: scope,
    payloadScope,
    contentPaths: paths,
    entries,
    fingerprints: payloadFingerprints(blobs)
  });
  return snapshot;
}

export function samePendingSnapshots(
  left: PendingSnapshot,
  right: PendingSnapshot
): boolean {
  return samePendingSnapshotIdentities(
    identities.get(left),
    identities.get(right)
  );
}

/** 同阶段扩展 payload 选择时，保留完整成员身份与此前实际读到的 payload 证明。 */
export function extendsPendingSnapshot(
  before: PendingSnapshot,
  after: PendingSnapshot
): boolean {
  return extendsPendingSnapshotIdentity(
    identities.get(before),
    identities.get(after)
  );
}

export type PendingSnapshotReplacementResult = Readonly<{
  pathScope: string;
  previousPaths: readonly string[];
  pendingPaths: readonly string[];
  changedPaths: readonly string[];
}>;

/** Patch declared paths with complete member identity and the captured payload boundary. */
export async function replacePendingSnapshot(
  repository: VersionControlRepository,
  options: Readonly<{
    expectedRevision: RevisionId | null;
    expectedSnapshot: PendingSnapshot;
    updates: readonly PendingFileUpdate[];
  }>
): Promise<PendingSnapshotReplacementResult> {
  const expected = identities.get(options.expectedSnapshot);
  const scope = normalizeRepositoryPath(options.expectedSnapshot.pathScope);
  if (
    expected === undefined ||
    expected.repository !== repository ||
    expected.pathScope !== scope
  )
    throw pendingConflictError(
      scope,
      "unknown",
      "the pending snapshot does not belong to this repository"
    );
  const updates = normalizeUpdates(options.updates, expected);
  const normalized = normalizePendingReplacement({
    expectedRevision: options.expectedRevision,
    pathScope: scope,
    files: updates.filter((update) => update.data !== null)
  });
  const filesByPath = new Map(
    normalized.files.map((file) => [file.path, file])
  );
  const ownedUpdates = updates.map((update) =>
    update.data === null ? update : filesByPath.get(update.path)!
  );
  const paths = new Set(updates.map((update) => update.path));
  const context = gitContextForRepository(repository);
  return await runPendingReplacement(
    context,
    () => repository.getCurrentRevision(),
    scope,
    normalized.expectedRevision,
    async (lockPath) => {
      const patch: PendingPatch = {
        scope,
        expected,
        updates: ownedUpdates,
        files: normalized.files,
        paths
      };
      const prepared = await preparePendingPatch(context, lockPath, patch);
      if (sameGitIndexEntries(prepared.previous, prepared.target))
        return { result: prepared.result, publish: false };
      await writePendingPatch(context, lockPath, patch, prepared);
      return { result: prepared.result, publish: true };
    }
  );
}

type PendingPatch = Readonly<{
  scope: string;
  expected: SnapshotIdentity;
  updates: readonly PendingFileUpdate[];
  files: readonly NormalizedPendingReplacementFile[];
  paths: ReadonlySet<string>;
}>;
type PreparedPendingPatch = Readonly<{
  previous: readonly GitIndexEntry[];
  target: readonly GitIndexEntry[];
  result: PendingSnapshotReplacementResult;
}>;

async function preparePendingPatch(
  context: GitRepositoryContext,
  lockPath: string,
  patch: PendingPatch
): Promise<PreparedPendingPatch> {
  const { scope, expected, paths, files, updates } = patch;
  const previous = await listPendingEntries(context, [scope], lockPath);
  if (!sameGitIndexEntries(previous, expected.entries))
    throw pendingConflictError(
      scope,
      "unknown",
      "the pending range identity differs from the expected snapshot"
    );
  validatePendingEntries(previous);
  const blobs = await selectedPendingBlobs(
    context,
    previous,
    expected.payloadScope === "scope" ? paths : expected.contentPaths,
    expected.payloadScope
  );
  if (!sameFingerprints(expected.fingerprints, payloadFingerprints(blobs)))
    throw pendingConflictError(
      scope,
      "unknown",
      "the pending range bytes differ from the expected snapshot"
    );
  const previousFiles = materializedFiles(previous, blobs, paths);
  const replacements = await createPendingEntries(
    context,
    files,
    previous,
    previousFiles
  );
  const target = [
    ...previous.filter((entry) => !paths.has(entry.path)),
    ...replacements
  ].sort((left, right) => left.path.localeCompare(right.path));
  return {
    previous,
    target,
    result: {
      pathScope: scope,
      previousPaths: previous.map((entry) => entry.path),
      pendingPaths: target.map((entry) => entry.path),
      changedPaths: changedUpdatePaths(previous, previousFiles, updates)
    }
  };
}

async function writePendingPatch(
  context: GitRepositoryContext,
  lockPath: string,
  patch: PendingPatch,
  prepared: PreparedPendingPatch
): Promise<void> {
  const { scope, paths, files, expected } = patch;
  const { previous, target } = prepared;
  await context.hooks.beforePendingWrite?.();
  await writePendingEntries(context, previous, target, lockPath);
  await context.hooks.afterPendingWrite?.();
  const written = await listPendingEntries(context, [scope], lockPath);
  if (!sameGitIndexEntries(written, target))
    throw pendingReplacementError(
      scope,
      "the pending range did not match the written target"
    );
  const writtenBlobs = await selectedPendingBlobs(
    context,
    written,
    expected.payloadScope === "scope" ? paths : expected.contentPaths,
    expected.payloadScope
  );
  if (
    !sameVersionControlFiles(
      materializedFiles(written, writtenBlobs, paths),
      files
    )
  )
    throw pendingReplacementError(
      scope,
      "the pending range bytes did not match the written target"
    );
  const retainedIds = new Set(
    previous
      .filter(
        (entry) =>
          !paths.has(entry.path) &&
          (expected.payloadScope === "scope" ||
            expected.contentPaths.has(entry.path))
      )
      .map((entry) => entry.objectId)
  );
  for (const id of retainedIds)
    if (writtenBlobs.get(id)?.fingerprint !== expected.fingerprints.get(id))
      throw pendingReplacementError(
        scope,
        "preserved pending bytes changed during the write"
      );
}

function normalizedContentPaths(
  paths: readonly string[],
  scope: string
): ReadonlySet<string> {
  const normalized = normalizeRepositoryPaths(paths);
  if (
    normalized.some((file) => file !== scope && !file.startsWith(scope + "/"))
  )
    throw operationError(
      "select pending content",
      "a selected content path is outside the pending range"
    );
  return new Set(normalized);
}
function normalizeUpdates(
  updates: readonly PendingFileUpdate[],
  expected: SnapshotIdentity
): PendingFileUpdate[] {
  const scope = expected.pathScope;
  const paths = new Set<string>();
  const normalized = updates.map((update) => {
    const filePath = normalizeRepositoryPath(update.path);
    if (
      paths.has(filePath) ||
      (filePath !== scope && !filePath.startsWith(scope + "/"))
    )
      throw operationError(
        "validate pending updates",
        "an update path is duplicated or outside the pending range"
      );
    paths.add(filePath);
    return update.data === null
      ? { path: filePath, data: null }
      : { ...update, path: filePath };
  });
  if (
    expected.payloadScope === "content-paths" &&
    normalized.some((update) => !expected.contentPaths.has(update.path))
  )
    throw pendingConflictError(
      scope,
      "unknown",
      "an update is outside the snapshot payload boundary"
    );
  return normalized;
}
function changedUpdatePaths(
  previous: readonly GitIndexEntry[],
  previousFiles: readonly VersionControlFile[],
  updates: readonly PendingFileUpdate[]
): string[] {
  const members = new Set(previous.map((entry) => entry.path));
  const files = new Map(previousFiles.map((file) => [file.path, file]));
  return updates
    .filter((update) => {
      if (update.data === null) return members.has(update.path);
      const prior = files.get(update.path);
      return (
        prior === undefined ||
        prior.kind !== update.kind ||
        !sameBytes(prior.data, update.data)
      );
    })
    .map((update) => update.path)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}
