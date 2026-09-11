import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import type {
  PreparedRename,
  RenameSource,
  ReportFileSnapshot,
  ResourceMoveProgress
} from "./rename-contract.ts";
import { resourceMode, restoreResourceOwnerMove } from "./rename-resource.ts";
import { errorText, lstatOrNull } from "./rename-support.ts";

export async function captureRenameSourceSnapshots(
  sources: readonly RenameSource[]
): Promise<Map<string, ReportFileSnapshot>> {
  const snapshots = new Map<string, ReportFileSnapshot>();
  for (const source of sources) {
    const snapshot = await captureReportFileSnapshot(source.filePath);
    if (!sameReportBytes(snapshot.bytes, Buffer.from(source.text))) {
      throw new Error(`${source.id} changed after rename validation`);
    }
    snapshots.set(source.filePath, snapshot);
  }
  return snapshots;
}

export async function captureWrittenReportSnapshot(
  filePath: string,
  expectedText: string
): Promise<ReportFileSnapshot> {
  const snapshot = await captureReportFileSnapshot(filePath);
  if (!sameReportBytes(snapshot.bytes, Buffer.from(expectedText))) {
    throw new Error(
      "Investigation report write did not retain its planned bytes"
    );
  }
  return snapshot;
}

export async function captureReportFileSnapshot(
  filePath: string
): Promise<ReportFileSnapshot> {
  const before = await fs.lstat(filePath);
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new Error(
      "Investigation report must be a regular non-symbolic-link file"
    );
  }
  const bytes = await fs.readFile(filePath);
  const after = await fs.lstat(filePath);
  if (
    after.isSymbolicLink() ||
    !after.isFile() ||
    before.size !== bytes.byteLength ||
    after.size !== bytes.byteLength ||
    resourceMode(before.mode) !== resourceMode(after.mode)
  ) {
    throw new Error("Investigation report changed while being snapshotted");
  }
  return {
    bytes,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    mode: resourceMode(after.mode),
    size: bytes.byteLength
  };
}

export async function verifyReportFileSnapshot(
  filePath: string,
  expected: ReportFileSnapshot
): Promise<void> {
  const current = await captureReportFileSnapshot(filePath);
  if (!sameReportFileSnapshot(current, expected)) {
    throw new Error(
      "Investigation report changed after transaction publication"
    );
  }
}

function sameReportFileSnapshot(
  left: ReportFileSnapshot,
  right: ReportFileSnapshot
): boolean {
  return (
    left.mode === right.mode &&
    left.size === right.size &&
    left.contentHash === right.contentHash &&
    sameReportBytes(left.bytes, right.bytes)
  );
}

export function sameReportBytes(left: Buffer, right: Buffer): boolean {
  return left.byteLength === right.byteLength && left.equals(right);
}

export async function removeReportFileIfUnchanged(
  filePath: string,
  expected: ReportFileSnapshot
): Promise<void> {
  await verifyReportFileSnapshot(filePath, expected);
  await fs.rm(filePath, { force: false });
}

type RestoreRenameOptions = Readonly<{
  createdSourcePath: boolean;
  originalByPath: ReadonlyMap<string, ReportFileSnapshot>;
  prepared: PreparedRename;
  resourceMoveProgress: ResourceMoveProgress;
  sourceNewPath: string;
  sourceOldPath: string;
  writtenPaths: ReadonlySet<string>;
  writtenByPath: ReadonlyMap<string, ReportFileSnapshot>;
}>;

