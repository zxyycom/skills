import { randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import { candidatePathForInvestigationId } from "./candidate-path.ts";
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
import { inspectInvestigationCollectionLayout } from "./investigation-index-source.ts";
import {
  investigationIndexFileName,
  isInvestigationId,
  resolveInvestigationsDirectory,
  canonicalizeInvestigationsDirectory
} from "./report-path.ts";
import {
  investigationResourcesDirectoryName,
  isInvestigationResourceId
} from "./resource-reference.ts";
import { readCandidateAuthoringResourceReferences } from "./candidate.ts";
import { parseInvestigationCandidateDiscardOptions } from "./options.ts";
import type {
  InvestigationCandidateDiscardOptions,
  InvestigationCandidateDiscardResult
} from "./types.ts";

type BeforeCandidateDiscard = () => Promise<void>;

export async function discardInvestigationCandidate(
  input: unknown
): Promise<InvestigationCandidateDiscardResult> {
  return await discardInvestigationCandidateWithHook(input);
}

export async function discardInvestigationCandidateWithHook(
  input: unknown,
  beforeCommit: BeforeCandidateDiscard = async () => {}
): Promise<InvestigationCandidateDiscardResult> {
  const parsed = parseInvestigationCandidateDiscardOptions(input);
  if (parsed.isErr()) return invalidResult(input, parsed.error);
  const options = parsed.value;
  const errors = validateOptions(options);
  if (errors.length > 0) return result(options, false, [], errors);
  const resolved = resolveInvestigationsDirectory(
    options.workspaceRoot,
    options.investigationsDir
  );
  if (resolved.isErr()) return result(options, false, [], resolved.error);
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr()) return result(options, false, [], canonical.error);
  const root = canonical.value.investigationsDirectory;
  const indexPath = path.join(root, investigationIndexFileName);
  try {
    return await withInvestigationCollectionMutationLock(indexPath, async () =>
      discardCandidateWithinLock({ beforeCommit, input: options, root })
    );
  } catch (error) {
    return lockFailure(options, error);
  }
}

async function discardCandidateWithinLock(options: {
  beforeCommit: BeforeCandidateDiscard;
  input: InvestigationCandidateDiscardOptions;
  root: string;
}): Promise<InvestigationCandidateDiscardResult> {
  const prepared = await prepareCandidateDiscard(
    options.root,
    options.input.id
  );
  if (prepared.status === "error") {
    return result(options.input, false, [], prepared.errors, {
      diagnostics: prepared.diagnostics,
      mutation: discardMutation("no-change")
    });
  }
  const eligibility = candidateDiscardEligibility(
    options.input,
    prepared.value
  );
  if (eligibility !== null) return eligibility;
  const historyGate = await candidateDiscardHistoryGate(
    options.root,
    options.input,
    prepared.value,
    false
  );
  if (historyGate !== null) return historyGate;
  const beforeCommitFailure =
    await candidateDiscardBeforeCommitFailure(options);
  if (beforeCommitFailure !== null) return beforeCommitFailure;
  return await discardProtectedCandidate(options, prepared.value);
}

async function discardProtectedCandidate(
  options: {
    input: InvestigationCandidateDiscardOptions;
    root: string;
  },
  initialPreparation: CandidateDiscardPreparation
): Promise<InvestigationCandidateDiscardResult> {
  const protectedPreparation = await prepareCandidateDiscard(
    options.root,
    options.input.id
  );
  if (
    protectedPreparation.status === "error" ||
    !sameCandidateDiscardPreparation(
      initialPreparation,
      protectedPreparation.value
    )
  ) {
    return result(
      options.input,
      false,
      [],
      [
        "candidate or owner resources changed after discard preparation; no files were written",
        ...(protectedPreparation.status === "error"
          ? protectedPreparation.errors
          : [])
      ],
      {
        diagnostics:
          protectedPreparation.status === "error"
            ? protectedPreparation.diagnostics
            : [],
        mutation: discardMutation("no-change")
      }
    );
  }
  const protectedHistoryGate = await candidateDiscardHistoryGate(
    options.root,
    options.input,
    protectedPreparation.value,
    true
  );
  if (protectedHistoryGate !== null) return protectedHistoryGate;
  return await discardPreparedCandidate(
    options.input,
    options.root,
    protectedPreparation.value
  );
}

