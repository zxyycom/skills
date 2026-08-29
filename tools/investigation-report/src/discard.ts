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
import { withInvestigationCollectionMutationLock } from "./collection-mutation-lock.ts";
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
  ).catch((error: unknown) =>
    discardResult(parsed.value, parsed.value.id, false, [], [errorText(error)])
  );
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
      ]
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
    return result(options, false, [], recorded.errors);
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
  const currentIndexText = await readRegularText(options.indexPath).catch(
    () => null
  );
  if (currentIndexText !== originalIndexText) {
    return result(
      options,
      false,
      [],
      [
        "investigation index changed after discard validation; no files were written"
      ]
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
    publication.errors
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
}): Promise<{ changed: boolean; errors: string[] }> {
  try {
    await ensureRegularFile(options.reportPath);
  } catch (error) {
    return {
      changed: false,
      errors: [
        `report could not be verified before discard: ${errorText(error)}`
      ]
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
      errors: uniqueSorted([
        `discard transaction publish failed: ${errorText(error)}`,
        ...restorationErrors
      ])
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
      errors: [
        `discard committed but temporary deletion data at ${trash} could not be fully removed: ${errorText(error)}`
      ]
    };
  }
  return { changed: true, errors: [] };
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
  errors: readonly string[]
): InvestigationReportDiscardResult {
  const root = input.workspaceRoot ?? ".";
  const dir = input.investigationsDir ?? "docs/investigations";
  return {
    changed,
    deletedResourceIds: [...deletedResourceIds].sort(compareText),
    errors: uniqueSorted(errors),
    id,
    indexPath: path.resolve(root, dir, investigationIndexFileName),
    requiresRecordedDeletionConfirmation: false
  };
}
function result(
  options: { id: string; indexPath: string },
  changed: boolean,
  deletedResourceIds: readonly string[],
  errors: readonly string[]
): InvestigationReportDiscardResult {
  return {
    changed,
    deletedResourceIds: [...deletedResourceIds].sort(compareText),
    errors: uniqueSorted(errors),
    id: options.id,
    indexPath: options.indexPath,
    requiresRecordedDeletionConfirmation: false
  };
}
function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
