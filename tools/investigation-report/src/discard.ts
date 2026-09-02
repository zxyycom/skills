import { randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  buildStateIndex,
  serializeStateIndex
} from "../../index-runtime/src/index.ts";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import {
  InvestigationCollectionMutationLockError,
  withInvestigationCollectionMutationLock
} from "./collection-mutation-lock.ts";
import {
  diagnosticFromError,
  genericInvestigationDiagnostic,
  sanitizeInvestigationDiagnosticText,
  type InvestigationDiagnostic,
  type InvestigationMutationDiagnostic
} from "./diagnostics.ts";
import {
  createInvestigationStateSnapshot,
  sameInvestigationSources
} from "./investigation-index-source.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import { parseInvestigationReportDiscardOptions } from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  isInvestigationId,
  reportPathForInvestigationId,
  resolveInvestigationsDirectory
} from "./report-path.ts";
import { validateInvestigationRelationGraph } from "./relation-validation.ts";
import {
  investigationResourcesDirectoryName,
  isInvestigationResourceId
} from "./resource-reference.ts";
import { collectValidatedInvestigationCollection } from "./validation.ts";
import type {
  InvestigationIndexState,
  InvestigationReportDiscardResult
} from "./types.ts";

export type InvestigationDiscardWriter = (
  targetPath: string,
  text: string
) => Promise<void>;
type BeforeDiscardPublish = () => Promise<void>;
type AfterDiscardResourceTombstone = () => Promise<void>;

export async function discardInvestigationReport(
  input: unknown
): Promise<InvestigationReportDiscardResult> {
  return await discardInvestigationReportWithWriter(input, writeTextAtomically);
}

export async function discardInvestigationReportWithWriter(
  input: unknown,
  write: InvestigationDiscardWriter,
  beforePublish: BeforeDiscardPublish = async () => {},
  afterResourceTombstone: AfterDiscardResourceTombstone = async () => {}
): Promise<InvestigationReportDiscardResult> {
  const parsed = parseInvestigationReportDiscardOptions(input);
  if (parsed.isErr()) return discardResult({}, "", false, [], parsed.error);
  if (!isInvestigationId(parsed.value.id)) {
    return discardResult(
      parsed.value,
      parsed.value.id,
      false,
      [],
      [
        `${parsed.value.id || "<empty>"} discard id must use an Investigation ID`
      ]
    );
  }
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  if (resolved.isErr())
    return discardResult(
      parsed.value,
      parsed.value.id,
      false,
      [],
      resolved.error
    );
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr())
    return discardResult(
      parsed.value,
      parsed.value.id,
      false,
      [],
      canonical.error
    );
  const root = canonical.value.investigationsDirectory;
  const indexPath = path.join(root, investigationIndexFileName);
  return await withInvestigationCollectionMutationLock(
    indexPath,
    async () =>
      await discardFromCollection({
        afterResourceTombstone,
        beforePublish,
        deleteOwnedResources: parsed.value.deleteOwnedResources === true,
        deleteRecordedReport: parsed.value.deleteRecordedReport === true,
        id: parsed.value.id,
        indexPath,
        root,
        write
      })
  ).catch((error: unknown) => {
    const releaseFailure =
      error instanceof InvestigationCollectionMutationLockError &&
      error.diagnostic.code ===
        "investigation-report.collection-lock-release-failed";
    const completedResult =
      error instanceof InvestigationCollectionMutationLockError &&
      error.operationCompleted &&
      isDiscardResult(error.operationResult)
        ? error.operationResult
        : null;
    if (completedResult !== null && releaseFailure) {
      const mutation =
        completedResult.mutation ??
        discardMutation(
          completedResult.changed ? "committed-cleanup-pending" : "no-change"
        );
      return {
        ...completedResult,
        diagnostics: [
          ...completedResult.diagnostics,
          { ...error.diagnostic, mutation }
        ],
        errors: uniqueSorted([...completedResult.errors, errorText(error)]),
        mutation
      };
    }
    return discardResult(
      parsed.value,
      parsed.value.id,
      false,
      [],
      [errorText(error)],
      {
        diagnostics:
          error instanceof InvestigationCollectionMutationLockError
            ? [
                {
                  ...error.diagnostic,
                  mutation: discardMutation(
                    releaseFailure ? "partial-or-unknown" : "no-change"
                  )
                }
              ]
            : [
                diagnosticFromError({
                  code: "investigation-report.discard-transaction-failed",
                  error,
                  mutation: discardMutation("partial-or-unknown"),
                  reason: "the discard transaction stopped unexpectedly",
                  recovery:
                    "verify the report, owner resources, and index before retrying discard",
                  target: parsed.value.id
                })
              ],
        mutation: discardMutation(
          releaseFailure ? "partial-or-unknown" : "no-change"
        )
      }
    );
  });
}