function candidateDiscardEligibility(
  input: InvestigationCandidateDiscardOptions,
  preparation: CandidateDiscardPreparation
): InvestigationCandidateDiscardResult | null {
  if (
    preparation.resources.resourceIds.length > 0 &&
    input.deleteOwnedResources !== true
  ) {
    return result(
      input,
      false,
      [],
      [
        `${input.id} owns ${preparation.resources.resourceIds.length} resource(s); re-run with --delete-owned-resources only after confirming their deletion`
      ],
      { mutation: discardMutation("no-change") }
    );
  }
  if (preparation.sharedReferences.length > 0) {
    return result(input, false, [], preparation.sharedReferences, {
      mutation: discardMutation("no-change")
    });
  }
  return null;
}

async function candidateDiscardHistoryGate(
  root: string,
  input: InvestigationCandidateDiscardOptions,
  preparation: CandidateDiscardPreparation,
  protectedCheck: boolean
): Promise<InvestigationCandidateDiscardResult | null> {
  const recorded = await candidateRecordedAtHead(
    root,
    input.id,
    preparation.resources.resourceIds
  );
  if (recorded.status === "error") {
    const timing = protectedCheck
      ? " immediately before candidate discard"
      : " before candidate discard";
    return result(input, false, [], recorded.errors, {
      diagnostics: [
        genericInvestigationDiagnostic({
          code: "investigation-report.discard-candidate-history-check-unavailable",
          mutation: discardMutation("no-change"),
          reason: `the Git history check required${timing} could not be completed`,
          recovery:
            "restore version-control access, then rerun discard-candidate before deleting the candidate",
          target: input.id
        })
      ],
      mutation: discardMutation("no-change")
    });
  }
  if (!recorded.value || input.deleteRecordedCandidate === true) return null;
  const timing = protectedCheck ? " entered" : " has entered";
  return {
    ...result(
      input,
      false,
      [],
      [
        `Investigation candidate ${input.id}${timing} Git HEAD${protectedCheck ? " before deletion" : ""}; confirm that its recorded history should be deleted.`,
        "Re-run with --delete-recorded-candidate only after confirming deletion; no files were changed."
      ],
      { mutation: discardMutation("no-change") }
    ),
    requiresRecordedDeletionConfirmation: true
  };
}

async function candidateDiscardBeforeCommitFailure(options: {
  beforeCommit: BeforeCandidateDiscard;
  input: InvestigationCandidateDiscardOptions;
}): Promise<InvestigationCandidateDiscardResult | null> {
  try {
    await options.beforeCommit();
    return null;
  } catch (error) {
    return result(
      options.input,
      false,
      [],
      ["candidate discard could not continue before files were moved"],
      {
        diagnostics: [
          diagnosticFromError({
            code: "investigation-report.discard-candidate-before-commit-failed",
            error,
            mutation: discardMutation("no-change"),
            reason:
              "the candidate discard transaction stopped before moving files",
            recovery:
              "resolve the reported failure, then retry from the current collection state",
            target: options.input.id
          })
        ],
        mutation: discardMutation("no-change")
      }
    );
  }
}

type CandidateDiscardPreparation = Readonly<{
  candidatePath: string;
  candidateText: string;
  resources: CandidateResourceTree;
  sharedReferences: string[];
}>;

type CandidateDiscardPreparationResult =
  | Readonly<{ status: "ok"; value: CandidateDiscardPreparation }>
  | Readonly<{
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
    }>;

async function prepareCandidateDiscard(
  root: string,
  id: string
): Promise<CandidateDiscardPreparationResult> {
  try {
    return await buildCandidateDiscardPreparation(root, id);
  } catch (error) {
    return {
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.discard-candidate-prepare-failed",
          error,
          reason:
            "the candidate and owner resources could not be prepared for discard",
          recovery:
            "restore a readable candidate collection and owner resource tree, then retry discard-candidate",
          target: id
        })
      ],
      errors: ["candidate discard preparation could not be completed"],
      status: "error"
    };
  }
}

