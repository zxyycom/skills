/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/version-control/pending-snapshot-proof.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/version-control/pending-snapshot-proof.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/version-control/pending-snapshot-proof.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { sameFingerprints } from "./git-pending-snapshot-content.ts";
import type { GitIndexEntry } from "./git-core.ts";
import { sameGitIndexEntries } from "./git-pending-values.ts";
import type { PendingPayloadScope } from "./pending-snapshot.ts";
import type { VersionControlRepository } from "./types.ts";

export type SnapshotIdentity = Readonly<{
  repository: VersionControlRepository;
  pathScope: string;
  payloadScope: PendingPayloadScope;
  contentPaths: ReadonlySet<string>;
  entries: readonly GitIndexEntry[];
  fingerprints: ReadonlyMap<string, string>;
}>;
export function samePendingSnapshotIdentities(
  before: SnapshotIdentity | undefined,
  after: SnapshotIdentity | undefined
): boolean {
  return (
    before !== undefined &&
    after !== undefined &&
    before.repository === after.repository &&
    before.pathScope === after.pathScope &&
    before.payloadScope === after.payloadScope &&
    (before.payloadScope === "scope" ||
      (before.contentPaths.size === after.contentPaths.size &&
        [...before.contentPaths].every((path) =>
          after.contentPaths.has(path)
        ))) &&
    sameGitIndexEntries(before.entries, after.entries) &&
    sameFingerprints(before.fingerprints, after.fingerprints)
  );
}

/** 同阶段扩展 payload 选择时，保留完整成员身份与此前实际读到的 payload 证明。 */
export function extendsPendingSnapshotIdentity(
  previous: SnapshotIdentity | undefined,
  expanded: SnapshotIdentity | undefined
): boolean {
  return (
    previous !== undefined &&
    expanded !== undefined &&
    previous.repository === expanded.repository &&
    previous.pathScope === expanded.pathScope &&
    previous.payloadScope === "content-paths" &&
    expanded.payloadScope === "content-paths" &&
    [...previous.contentPaths].every((file) =>
      expanded.contentPaths.has(file)
    ) &&
    sameGitIndexEntries(previous.entries, expanded.entries) &&
    [...previous.fingerprints].every(
      ([id, fingerprint]) => expanded.fingerprints.get(id) === fingerprint
    )
  );
}