async function discardFromCollection(options: {
  afterResourceTombstone: AfterDiscardResourceTombstone;
  beforePublish: BeforeDiscardPublish;
  deleteOwnedResources: boolean;
  deleteRecordedReport: boolean;
  id: string;
  indexPath: string;
  root: string;
  write: InvestigationDiscardWriter;
}): Promise<InvestigationReportDiscardResult> {
  const collection = await collectValidatedInvestigationCollection(
    options.root
  );
  if (collection.errors.length > 0 || collection.snapshot === null) {
    return result(options, false, [], collection.errors);
  }
  const target = collection.sources.find((source) => source.id === options.id);
  if (target === undefined) {
    return result(
      options,
      false,
      [],
      [`${options.id} investigation report does not exist`]
    );
  }
  let originalIndexText: string;
  try {
    originalIndexText = await readRegularText(options.indexPath);
  } catch (error) {
    return result(
      options,
      false,
      [],
      [
        `failed to read current index before discard transaction: ${errorText(error)}`
      ],
      {
        diagnostics: [
          diagnosticFromError({
            code: "investigation-report.discard-index-read-failed",
            error,
            mutation: discardMutation("no-change"),
            reason:
              "the current investigation index could not be read before discard",
            recovery:
              "restore read access to the current index, then retry discard",
            target: options.indexPath
          })
        ],
        mutation: discardMutation("no-change")
      }
    );
  }
  const freshness = await syncInvestigationStateIndex({
    investigationsDirectory: options.root,
    mode: "check",
    snapshot: collection.snapshot
  });
  if (freshness.status === "error") {
    return result(
      options,
      false,
      [],
      investigationIndexDiagnosticMessages(
        freshness.diagnostics,
        options.indexPath
      )
    );
  }

  const resourceOwnerPath = path.join(
    options.root,
    investigationResourcesDirectoryName,
    options.id.slice(0, -".md".length)
  );
  const ownedResources = await inspectOwnedResources(
    options.root,
    resourceOwnerPath
  );
  if (ownedResources.errors.length > 0) {
    return result(options, false, [], ownedResources.errors);
  }
  const relationshipErrors = referencesToTarget(collection.states, options.id);
  const resourceErrors = sharedOwnerResourceReferences(
    collection.states,
    options.id
  );
  const deletionErrors =
    ownedResources.resourceIds.length > 0 && !options.deleteOwnedResources
      ? [
          `${options.id} owns ${ownedResources.resourceIds.length} resource(s); re-run with --delete-owned-resources only after confirming their deletion`
        ]
      : [];
  if (
    relationshipErrors.length > 0 ||
    resourceErrors.length > 0 ||
    deletionErrors.length > 0
  ) {
    return result(
      options,
      false,
      [],
      [...relationshipErrors, ...resourceErrors, ...deletionErrors]
    );
  }
  const candidateSources = collection.sources.filter(
    (source) => source.id !== options.id
  );
  const candidateStates = new Map(
    [...collection.states].filter(([id]) => id !== options.id)
  );
  const relationErrors = validateInvestigationRelationGraph(candidateStates);
  if (relationErrors.length > 0)
    return result(options, false, [], relationErrors);

  const recorded = await isRecordedAtHead(
    options.root,
    options.id,
    ownedResources.resourceIds
  );
  if (recorded.errors.length > 0)
    return result(options, false, [], recorded.errors, {
      diagnostics: [
        genericInvestigationDiagnostic({
          code: "investigation-report.discard-history-check-unavailable",
          mutation: discardMutation("no-change"),
          reason:
            "the Git history check required before discard could not be completed",
          recovery:
            "restore version-control access, then rerun discard before deleting the report",
          target: options.id
        })
      ],
      mutation: discardMutation("no-change")
    });
  if (recorded.recorded && !options.deleteRecordedReport) {
    return {
      ...result(
        options,
        false,
        [],
        [
          `Investigation report ${options.id} has entered Git HEAD; confirm that its recorded history should be deleted.`,
          "Re-run with --delete-recorded-report only after confirming deletion; no files were changed."
        ]
      ),
      requiresRecordedDeletionConfirmation: true
    };
  }

  const snapshot = createInvestigationStateSnapshot(
    candidateSources,
    candidateSources.map((source) => candidateStates.get(source.id)!)
  );
  const builtIndex = await buildStateIndex(
    createInvestigationStateIndexDefinition({ snapshot }),
    { root: options.root }
  );
  if (builtIndex.status === "error") {
    return result(
      options,
      false,
      [],
      investigationIndexDiagnosticMessages(
        builtIndex.diagnostics,
        options.indexPath
      )
    );
  }
  const nextIndexText = serializeStateIndex(
    builtIndex.value,
    createInvestigationStateIndexDefinition({ snapshot })
  );
  await options.beforePublish();
  const protectedCollection = await collectValidatedInvestigationCollection(
    options.root
  );
  if (
    protectedCollection.errors.length > 0 ||
    protectedCollection.snapshot === null ||
    !sameInvestigationSources(collection.sources, protectedCollection.sources)
  ) {
    return result(
      options,
      false,
      [],
      [
        "investigation collection changed after discard validation; no files were written",
        ...protectedCollection.errors
      ]
    );
  }
  let currentIndexText: string;
  try {
    currentIndexText = await readRegularText(options.indexPath);
  } catch (error) {
    return result(
      options,
      false,
      [],
      [
        `current investigation index could not be re-read before discard transaction: ${errorText(error)}`
      ],
      {
        diagnostics: [
          diagnosticFromError({
            code: "investigation-report.discard-index-recheck-failed",
            error,
            mutation: discardMutation("no-change"),
            reason:
              "the current investigation index could not be re-read before discard publication",
            recovery:
              "restore read access to the index and verify it has not changed before retrying discard",
            target: options.indexPath
          })
        ],
        mutation: discardMutation("no-change")
      }
    );
  }
  if (currentIndexText !== originalIndexText) {
    return result(
      options,
      false,
      [],
      [
        "investigation index changed after discard validation; no files were written"
      ],
      {
        diagnostics: [
          genericInvestigationDiagnostic({
            code: "investigation-report.discard-index-drift",
            mutation: discardMutation("no-change"),
            reason: "the investigation index changed after discard validation",
            recovery:
              "review the concurrent index change, then retry discard from the current collection state",
            target: options.indexPath
          })
        ],
        mutation: discardMutation("no-change")
      }
    );
  }

  const deletedResourceIds = ownedResources.resourceIds;
  const publication = await publishDiscard({
    afterResourceTombstone: options.afterResourceTombstone,
    indexPath: options.indexPath,
    indexText: nextIndexText,
    originalIndexText,
    reportPath: reportPathForInvestigationId(options.root, options.id),
    resourceOwnerPath,
    resourceSnapshot: ownedResources,
    root: options.root,
    write: options.write
  });
  return result(
    options,
    publication.changed,
    deletedResourceIds,
    publication.errors,
    {
      diagnostics: publication.diagnostics,
      ...(publication.mutation === undefined
        ? {}
        : { mutation: publication.mutation })
    }
  );
}