async function buildCandidateDiscardPreparation(
  root: string,
  id: string
): Promise<CandidateDiscardPreparationResult> {
  const layout = await inspectInvestigationCollectionLayout(root);
  if (layout.errors.length > 0) {
    return { diagnostics: [], errors: layout.errors, status: "error" };
  }
  if (!layout.candidateIds.includes(id)) {
    return {
      diagnostics: [],
      errors: [`${id} investigation candidate does not exist`],
      status: "error"
    };
  }
  const candidatePath = candidatePathForInvestigationId(root, id);
  const candidateEntry = await fs.lstat(candidatePath);
  if (candidateEntry.isSymbolicLink() || !candidateEntry.isFile()) {
    return {
      diagnostics: [],
      errors: [
        `${id} investigation candidate must be a regular non-symbolic-link file`
      ],
      status: "error"
    };
  }
  const candidateText = await fs.readFile(candidatePath, "utf8");
  const ownerPath = path.join(
    root,
    investigationResourcesDirectoryName,
    id.slice(0, -".md".length)
  );
  const resources = await scanCandidateOwnerResources(root, ownerPath);
  if (resources.errors.length > 0) {
    return { diagnostics: [], errors: resources.errors, status: "error" };
  }
  const references = await readCandidateAuthoringResourceReferences(root, {
    failOnInvalidSources: true
  });
  const ownerPrefix = `${id.slice(0, -".md".length)}/`;
  const sharedReferences = [...references]
    .filter(
      ([source, ids]) =>
        source !== id &&
        [...ids].some((resourceId) => resourceId.startsWith(ownerPrefix))
    )
    .map(
      ([source]) =>
        `${id} owns resources still referenced by ${source}; remove or replace those resource links before discard-candidate`
    )
    .sort(compareText);
  return {
    status: "ok",
    value: { candidatePath, candidateText, resources, sharedReferences }
  };
}

async function discardPreparedCandidate(
  input: InvestigationCandidateDiscardOptions,
  root: string,
  preparation: CandidateDiscardPreparation
): Promise<InvestigationCandidateDiscardResult> {
  const tombstone = candidateDiscardTombstone(input, root, preparation);
  const moved = await moveCandidateToTombstone(preparation, tombstone);
  if (moved.status === "error") {
    return candidateTombstoneMoveFailure(input, moved);
  }
  return await finishCandidateTombstoneDiscard(input, preparation, tombstone);
}

type CandidateDiscardTombstone = Readonly<{
  candidatePath: string;
  resourceOwnerPath: string;
  trash: string;
  trashCandidate: string;
  trashResources: string;
}>;

function candidateDiscardTombstone(
  input: InvestigationCandidateDiscardOptions,
  root: string,
  preparation: CandidateDiscardPreparation
): CandidateDiscardTombstone {
  const trash = path.join(
    path.dirname(root),
    `.investigation-candidate-discard-${randomUUID()}`
  );
  const trashCandidate = path.join(trash, "candidate");
  const trashResources = path.join(trash, "resources");
  const resourceOwnerPath = path.join(
    root,
    investigationResourcesDirectoryName,
    input.id.slice(0, -".md".length)
  );
  return {
    candidatePath: preparation.candidatePath,
    resourceOwnerPath,
    trash,
    trashCandidate,
    trashResources
  };
}

async function moveCandidateToTombstone(
  preparation: CandidateDiscardPreparation,
  tombstone: CandidateDiscardTombstone
): Promise<
  | { status: "ok" }
  | {
      error: unknown;
      outcome: "partial-or-unknown" | "rolled-back";
      restoreErrors: string[];
      status: "error";
    }
