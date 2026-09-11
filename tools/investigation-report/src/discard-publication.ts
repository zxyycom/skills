import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  diagnosticFromError,
  type InvestigationDiagnostic,
  type InvestigationMutationDiagnostic
} from "./diagnostics.ts";
import {
  compareText,
  discardMutation,
  errorText,
  uniqueSorted,
  type AfterDiscardResourceTombstone,
  type InvestigationDiscardWriter
} from "./discard.ts";
import {
  inspectOwnedResources,
  scanOwnerResourceTree,
  type ResourceTreeScan
} from "./discard-history.ts";
import {
  ensureRegularFile,
  lstatOrNull,
  sameResourceTree
} from "./discard-files.ts";

export type DiscardPublicationOptions = Readonly<{
  afterResourceTombstone: AfterDiscardResourceTombstone;
  indexPath: string;
  indexText: string;
  originalIndexText: string;
  reportPath: string;
  resourceOwnerPath: string;
  resourceSnapshot: ResourceTreeScan;
  root: string;
  write: InvestigationDiscardWriter;
}>;
export type DiscardPublicationResult = Readonly<{
  changed: boolean;
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  mutation?: InvestigationMutationDiagnostic;
}>;
type DiscardMovement = {
  movedReport: boolean;
  movedResources: boolean;
};

export async function publishDiscard(
  options: DiscardPublicationOptions
): Promise<DiscardPublicationResult> {
  const verificationFailure = await discardReportVerificationFailure(options);
  if (verificationFailure !== null) return verificationFailure;
  const trash = discardTrashPath(options.reportPath);
  const movement: DiscardMovement = {
    movedReport: false,
    movedResources: false
  };
  try {
    await publishDiscardTombstones(options, trash, movement);
  } catch (error) {
    return await discardPublishFailure(options, trash, movement, error);
  }
  const cleanupFailure = await discardCleanupFailure(
    options,
    trash,
    movement.movedResources
  );
  return cleanupFailure ?? { changed: true, diagnostics: [], errors: [] };
}

async function discardReportVerificationFailure(
  options: DiscardPublicationOptions
): Promise<DiscardPublicationResult | null> {
  try {
    await ensureRegularFile(options.reportPath);
    return null;
  } catch (error) {
    return {
      changed: false,
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.discard-report-recheck-failed",
          error,
          mutation: discardMutation("no-change"),
          reason: "the report could not be verified before discard publication",
          recovery:
            "restore access to the report and verify its current contents before retrying discard",
          target: options.reportPath
        })
      ],
      errors: [
        `report could not be verified before discard: ${errorText(error)}`
      ],
      mutation: discardMutation("no-change")
    };
  }
}

function discardTrashPath(reportPath: string): string {
  return path.join(
    path.dirname(path.dirname(reportPath)),
    `.investigation-report-discard-${process.pid}-${randomUUID()}`
  );
}

async function publishDiscardTombstones(
  options: DiscardPublicationOptions,
  trash: string,
  movement: DiscardMovement
): Promise<void> {
  await fs.mkdir(trash, { recursive: false });
  await fs.rename(options.reportPath, path.join(trash, "report.md"));
  movement.movedReport = true;
  await verifyCurrentDiscardResources(options);
  await tombstoneDiscardResources(options, trash, movement);
  await options.write(options.indexPath, options.indexText);
}

async function verifyCurrentDiscardResources(
  options: DiscardPublicationOptions
): Promise<void> {
  const currentResources = await inspectOwnedResources(
    options.root,
    options.resourceOwnerPath
  );
  if (sameResourceTree(currentResources, options.resourceSnapshot)) return;
  throw new Error(
    currentResources.errors.length > 0
      ? `owned resources changed before discard publication: ${currentResources.errors.join("; ")}`
      : "owned resources changed before discard publication"
  );
}

async function tombstoneDiscardResources(
  options: DiscardPublicationOptions,
  trash: string,
  movement: DiscardMovement
): Promise<void> {
  const resourceEntry = await lstatOrNull(options.resourceOwnerPath);
  if (resourceEntry === null) return;
  if (resourceEntry.isSymbolicLink() || !resourceEntry.isDirectory()) {
    throw new Error(
      "owner resource path must be a non-symbolic-link directory"
    );
  }
  const tombstonePath = path.join(trash, "resources");
  await fs.rename(options.resourceOwnerPath, tombstonePath);
  movement.movedResources = true;
  await options.afterResourceTombstone();
  const tombstonedResources = await scanOwnerResourceTree(
    tombstonePath,
    path.basename(options.resourceOwnerPath)
  );
  if (sameResourceTree(tombstonedResources, options.resourceSnapshot)) return;
  throw new Error(
    tombstonedResources.errors.length > 0
      ? `tombstoned owner resources changed before discard publication: ${tombstonedResources.errors.join("; ")}`
      : "tombstoned owner resources changed before discard publication"
  );
}