function referencesToTarget(
  states: ReadonlyMap<string, InvestigationIndexState>,
  id: string
): string[] {
  return uniqueSorted(
    [...states]
      .filter(
        ([source, state]) =>
          source !== id &&
          state.relations.some((relation) => relation.target === id)
      )
      .map(
        ([source]) =>
          `${id} is still a direct relation target of ${source}; update that report with set-relations before discard`
      )
  );
}

function sharedOwnerResourceReferences(
  states: ReadonlyMap<string, InvestigationIndexState>,
  id: string
): string[] {
  const ownerPrefix = `${id.slice(0, -".md".length)}/`;
  return uniqueSorted(
    [...states]
      .filter(
        ([source, state]) =>
          source !== id &&
          state.resourceIds.some((resourceId) =>
            resourceId.startsWith(ownerPrefix)
          )
      )
      .map(
        ([source]) =>
          `${id} owns resources still referenced by ${source}; remove or replace those resource links before discard`
      )
  );
}

async function isRecordedAtHead(
  root: string,
  id: string,
  ownedResourceIds: readonly string[]
): Promise<{ errors: string[]; recorded: boolean }> {
  const opened = await openRepositoryOrFilesystem(root);
  if (opened.errors.length > 0)
    return { errors: opened.errors, recorded: false };
  if (opened.repository === null) return { errors: [], recorded: false };
  try {
    const revision = await opened.repository.getCurrentRevision();
    if (revision === null) return { errors: [], recorded: false };
    const scope = repositoryScope(opened.repository, root);
    const paths = [
      scope.length === 0 ? id : `${scope}/${id}`,
      ...ownedResourceIds.map((resourceId) =>
        scope.length === 0
          ? `${investigationResourcesDirectoryName}/${resourceId}`
          : `${scope}/${investigationResourcesDirectoryName}/${resourceId}`
      )
    ];
    const files = await opened.repository.listRevisionFiles(revision, {
      pathScopes: paths
    });
    return { errors: [], recorded: files.length > 0 };
  } catch (error) {
    return {
      errors: [
        `Git HEAD could not be inspected before discard: ${errorText(error)}`
      ],
      recorded: false
    };
  }
}