> {
  let movedCandidate = false;
  let movedResources = false;
  try {
    await fs.mkdir(tombstone.trash, { mode: 0o700 });
    await fs.rename(preparation.candidatePath, tombstone.trashCandidate);
    movedCandidate = true;
    if (preparation.resources.resourceIds.length > 0) {
      await fs.rename(tombstone.resourceOwnerPath, tombstone.trashResources);
      movedResources = true;
      const afterMove = await scanResourceTree(
        tombstone.trashResources,
        path.basename(tombstone.resourceOwnerPath)
      );
      if (!sameResourceTree(preparation.resources, afterMove)) {
        throw new Error(
          "owner resource members changed while being moved to tombstone"
        );
      }
    }
  } catch (error) {
    const restoreErrors = await restoreTombstone({
      candidatePath: tombstone.candidatePath,
      movedCandidate,
      movedResources,
      resourceOwnerPath: tombstone.resourceOwnerPath,
      trash: tombstone.trash,
      trashCandidate: tombstone.trashCandidate,
      trashResources: tombstone.trashResources
    });
    const outcome =
      restoreErrors.length === 0 ? "rolled-back" : "partial-or-unknown";
    return { error, outcome, restoreErrors, status: "error" };
  }
  return { status: "ok" };
}

function candidateTombstoneMoveFailure(
  input: InvestigationCandidateDiscardOptions,
  failure: Extract<
    Awaited<ReturnType<typeof moveCandidateToTombstone>>,
    { status: "error" }
  >
): InvestigationCandidateDiscardResult {
  return result(
    input,
    false,
    [],
    [
      "candidate discard failed before its commit point",
      ...failure.restoreErrors
    ],
    {
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.discard-candidate-publish-failed",
          error: failure.error,
          mutation: discardMutation(failure.outcome),
          reason:
            "the candidate and confirmed owner resources could not be moved to their tombstone",
          recovery:
            failure.outcome === "rolled-back"
              ? "correct the reported failure, then retry discard-candidate"
              : "stop mutations and reconcile the candidate and owner resource paths before retrying",
          target: input.id
        })
      ],
      mutation: discardMutation(failure.outcome)
    }
  );
}

async function finishCandidateTombstoneDiscard(
  input: InvestigationCandidateDiscardOptions,
  preparation: CandidateDiscardPreparation,
  tombstone: CandidateDiscardTombstone
): Promise<InvestigationCandidateDiscardResult> {
  const cleanupErrors = await cleanTombstone({
    candidatePath: tombstone.trashCandidate,
    resources: preparation.resources,
    resourcesPath: tombstone.trashResources,
    trash: tombstone.trash
  });
  return result(input, true, preparation.resources.resourceIds, cleanupErrors, {
    diagnostics:
      cleanupErrors.length === 0
        ? []
        : [
            genericInvestigationDiagnostic({
              code: "investigation-report.discard-candidate-cleanup-pending",
              mutation: discardMutation("committed-cleanup-pending"),
              reason:
                "the candidate discard committed, but the exact tombstone cleanup could not finish",
              recovery:
                "inspect and remove only the reported tombstone residue before another mutation",
              target: tombstone.trash
            })
          ],
    mutation:
      cleanupErrors.length === 0
        ? undefined
        : discardMutation("committed-cleanup-pending")
  });
}

type CandidateResourceTree = Readonly<{
  directories: string[];
  errors: string[];
  resourceIds: string[];
}>;

async function scanCandidateOwnerResources(
  root: string,
  ownerPath: string
): Promise<CandidateResourceTree> {
  const scanned = await scanResourceTree(ownerPath, path.basename(ownerPath));
  if (scanned.errors.length > 0 || scanned.resourceIds.length === 0)
    return scanned;
  const repository = await openRepository(root);
  if (repository.status === "error") {
    return { ...scanned, errors: repository.errors };
  }
  if (repository.value === null) return scanned;
  try {
    const resourcesRoot = path.join(root, investigationResourcesDirectoryName);
    const scope = repositoryScope(repository.value, resourcesRoot);
    const visible = new Set(
      (
        await repository.value.listWorkspaceFiles({ pathScopes: [scope] })
      ).flatMap((file) =>
        file.startsWith(`${scope}/`) ? [file.slice(scope.length + 1)] : []
      )
    );
    const errors = scanned.resourceIds
      .filter((id) => !visible.has(id))
      .map(
        (id) =>
          `owned resource ${id} is ignored by version-control rules and cannot be deleted transactionally`
      );
    return { ...scanned, errors };
  } catch {
    return {
      ...scanned,
      errors: [
        "owned resources could not be checked against version-control membership"
      ]
    };
  }
}