async function discardPublishFailure(
  options: DiscardPublicationOptions,
  trash: string,
  movement: DiscardMovement,
  error: unknown
): Promise<DiscardPublicationResult> {
  const restorationErrors = await restoreDiscard({
    ...options,
    ...movement,
    trash,
    write: options.write
  });
  const mutation = discardMutation(
    restorationErrors.length === 0 ? "rolled-back" : "partial-or-unknown"
  );
  return {
    changed: false,
    diagnostics: [
      diagnosticFromError({
        code: "investigation-report.discard-publish-failed",
        error,
        mutation,
        reason:
          restorationErrors.length === 0
            ? "discard publication failed and the report, resources, and index were restored"
            : "discard publication failed and restoration could not be fully verified",
        recovery:
          restorationErrors.length === 0
            ? "correct the publication failure, then retry discard"
            : "inspect the listed report, resource, and index paths before any retry",
        target: options.reportPath
      })
    ],
    errors: uniqueSorted([
      `discard transaction publish failed: ${errorText(error)}`,
      ...restorationErrors
    ]),
    mutation
  };
}

async function discardCleanupFailure(
  options: DiscardPublicationOptions,
  trash: string,
  movedResources: boolean
): Promise<DiscardPublicationResult | null> {
  try {
    await fs.unlink(path.join(trash, "report.md"));
    if (movedResources) await deleteDiscardResourceTombstone(options, trash);
    await fs.rmdir(trash);
    return null;
  } catch (error) {
    return {
      changed: true,
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.discard-cleanup-pending",
          error,
          mutation: discardMutation("committed-cleanup-pending"),
          reason:
            "discard committed the final index, but its tombstone cleanup could not finish safely",
          recovery:
            "do not retry discard; inspect and remove only the listed tombstone after confirming its contents",
          target: trash
        })
      ],
      errors: [
        `discard committed but temporary deletion data at ${trash} could not be fully removed: ${errorText(error)}`
      ],
      mutation: discardMutation("committed-cleanup-pending")
    };
  }
}

async function deleteDiscardResourceTombstone(
  options: DiscardPublicationOptions,
  trash: string
): Promise<void> {
  const tombstonePath = path.join(trash, "resources");
  const tombstonedResources = await scanOwnerResourceTree(
    tombstonePath,
    path.basename(options.resourceOwnerPath)
  );
  if (!sameResourceTree(tombstonedResources, options.resourceSnapshot)) {
    throw new Error("tombstoned owner resources changed before final deletion");
  }
  await deletePreviewedResourceTree(
    tombstonePath,
    path.basename(options.resourceOwnerPath),
    options.resourceSnapshot
  );
}

async function deletePreviewedResourceTree(
  resourceRoot: string,
  ownerPrefix: string,
  snapshot: ResourceTreeScan
): Promise<void> {
  const ownerPrefixLength = ownerPrefix.length + 1;
  for (const resourceId of snapshot.resourceIds) {
    await fs.unlink(
      path.join(resourceRoot, resourceId.slice(ownerPrefixLength))
    );
  }
  for (const directory of [...snapshot.directories].sort(
    (left, right) =>
      right.split("/").length - left.split("/").length ||
      compareText(right, left)
  )) {
    await fs.rmdir(
      directory.length === 0 ? resourceRoot : path.join(resourceRoot, directory)
    );
  }
}

async function restoreDiscard(options: {
  indexPath: string;
  movedReport: boolean;
  movedResources: boolean;
  originalIndexText: string;
  reportPath: string;
  resourceOwnerPath: string;
  trash: string;
  write: InvestigationDiscardWriter;
}): Promise<string[]> {
  const errors: string[] = [];
  if (options.movedResources) {
    try {
      await fs.rename(
        path.join(options.trash, "resources"),
        options.resourceOwnerPath
      );
    } catch (error) {
      errors.push(`failed to restore owner resources: ${errorText(error)}`);
    }
  }
  if (options.movedReport) {
    try {
      await fs.rename(
        path.join(options.trash, "report.md"),
        options.reportPath
      );
    } catch (error) {
      errors.push(`failed to restore report: ${errorText(error)}`);
    }
  }
  try {
    await options.write(options.indexPath, options.originalIndexText);
  } catch (error) {
    errors.push(`failed to restore investigation index: ${errorText(error)}`);
  }
  await fs.rmdir(options.trash).catch(() => undefined);
  return errors;
}
