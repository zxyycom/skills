import fs from "node:fs/promises";
import path from "node:path";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";

export type InvestigationPublishResourceIdentity = Readonly<{
  dev: bigint;
  id: string;
  ino: bigint;
}>;

type ResourceSnapshotFailure = Readonly<{ errors: string[]; status: "error" }>;
type ResourceSnapshotResult =
  | Readonly<{ status: "ok"; value: InvestigationPublishResourceIdentity[] }>
  | ResourceSnapshotFailure;

/** Captures referenced-resource identity, without treating bytes as an index input. */
export async function snapshotReferencedInvestigationResources(
  investigationsDirectory: string,
  ids: readonly string[]
): Promise<ResourceSnapshotResult> {
  const snapshots: InvestigationPublishResourceIdentity[] = [];
  for (const id of [...new Set(ids)].sort(compareText)) {
    const snapshot = await snapshotResourceIdentity(
      investigationsDirectory,
      id
    );
    if (snapshot.status === "error") return snapshot;
    snapshots.push(snapshot.value);
  }
  return { status: "ok", value: snapshots };
}

export function sameReferencedResourceIdentity(
  expected: readonly InvestigationPublishResourceIdentity[],
  current: readonly InvestigationPublishResourceIdentity[]
): boolean {
  return (
    current.length === expected.length &&
    current.every((entry, index) =>
      sameResourceIdentity(entry, expected[index])
    )
  );
}

async function snapshotResourceIdentity(
  investigationsDirectory: string,
  id: string
): Promise<
  | Readonly<{ status: "ok"; value: InvestigationPublishResourceIdentity }>
  | ResourceSnapshotFailure
> {
  const resourcePath = path.join(
    investigationsDirectory,
    investigationResourcesDirectoryName,
    ...id.split("/")
  );
  try {
    const stat = await fs.lstat(resourcePath, { bigint: true });
    if (stat.isSymbolicLink() || !stat.isFile()) return unsafeResource(id);
    return { status: "ok", value: { dev: stat.dev, id, ino: stat.ino } };
  } catch {
    return unreadableResource(id);
  }
}

function sameResourceIdentity(
  current: InvestigationPublishResourceIdentity,
  expected: InvestigationPublishResourceIdentity | undefined
): boolean {
  return (
    current.id === expected?.id &&
    current.dev === expected.dev &&
    current.ino === expected.ino
  );
}

function unsafeResource(id: string): ResourceSnapshotFailure {
  return {
    errors: [
      `${investigationResourcesDirectoryName}/${id} changed to an unsafe member`
    ],
    status: "error"
  };
}

function unreadableResource(id: string): ResourceSnapshotFailure {
  return {
    errors: [
      `${investigationResourcesDirectoryName}/${id} could not be rechecked before publish`
    ],
    status: "error"
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