async function scanResourceTree(
  ownerPath: string,
  ownerPrefix: string
): Promise<CandidateResourceTree> {
  const owner = await lstatOrNull(ownerPath);
  if (owner === null) return { directories: [], errors: [], resourceIds: [] };
  if (owner.isSymbolicLink() || !owner.isDirectory()) {
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
    } catch {
      errors.push("owned resources could not be inspected");
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
      } catch {
        errors.push(`owned resource ${resourceId} could not be inspected`);
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
            `owned resource ${resourceId} must use a safe resource ID`
          );
        } else {
          resourceIds.push(resourceId);
        }
      } else {
        errors.push(
          `owned resource ${resourceId} must be a regular file or directory`
        );
      }
    }
  }
  await walk(ownerPath, "");
  return {
    directories: directories.sort(compareText),
    errors: uniqueSorted(errors),
    resourceIds: resourceIds.sort(compareText)
  };
}

async function candidateRecordedAtHead(
  root: string,
  id: string,
  resourceIds: readonly string[]
): Promise<
  | Readonly<{ status: "ok"; value: boolean }>
  | Readonly<{ errors: string[]; status: "error" }>
> {
  const repository = await openRepository(root);
  if (repository.status === "error") return repository;
  if (repository.value === null) return { status: "ok", value: false };
  try {
    const revision = await repository.value.getCurrentRevision();
    if (revision === null) return { status: "ok", value: false };
    const scope = repositoryScope(repository.value, root);
    const candidate = path.basename(candidatePathForInvestigationId(root, id));
    const paths = [
      scope.length === 0 ? candidate : `${scope}/${candidate}`,
      ...resourceIds.map((resource) =>
        scope.length === 0
          ? `${investigationResourcesDirectoryName}/${resource}`
          : `${scope}/${investigationResourcesDirectoryName}/${resource}`
      )
    ];
    const files = await repository.value.listRevisionFiles(revision, {
      pathScopes: paths
    });
    return { status: "ok", value: files.length > 0 };
  } catch {
    return {
      errors: ["Git HEAD could not be inspected before discard-candidate"],
      status: "error"
    };
  }
}

async function openRepository(
  root: string
): Promise<
  | Readonly<{ status: "ok"; value: VersionControlRepository | null }>
  | Readonly<{ errors: string[]; status: "error" }>
> {
  try {
    return { status: "ok", value: await openVersionControl(root) };
  } catch (error) {
    if (
      error instanceof VersionControlError &&
      error.code === "not-repository"
    ) {
      return { status: "ok", value: null };
    }
    return {
      errors: [
        "version-control state could not be inspected before discard-candidate"
      ],
      status: "error"
    };
  }
}

function repositoryScope(
  repository: VersionControlRepository,
  directory: string
): string {
  return path.resolve(directory) === repository.rootDirectory
    ? ""
    : repositoryRelativePathFromFileSystemPath(
        repository.rootDirectory,
        directory
      );
}

async function restoreTombstone(options: {
  candidatePath: string;
  movedCandidate: boolean;
  movedResources: boolean;
  resourceOwnerPath: string;
  trash: string;
  trashCandidate: string;
  trashResources: string;
}): Promise<string[]> {
  const errors: string[] = [];
  if (options.movedResources) {
    try {
      await fs.rename(options.trashResources, options.resourceOwnerPath);
    } catch {
      errors.push("failed to restore candidate owner resources");
    }
  }
  if (options.movedCandidate) {
    try {
      await fs.rename(options.trashCandidate, options.candidatePath);
    } catch {
      errors.push("failed to restore investigation candidate");
    }
  }
  await fs.rmdir(options.trash).catch(() => undefined);
  return uniqueSorted(errors);
}

async function cleanTombstone(options: {
  candidatePath: string;
  resources: CandidateResourceTree;
  resourcesPath: string;
  trash: string;
}): Promise<string[]> {
  const errors: string[] = [];
  try {
    if (options.resources.resourceIds.length > 0) {
      for (const id of [...options.resources.resourceIds].reverse()) {
        const relative = id.split("/").slice(1);
        await fs.unlink(path.join(options.resourcesPath, ...relative));
      }
      for (const directory of [...options.resources.directories].sort(
        (left, right) => right.length - left.length
      )) {
        await fs.rmdir(path.join(options.resourcesPath, directory));
      }
    }
    await fs.unlink(options.candidatePath);
    await fs.rmdir(options.trash);
  } catch {
    errors.push(`candidate tombstone cleanup is pending at ${options.trash}`);
  }
  return errors;
}