async function openRepositoryOrFilesystem(root: string): Promise<{
  errors: string[];
  repository: VersionControlRepository | null;
}> {
  try {
    return { errors: [], repository: await openVersionControl(root) };
  } catch (error) {
    if (
      error instanceof VersionControlError &&
      error.code === "not-repository"
    ) {
      return { errors: [], repository: null };
    }
    return {
      errors: [
        `version-control state could not be inspected before discard: ${errorText(error)}`
      ],
      repository: null
    };
  }
}

function repositoryScope(
  repository: VersionControlRepository,
  root: string
): string {
  return path.resolve(root) === repository.rootDirectory
    ? ""
    : repositoryRelativePathFromFileSystemPath(repository.rootDirectory, root);
}

async function inspectOwnedResources(
  root: string,
  ownerPath: string
): Promise<ResourceTreeScan> {
  const scanned = await scanOwnerResourceTree(
    ownerPath,
    path.basename(ownerPath)
  );
  const errors = [...scanned.errors];
  if (scanned.directories.length === 0) {
    return { ...scanned, errors: uniqueSorted(errors) };
  }
  const opened = await openRepositoryOrFilesystem(root);
  errors.push(...opened.errors);
  if (opened.repository !== null) {
    try {
      const resourceRoot = path.join(root, investigationResourcesDirectoryName);
      const scope = repositoryRelativePathFromFileSystemPath(
        opened.repository.rootDirectory,
        resourceRoot
      );
      const visible = new Set(
        (
          await opened.repository.listWorkspaceFiles({ pathScopes: [scope] })
        ).flatMap((file) =>
          file.startsWith(`${scope}/`) ? [file.slice(scope.length + 1)] : []
        )
      );
      for (const resourceId of scanned.resourceIds) {
        if (!visible.has(resourceId)) {
          errors.push(
            `owned resource ${resourceId} is ignored by version-control rules and cannot be deleted transactionally`
          );
        }
      }
    } catch (error) {
      errors.push(
        `owned resources could not be checked against version-control membership: ${errorText(error)}`
      );
    }
  }
  return { ...scanned, errors: uniqueSorted(errors) };
}

type ResourceTreeScan = Readonly<{
  directories: string[];
  errors: string[];
  resourceIds: string[];
}>;