async function restoreMovedReportSource(
  options: RestoreRenameOptions
): Promise<string[]> {
  const original = options.originalByPath.get(options.sourceOldPath);
  const written = options.writtenByPath.get(options.sourceNewPath);
  if (original === undefined || written === undefined) {
    return [
      "failed to restore renamed Investigation source because its transaction write could not be snapshotted"
    ];
  }
  const errors: string[] = [];
  let targetStillOurs = false;
  try {
    await verifyReportFileSnapshot(options.sourceNewPath, written);
    targetStillOurs = true;
  } catch (error) {
    errors.push(
      "failed to remove renamed Investigation source because its target changed after publication: " +
        errorText(error)
    );
  }
  try {
    const oldEntry = await lstatOrNull(options.sourceOldPath);
    if (oldEntry === null) {
      await restoreMissingReportSource(options.sourceOldPath, original);
    } else {
      await verifyReportFileSnapshot(options.sourceOldPath, original);
    }
  } catch (error) {
    errors.push(
      "failed to restore renamed Investigation source because its old path changed after publication: " +
        errorText(error)
    );
  }
  if (targetStillOurs) {
    try {
      await removeReportFileIfUnchanged(options.sourceNewPath, written);
    } catch (error) {
      errors.push(
        "failed to remove renamed Investigation source: " + errorText(error)
      );
    }
  }
  return errors;
}

async function restoreMissingReportSource(
  targetPath: string,
  original: ReportFileSnapshot
): Promise<void> {
  const handle = await fs.open(targetPath, "wx", original.mode);
  try {
    await handle.writeFile(original.bytes);
    await handle.chmod(original.mode);
  } finally {
    await handle.close();
  }
  await verifyReportFileSnapshot(targetPath, original);
}

async function restoreRewrittenReportSource(
  sourcePath: string,
  original: ReportFileSnapshot,
  written: ReportFileSnapshot
): Promise<string[]> {
  try {
    await verifyReportFileSnapshot(sourcePath, written);
  } catch (error) {
    return [
      `failed to restore Investigation source ${sourcePath} because it changed after publication: ${errorText(error)}`
    ];
  }
  try {
    await fs.writeFile(sourcePath, original.bytes);
    await fs.chmod(sourcePath, original.mode);
    await verifyReportFileSnapshot(sourcePath, original);
    return [];
  } catch (error) {
    return [
      `failed to restore Investigation source ${sourcePath}: ${errorText(error)}`
    ];
  }
}

export async function restoreRename(
  options: RestoreRenameOptions
): Promise<string[]> {
  const errors = await restoreRenameResourceOwner(options);
  if (options.createdSourcePath)
    errors.push(...(await restoreMovedReportSource(options)));
  errors.push(...(await restoreWrittenSources(options)));
  errors.push(...(await restorePreviousIndex(options)));
  return errors;
}

async function restoreRenameResourceOwner(
  options: RestoreRenameOptions
): Promise<string[]> {
  if (options.prepared.resourceMove === null) return [];
  return await restoreResourceOwnerMove(
    options.prepared.resourceMove,
    options.prepared.plan.oldId,
    options.prepared.plan.newId,
    options.resourceMoveProgress
  );
}

async function restoreWrittenSources(
  options: RestoreRenameOptions
): Promise<string[]> {
  const errors: string[] = [];
  for (const [sourcePath, original] of options.originalByPath) {
    if (
      sourcePath === options.sourceOldPath &&
      options.sourceNewPath !== options.sourceOldPath
    )
      continue;
    if (!options.writtenPaths.has(sourcePath)) continue;
    const written = options.writtenByPath.get(sourcePath);
    if (written === undefined) {
      errors.push(
        `failed to restore Investigation source ${sourcePath} because its transaction write could not be snapshotted`
      );
      continue;
    }
    errors.push(
      ...(await restoreRewrittenReportSource(sourcePath, original, written))
    );
  }
  return errors;
}

async function restorePreviousIndex(
  options: RestoreRenameOptions
): Promise<string[]> {
  if (options.prepared.oldIndexText === null) return [];
  try {
    await fs.writeFile(
      options.prepared.indexPath,
      options.prepared.oldIndexText,
      "utf8"
    );
    return [];
  } catch (error) {
    return ["failed to restore investigation index: " + errorText(error)];
  }
}

/**
 * Never remove a claimed target until it still has exactly the owner members
 * this transaction copied. If another writer won the target race or changed
 * it afterwards, leave it for explicit reconciliation rather than deleting it.
 */