function sameCandidateDiscardPreparation(
  left: CandidateDiscardPreparation,
  right: CandidateDiscardPreparation | undefined
): boolean {
  return (
    right !== undefined &&
    left.candidatePath === right.candidatePath &&
    left.candidateText === right.candidateText &&
    sameResourceTree(left.resources, right.resources) &&
    sameTextList(left.sharedReferences, right.sharedReferences)
  );
}

function sameResourceTree(
  left: CandidateResourceTree,
  right: CandidateResourceTree
): boolean {
  return (
    sameTextList(left.resourceIds, right.resourceIds) &&
    sameTextList(left.directories, right.directories)
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

function validateOptions(
  input: InvestigationCandidateDiscardOptions
): string[] {
  return uniqueSorted(
    !isInvestigationId(input.id)
      ? [
          `${input.id || "<empty>"} discard-candidate id must use an Investigation ID`
        ]
      : []
  );
}

function invalidResult(
  input: unknown,
  errors: readonly string[]
): InvestigationCandidateDiscardResult {
  const id =
    typeof input === "object" &&
    input !== null &&
    typeof Reflect.get(input, "id") === "string"
      ? (Reflect.get(input, "id") as string)
      : "";
  return result({ id }, false, [], errors);
}

function lockFailure(
  input: InvestigationCandidateDiscardOptions,
  error: unknown
): InvestigationCandidateDiscardResult {
  if (
    error instanceof InvestigationCollectionMutationLockError &&
    error.operationCompleted &&
    isDiscardResult(error.operationResult)
  ) {
    const completed = error.operationResult;
    const mutation = discardMutation(
      completed.changed ? "committed-cleanup-pending" : "no-change"
    );
    return {
      ...completed,
      diagnostics: [
        ...completed.diagnostics,
        { ...error.diagnostic, mutation }
      ],
      errors: uniqueSorted([
        ...completed.errors,
        sanitizeInvestigationDiagnosticText(error)
      ]),
      mutation
    };
  }
  const releaseFailure =
    error instanceof InvestigationCollectionMutationLockError &&
    error.diagnostic.code ===
      "investigation-report.collection-lock-release-failed";
  const mutation = discardMutation(
    releaseFailure ? "partial-or-unknown" : "no-change"
  );
  return result(
    input,
    false,
    [],
    ["investigation candidate discard could not be completed"],
    {
      diagnostics: [
        error instanceof InvestigationCollectionMutationLockError
          ? { ...error.diagnostic, mutation }
          : diagnosticFromError({
              code: "investigation-report.discard-candidate-transaction-failed",
              error,
              mutation,
              reason: "the candidate discard transaction stopped unexpectedly",
              recovery:
                "verify the candidate and owner resource paths before retrying discard-candidate",
              target: input.id
            })
      ],
      mutation
    }
  );
}

function result(
  input: Pick<InvestigationCandidateDiscardOptions, "id">,
  changed: boolean,
  deletedResourceIds: readonly string[],
  errors: readonly string[],
  options: Readonly<{
    diagnostics?: readonly InvestigationDiagnostic[];
    mutation?: InvestigationMutationDiagnostic;
  }> = {}
): InvestigationCandidateDiscardResult {
  return {
    changed,
    deletedResourceIds: [...deletedResourceIds].sort(compareText),
    diagnostics: [...(options.diagnostics ?? [])],
    errors: uniqueSorted(errors),
    id: input.id,
    ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
    requiresRecordedDeletionConfirmation: false
  };
}

function discardMutation(
  outcome: InvestigationMutationDiagnostic["outcome"]
): InvestigationMutationDiagnostic {
  return { outcome, scope: "investigation candidate discard collection" };
}

function isDiscardResult(
  value: unknown
): value is InvestigationCandidateDiscardResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "changed") === "boolean" &&
    Array.isArray(Reflect.get(value, "errors")) &&
    typeof Reflect.get(value, "id") === "string"
  );
}

async function lstatOrNull(
  target: string
): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(target);
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

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