async function scanOwnerResourceTree(
  ownerPath: string,
  ownerPrefix: string
): Promise<ResourceTreeScan> {
  const ownerEntry = await lstatOrNull(ownerPath);
  if (ownerEntry === null)
    return { directories: [], errors: [], resourceIds: [] };
  if (ownerEntry.isSymbolicLink() || !ownerEntry.isDirectory()) {
    return {
      directories: [],
      errors: ["owner resource path must be a non-symbolic-link directory"],
      resourceIds: []
    };
  }
  const directories = [""];
  const errors: string[] = [];
  const resourceIds: string[] = [];
  async function walk(directory: string, relative: string): Promise<void> {
    let entries: Dirent<string>[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      errors.push(
        `owned resources could not be inspected: ${errorText(error)}`
      );
      return;
    }
    for (const entry of entries.sort((left, right) =>
      compareText(left.name, right.name)
    )) {
      const next =
        relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      const resourceId = `${ownerPrefix}/${next}`;
      const absolute = path.join(directory, entry.name);
      let stat: Awaited<ReturnType<typeof fs.lstat>>;
      try {
        stat = await fs.lstat(absolute);
      } catch (error) {
        errors.push(
          `owned resource ${resourceId} could not be inspected: ${errorText(error)}`
        );
        continue;
      }
      if (stat.isSymbolicLink()) {
        errors.push(`owned resource ${resourceId} must not be a symbolic link`);
      } else if (stat.isDirectory()) {
        directories.push(next);
        await walk(absolute, next);
      } else if (stat.isFile()) {
        if (!isInvestigationResourceId(resourceId)) {
          errors.push(
            `owned resource ${resourceId} must use a safe, normalized resource id`
          );
        }
        resourceIds.push(resourceId);
      } else {
        errors.push(`owned resource ${resourceId} must be a regular file`);
      }
    }
  }
  await walk(ownerPath, "");
  return {
    directories: [...new Set(directories)].sort(compareText),
    errors: uniqueSorted(errors),
    resourceIds: uniqueSorted(resourceIds)
  };
}

async function publishDiscard(options: {
  afterResourceTombstone: AfterDiscardResourceTombstone;
  indexPath: string;
  indexText: string;
  originalIndexText: string;
  reportPath: string;
  resourceOwnerPath: string;
  resourceSnapshot: ResourceTreeScan;
  root: string;
  write: InvestigationDiscardWriter;
}): Promise<{
  changed: boolean;
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  mutation?: InvestigationMutationDiagnostic;
}> {
  try {
    await ensureRegularFile(options.reportPath);
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
  const trash = path.join(
    path.dirname(path.dirname(options.reportPath)),
    `.investigation-report-discard-${process.pid}-${randomUUID()}`
  );
  let movedReport = false;
  let movedResources = false;
  try {
    await fs.mkdir(trash, { recursive: false });
    await fs.rename(options.reportPath, path.join(trash, "report.md"));
    movedReport = true;
    const currentResources = await inspectOwnedResources(
      options.root,
      options.resourceOwnerPath
    );
    if (
      currentResources.errors.length > 0 ||
      !sameResourceTree(currentResources, options.resourceSnapshot)
    ) {
      throw new Error(
        currentResources.errors.length > 0
          ? `owned resources changed before discard publication: ${currentResources.errors.join("; ")}`
          : "owned resources changed before discard publication"
      );
    }
    const resourceEntry = await lstatOrNull(options.resourceOwnerPath);
    if (resourceEntry !== null) {
      if (resourceEntry.isSymbolicLink() || !resourceEntry.isDirectory()) {
        throw new Error(
          "owner resource path must be a non-symbolic-link directory"
        );
      }
      await fs.rename(options.resourceOwnerPath, path.join(trash, "resources"));
      movedResources = true;
      await options.afterResourceTombstone();
      const tombstonedResources = await scanOwnerResourceTree(
        path.join(trash, "resources"),
        path.basename(options.resourceOwnerPath)
      );
      if (
        tombstonedResources.errors.length > 0 ||
        !sameResourceTree(tombstonedResources, options.resourceSnapshot)
      ) {
        throw new Error(
          tombstonedResources.errors.length > 0
            ? `tombstoned owner resources changed before discard publication: ${tombstonedResources.errors.join("; ")}`
            : "tombstoned owner resources changed before discard publication"
        );
      }
    }
    await options.write(options.indexPath, options.indexText);
  } catch (error) {
    const restorationErrors = await restoreDiscard({
      ...options,
      movedReport,
      movedResources,
      trash,
      write: options.write
    });
    return {
      changed: false,
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.discard-publish-failed",
          error,
          mutation: discardMutation(
            restorationErrors.length === 0
              ? "rolled-back"
              : "partial-or-unknown"
          ),
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
      mutation: discardMutation(
        restorationErrors.length === 0 ? "rolled-back" : "partial-or-unknown"
      )
    };
  }
  try {
    await fs.unlink(path.join(trash, "report.md"));
    if (movedResources) {
      const tombstonedResources = await scanOwnerResourceTree(
        path.join(trash, "resources"),
        path.basename(options.resourceOwnerPath)
      );
      if (
        tombstonedResources.errors.length > 0 ||
        !sameResourceTree(tombstonedResources, options.resourceSnapshot)
      ) {
        throw new Error(
          "tombstoned owner resources changed before final deletion"
        );
      }
      await deletePreviewedResourceTree(
        path.join(trash, "resources"),
        path.basename(options.resourceOwnerPath),
        options.resourceSnapshot
      );
    }
    await fs.rmdir(trash);
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
  return { changed: true, diagnostics: [], errors: [] };
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

async function writeTextAtomically(
  targetPath: string,
  text: string
): Promise<void> {
  await ensureRegularFile(targetPath);
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(text, "utf8");
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function readRegularText(filePath: string): Promise<string> {
  await ensureRegularFile(filePath);
  return await fs.readFile(filePath, "utf8");
}
async function ensureRegularFile(filePath: string): Promise<void> {
  const entry = await fs.lstat(filePath);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new Error("must be a regular non-symbolic-link file");
  }
}
async function lstatOrNull(
  filePath: string
): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(filePath);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}
function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    Reflect.get(error, "code") === "ENOENT"
  );
}
function sameTextList(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sameResourceTree(
  left: ResourceTreeScan,
  right: ResourceTreeScan
): boolean {
  return (
    sameTextList(left.resourceIds, right.resourceIds) &&
    sameTextList(left.directories, right.directories)
  );
}

function discardResult(
  input: { investigationsDir?: string; workspaceRoot?: string },
  id: string,
  changed: boolean,
  deletedResourceIds: readonly string[],
  errors: readonly string[],
  options: Readonly<{
    diagnostics?: readonly InvestigationDiagnostic[];
    mutation?: InvestigationMutationDiagnostic;
  }> = {}
): InvestigationReportDiscardResult {
  const root = input.workspaceRoot ?? ".";
  const dir = input.investigationsDir ?? "docs/investigations";
  const sortedErrors = uniqueSorted(errors);
  return {
    changed,
    deletedResourceIds: [...deletedResourceIds].sort(compareText),
    diagnostics: defaultDiscardDiagnostics(
      id,
      sortedErrors,
      options.diagnostics
    ),
    errors: sortedErrors,
    id,
    indexPath: path.resolve(root, dir, investigationIndexFileName),
    ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
    requiresRecordedDeletionConfirmation: false
  };
}
function result(
  options: { id: string; indexPath: string },
  changed: boolean,
  deletedResourceIds: readonly string[],
  errors: readonly string[],
  resultOptions: Readonly<{
    diagnostics?: readonly InvestigationDiagnostic[];
    mutation?: InvestigationMutationDiagnostic;
  }> = {}
): InvestigationReportDiscardResult {
  const sortedErrors = uniqueSorted(errors);
  return {
    changed,
    deletedResourceIds: [...deletedResourceIds].sort(compareText),
    diagnostics: defaultDiscardDiagnostics(
      options.id,
      sortedErrors,
      resultOptions.diagnostics
    ),
    errors: sortedErrors,
    id: options.id,
    indexPath: options.indexPath,
    ...(resultOptions.mutation === undefined
      ? {}
      : { mutation: resultOptions.mutation }),
    requiresRecordedDeletionConfirmation: false
  };
}

function defaultDiscardDiagnostics(
  id: string,
  errors: readonly string[],
  diagnostics: readonly InvestigationDiagnostic[] | undefined
): InvestigationDiagnostic[] {
  if (diagnostics !== undefined) return [...diagnostics];
  if (errors.length === 0) return [];
  return [
    genericInvestigationDiagnostic({
      code: "investigation-report.discard-failed",
      reason: errors.join("; "),
      recovery:
        "correct the reported report, resource, relation, or confirmation problem before retrying discard",
      target: id || "requested Investigation ID"
    })
  ];
}

function discardMutation(
  outcome: InvestigationMutationDiagnostic["outcome"]
): InvestigationMutationDiagnostic {
  return { outcome, scope: "investigation report discard collection" };
}

function isDiscardResult(
  value: unknown
): value is InvestigationReportDiscardResult {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray(Reflect.get(value, "errors")) &&
    Array.isArray(Reflect.get(value, "diagnostics")) &&
    typeof Reflect.get(value, "changed") === "boolean" &&
    typeof Reflect.get(value, "id") === "string"
  );
}
function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function errorText(error: unknown): string {
  return sanitizeInvestigationDiagnosticText(error);
}
