import { Buffer } from "node:buffer";
import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { operationErrorDetail } from "../../shared/src/version-control/error-detail.ts";
import {
  openVersionControl,
  type RevisionId,
  type VersionControlFile,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import {
  decisionDiagnostic,
  decisionFailure,
  decisionVersionControlFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { VersionControlError } from "../../shared/src/version-control/index.ts";
import {
  buildDecisionIndexFromSnapshot,
  buildDecisionStateSnapshotFromSources,
  decisionIndexDiagnosticMessages,
  decisionIndexFileName,
  parseDecisionIndex,
  serializeDecisionIndex
} from "./decision-state-index.ts";
import {
  decisionIdFromSourcePath,
  displayDecisionPath,
  isDecisionId,
  isDecisionSourcePath
} from "./decision-path.ts";
import { validateDecisionBody } from "./record.ts";
import {
  resolveDecisionLocation,
  type DecisionLocation
} from "./decision-query-context.ts";
import type { DecisionId, DecisionSource } from "./types.ts";

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

export type DecisionStageSuccess = {
  command: "stage";
  indexRelativePath: string;
  pendingFileCount: number;
  selectedIds: DecisionId[];
  status: "ok";
};

export type DecisionStageResult =
  | DecisionApplicationFailure
  | DecisionStageSuccess;

type DecisionStageSource = {
  file: VersionControlFile;
  source: DecisionSource;
};

export async function stageDecisionRecords(options: {
  decisionIds: readonly string[];
  location: DecisionLocation;
}): Promise<DecisionStageResult> {
  const selectedIds = validateSelectedIds(options.decisionIds);
  if (selectedIds.status === "error") {
    return selectedIds;
  }
  const location = resolveDecisionLocation(options.location);
  let repository: VersionControlRepository;
  try {
    repository = await openVersionControl(location.decisionsDirectory);
  } catch (error) {
    return versionControlFailure(
      "open the version-controlled decision workspace",
      error
    );
  }
  const decisionScope = decisionRepositoryScope(
    repository.rootDirectory,
    location.decisionsDirectory
  );
  if (decisionScope === null) {
    return decisionFailure([
      "Decision directory must be inside, and below the root of, its version-controlled " +
        "repository: " +
        location.decisionsDirectory
    ]);
  }
  let expectedPendingFiles: VersionControlFile[];
  let pendingRevision: RevisionId | null;
  try {
    pendingRevision = await repository.getCurrentRevision();
    expectedPendingFiles = await repository.readPendingFiles({
      pathScopes: [decisionScope]
    });
    const existingPending =
      pendingRevision === null
        ? []
        : await repository.listPendingChangedPaths({
            from: pendingRevision,
            pathScopes: [decisionScope]
          });
    if (
      existingPending.length > 0 ||
      (pendingRevision === null && expectedPendingFiles.length > 0)
    ) {
      return decisionFailure([
        "Decision pending snapshot already contains files in " +
          decisionScope +
          "; inspect or resolve it before staging another decision set."
      ]);
    }
  } catch (error) {
    return versionControlFailure(
      "inspect the pending decision snapshot",
      error
    );
  }

  let target: DecisionStageTarget;
  try {
    target = await buildDecisionStageTarget({
      decisionsDirectory: location.decisionsDirectory,
      decisionScope,
      repository,
      revision: pendingRevision,
      selectedIds: selectedIds.value
    });
  } catch (error) {
    if (error instanceof DecisionStageInputError) {
      return stageInputFailure([error.message], 2);
    }
    if (error instanceof DecisionStageFileSystemError) {
      return stageFileSystemFailure(
        "Failed to construct the selected decision snapshot.",
        error.cause
      );
    }
    if (error instanceof VersionControlError) {
      return versionControlFailure(
        "construct the selected decision snapshot",
        error
      );
    }
    return stageDomainFailure(
      "decision-records.stage-snapshot-invalid",
      "The selected decision snapshot is invalid.",
      "Decision stage source selection",
      error
    );
  }
  if (target.sources.length === 0) {
    return decisionFailure([
      "Selected Decision IDs must produce at least one established decision"
    ]);
  }

  const indexPath = repositoryPath(decisionScope, decisionIndexFileName);
  const indexRelativePath = displayDecisionPath(
    location.workspaceRoot,
    path.join(location.decisionsDirectory, decisionIndexFileName)
  );
  let indexText: string;
  try {
    indexText = await buildDecisionIndexText(target.sources, indexRelativePath);
  } catch (error) {
    return stageDomainFailure(
      "decision-records.stage-index-projection-invalid",
      "The selected decision snapshot cannot produce a derived index.",
      indexRelativePath,
      error
    );
  }
  const files = [
    ...target.sourceFiles,
    { data: Buffer.from(indexText, "utf8"), path: indexPath }
  ].sort(compareVersionControlFiles);
  try {
    await verifySelectedFilesystemSources(
      location.decisionsDirectory,
      decisionScope,
      target.selectedSources
    );
  } catch (error) {
    if (error instanceof DecisionStageFileSystemError) {
      return stageFileSystemFailure(
        "Failed to verify selected decision filesystem sources before staging.",
        error.cause
      );
    }
    return stageDomainFailure(
      "decision-records.stage-source-changed",
      "Selected decision filesystem source changed before staging.",
      "Selected decision filesystem sources",
      error
    );
  }
  let pendingFileCount: number;
  try {
    const replaced = await repository.replacePendingFiles({
      expectedFiles: expectedPendingFiles,
      expectedRevision: target.revision,
      files,
      pathScope: decisionScope
    });
    pendingFileCount = replaced.pendingPaths.length;
  } catch (error) {
    return versionControlFailure(
      "replace the pending decision snapshot",
      error
    );
  }
  return {
    command: "stage",
    indexRelativePath,
    pendingFileCount,
    selectedIds: selectedIds.value,
    status: "ok"
  };
}

type DecisionStageTarget = {
  revision: RevisionId | null;
  selectedSources: SelectedFilesystemSource[];
  sourceFiles: VersionControlFile[];
  sources: DecisionSource[];
};

type SelectedFilesystemSource = {
  decisionId: DecisionId;
  source: DecisionStageSource | null;
};

async function buildDecisionStageTarget(options: {
  decisionsDirectory: string;
  decisionScope: string;
  repository: VersionControlRepository;
  revision: RevisionId | null;
  selectedIds: readonly DecisionId[];
}): Promise<DecisionStageTarget> {
  const baseline = await readDecisionBaseline({
    decisionsDirectory: options.decisionsDirectory,
    decisionScope: options.decisionScope,
    repository: options.repository,
    revision: options.revision
  });
  const sourceById = new Map(
    baseline.map((source) => [source.source.decisionId, source])
  );
  let selectedSources: SelectedFilesystemSource[];
  if (options.revision === null || baseline.length === 0) {
    const filesystem = await readFilesystemDecisionSources(
      options.decisionsDirectory,
      options.decisionScope
    );
    selectedSources = options.selectedIds.map((decisionId) => ({
      decisionId,
      source: filesystem.get(decisionId) ?? null
    }));
    for (const selectedSource of selectedSources) {
      if (selectedSource.source === null) {
        throw new DecisionStageInputError(
          "Selected Decision ID does not exist in the filesystem: " +
            selectedSource.decisionId
        );
      }
    }
    for (const source of filesystem.values()) {
      sourceById.set(source.source.decisionId, source);
    }
  } else {
    selectedSources = await Promise.all(
      options.selectedIds.map(async (decisionId) => ({
        decisionId,
        source: await readFilesystemDecisionSource(
          options.decisionsDirectory,
          options.decisionScope,
          decisionId
        )
      }))
    );
    for (const selectedSource of selectedSources) {
      if (
        selectedSource.source === null &&
        !sourceById.has(selectedSource.decisionId)
      ) {
        throw new DecisionStageInputError(
          "Selected Decision ID does not exist in the revision or filesystem: " +
            selectedSource.decisionId
        );
      }
      if (selectedSource.source === null) {
        sourceById.delete(selectedSource.decisionId);
      } else {
        sourceById.set(selectedSource.decisionId, selectedSource.source);
      }
    }
  }
  const sources = [...sourceById.values()].sort((left, right) =>
    compareText(left.source.decisionId, right.source.decisionId)
  );
  return {
    revision: options.revision,
    selectedSources,
    sourceFiles: sources.map((source) => source.file),
    sources: sources.map((source) => source.source)
  };
}

async function readDecisionBaseline(options: {
  decisionsDirectory: string;
  decisionScope: string;
  repository: VersionControlRepository;
  revision: RevisionId | null;
}): Promise<DecisionStageSource[]> {
  if (options.revision === null) {
    return [];
  }
  const revisionPaths = await options.repository.listRevisionFiles(
    options.revision,
    { pathScopes: [options.decisionScope] }
  );
  if (revisionPaths.length === 0) {
    return [];
  }
  const sourcePaths: string[] = [];
  for (const repositoryFilePath of revisionPaths) {
    const sourcePath = decisionRelativePath(
      options.decisionScope,
      repositoryFilePath
    );
    if (sourcePath === decisionIndexFileName) {
      continue;
    }
    if (decisionIdFromSourcePath(sourcePath) === null) {
      throw new Error(
        "revision decision scope contains unsupported file: " + sourcePath
      );
    }
    sourcePaths.push(repositoryFilePath);
  }
  if (sourcePaths.length === 0) {
    return [];
  }
  const files = await options.repository.readRevisionFiles(options.revision, {
    pathScopes: sourcePaths
  });
  return files.map((file) =>
    stageSourceFromFile(
      file,
      decisionRelativePath(options.decisionScope, file.path)
    )
  );
}

async function readFilesystemDecisionSources(
  decisionsDirectory: string,
  decisionScope: string
): Promise<Map<DecisionId, DecisionStageSource>> {
  const sources = new Map<DecisionId, DecisionStageSource>();
  const addSource = async (sourcePath: string): Promise<void> => {
    const decisionId = decisionIdFromSourcePath(sourcePath);
    if (decisionId === null) {
      throw new Error(
        "filesystem decision scope contains unsupported file: " + sourcePath
      );
    }
    if (sources.has(decisionId)) {
      throw new Error(
        "Decision ID occurs in more than one filesystem source path: " +
          decisionId
      );
    }
    const data = await readStageFile(
      path.join(decisionsDirectory, ...sourcePath.split("/"))
    );
    sources.set(
      decisionId,
      stageSourceFromFile(
        {
          data,
          path: repositoryPath(decisionScope, sourcePath)
        },
        sourcePath
      )
    );
  };
  const rootEntries = await readStageDirectory(decisionsDirectory);
  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      await addSource(entry.name);
    } else if (entry.isDirectory() && entry.name === "archive") {
      const archivedEntries = await readStageDirectory(
        path.join(decisionsDirectory, "archive")
      );
      for (const archivedEntry of archivedEntries) {
        if (!archivedEntry.isFile() || !archivedEntry.name.endsWith(".md")) {
          throw new Error(
            "filesystem archive contains unsupported entry: " +
              archivedEntry.name
          );
        }
        await addSource("archive/" + archivedEntry.name);
      }
    } else if (entry.name !== decisionIndexFileName) {
      throw new Error(
        "filesystem decision scope contains unsupported entry: " + entry.name
      );
    }
  }
  return sources;
}

async function verifySelectedFilesystemSources(
  decisionsDirectory: string,
  decisionScope: string,
  selectedSources: readonly SelectedFilesystemSource[]
): Promise<void> {
  for (const selectedSource of selectedSources) {
    const current = await readFilesystemDecisionSource(
      decisionsDirectory,
      decisionScope,
      selectedSource.decisionId
    );
    if (selectedSource.source === null && current === null) {
      continue;
    }
    if (
      selectedSource.source === null ||
      current === null ||
      selectedSource.source.source.sourcePath !== current.source.sourcePath ||
      !Buffer.from(selectedSource.source.file.data).equals(
        Buffer.from(current.file.data)
      )
    ) {
      throw new Error(selectedSource.decisionId);
    }
  }
}

async function readFilesystemDecisionSource(
  decisionsDirectory: string,
  decisionScope: string,
  decisionId: DecisionId
): Promise<DecisionStageSource | null> {
  const sourcePaths = [decisionId, "archive/" + decisionId];
  const sources: DecisionStageSource[] = [];
  for (const sourcePath of sourcePaths) {
    const filesystemPath = path.join(
      decisionsDirectory,
      ...sourcePath.split("/")
    );
    let entry;
    try {
      entry = await fs.lstat(filesystemPath);
    } catch (error) {
      if (isFileSystemError(error, "ENOENT")) {
        continue;
      }
      throw new DecisionStageFileSystemError(error);
    }
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(
        "Decision source must be a regular non-symlink file: " + sourcePath
      );
    }
    const data = await readStageFile(filesystemPath);
    sources.push(
      stageSourceFromFile(
        {
          data,
          path: repositoryPath(decisionScope, sourcePath)
        },
        sourcePath
      )
    );
  }
  if (sources.length > 1) {
    throw new Error(
      "Decision ID occurs in more than one filesystem source path: " +
        decisionId
    );
  }
  return sources[0] ?? null;
}

function stageSourceFromFile(
  file: VersionControlFile,
  sourcePath: string
): DecisionStageSource {
  const decisionId = decisionIdFromSourcePath(sourcePath);
  if (decisionId === null || !isDecisionSourcePath(sourcePath)) {
    throw new Error("invalid decision source path: " + sourcePath);
  }
  return {
    file,
    source: {
      decisionId,
      sourcePath,
      text: decodeUtf8(file.data, sourcePath)
    }
  };
}

async function buildDecisionIndexText(
  sources: readonly DecisionSource[],
  indexRelativePath: string
): Promise<string> {
  const establishedSources = await selectEstablishedSources(sources);
  if (establishedSources.length === 0) {
    throw new Error("selected source contains no established decision");
  }
  const snapshot =
    await buildDecisionStateSnapshotFromSources(establishedSources);
  const built = await buildDecisionIndexFromSnapshot(snapshot);
  if (built.status === "error") {
    throw new Error(
      decisionIndexDiagnosticMessages(
        built.diagnostics,
        indexRelativePath
      ).join("; ")
    );
  }
  const indexText = serializeDecisionIndex(built.value);
  const parsed = parseDecisionIndex(indexText, indexRelativePath);
  if (parsed.status === "error") {
    throw new Error(
      decisionIndexDiagnosticMessages(
        parsed.diagnostics,
        indexRelativePath
      ).join("; ")
    );
  }
  if (
    !isDeepStrictEqual(parsed.value.sourceRevision, snapshot.sourceRevision) ||
    !sameIds(
      Object.keys(parsed.value.entries),
      establishedSources.map((source) => source.decisionId)
    )
  ) {
    throw new Error(
      "generated index does not match the complete selected decision source"
    );
  }
  return indexText;
}

async function selectEstablishedSources(
  sources: readonly DecisionSource[]
): Promise<DecisionSource[]> {
  const decisionIds = new Set(sources.map((source) => source.decisionId));
  const established: DecisionSource[] = [];
  for (const source of sources) {
    const errors: string[] = [];
    const document = await validateDecisionBody({
      body: source.text,
      decisionId: source.decisionId,
      errors,
      sourcePath: source.sourcePath,
      targetExists: (targetId) => decisionIds.has(targetId)
    });
    if (document === null || errors.length > 0) {
      throw new Error(errors.join("; ") || source.sourcePath + " is invalid");
    }
    if (document.status !== "candidate") {
      established.push(source);
    }
  }
  return established;
}

function validateSelectedIds(
  decisionIds: readonly string[]
): DecisionApplicationFailure | { status: "ok"; value: DecisionId[] } {
  const errors: string[] = [];
  const values: DecisionId[] = [];
  const seen = new Set<DecisionId>();
  if (decisionIds.length === 0) {
    errors.push("stage requires at least one Decision ID");
  }
  for (const decisionId of decisionIds) {
    if (!isDecisionId(decisionId)) {
      errors.push("Decision ID must be a Markdown basename: " + decisionId);
      continue;
    }
    if (seen.has(decisionId)) {
      errors.push("Decision ID must not be repeated: " + decisionId);
      continue;
    }
    seen.add(decisionId);
    values.push(decisionId);
  }
  return errors.length === 0
    ? { status: "ok", value: values }
    : stageInputFailure(errors, 2);
}

function stageInputFailure(
  errors: readonly string[],
  exitCode: 1 | 2 = 1
): DecisionApplicationFailure {
  return decisionFailure(
    errors.map((reason) =>
      decisionDiagnostic({
        code: "decision-records.stage-input-invalid",
        reason,
        recovery:
          "Correct the selected Decision IDs or source state, then retry staging.",
        target: "Decision stage input"
      })
    ),
    { exitCode }
  );
}

function decisionRepositoryScope(
  repositoryRoot: string,
  decisionsDirectory: string
): string | null {
  const relativePath = path.relative(repositoryRoot, decisionsDirectory);
  if (
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath === ".." ||
    relativePath.startsWith(".." + path.sep)
  ) {
    return null;
  }
  return relativePath.split(path.sep).join("/");
}

function repositoryPath(scope: string, relativePath: string): string {
  return path.posix.join(scope, relativePath);
}

function decisionRelativePath(
  scope: string,
  repositoryFilePath: string
): string {
  const prefix = scope + "/";
  if (!repositoryFilePath.startsWith(prefix)) {
    throw new Error(
      `version-controlled path is outside the decision scope: ${repositoryFilePath}`
    );
  }
  return repositoryFilePath.slice(prefix.length);
}

function decodeUtf8(data: Uint8Array, displayPath: string): string {
  try {
    return utf8Decoder.decode(data);
  } catch (error) {
    throw new Error(`${displayPath} must contain valid UTF-8`, {
      cause: error
    });
  }
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  const orderedLeft = [...left].sort(compareText);
  const orderedRight = [...right].sort(compareText);
  return (
    orderedLeft.length === orderedRight.length &&
    orderedLeft.every((entry, index) => entry === orderedRight[index])
  );
}

function compareVersionControlFiles(
  left: VersionControlFile,
  right: VersionControlFile
): number {
  return compareText(left.path, right.path);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function versionControlFailure(
  action: string,
  error: unknown
): DecisionApplicationFailure {
  return decisionVersionControlFailure(
    {
      action,
      outcome:
        error instanceof VersionControlError &&
        error.code === "pending-recovery-failed"
          ? "partial-or-unknown"
          : "no-change",
      scope: "Pending decision snapshot",
      target: "Pending decision snapshot"
    },
    error
  );
}

class DecisionStageInputError extends Error {}

class DecisionStageFileSystemError extends Error {
  constructor(cause: unknown) {
    super("Decision Stage filesystem operation failed", { cause });
    this.name = "DecisionStageFileSystemError";
  }
}

async function readStageDirectory(directory: string) {
  try {
    return await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    throw new DecisionStageFileSystemError(error);
  }
}

async function readStageFile(filePath: string): Promise<Buffer> {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    throw new DecisionStageFileSystemError(error);
  }
}

function stageFileSystemFailure(
  reason: string,
  error: unknown
): DecisionApplicationFailure {
  const detail = operationErrorDetail(error);
  const causeCategory =
    isFileSystemError(error, "EACCES") || isFileSystemError(error, "EPERM")
      ? "access-denied"
      : "unknown";
  return decisionFailure([
    decisionDiagnostic({
      causeCategory,
      code: "decision-records.stage-filesystem-unavailable",
      ...(detail === null ? {} : { detail }),
      reason,
      recovery:
        causeCategory === "access-denied"
          ? "Grant the current process filesystem access to the decision collection, then retry staging."
          : "Inspect the selected decision filesystem sources, then retry staging.",
      target: "Decision stage filesystem sources"
    })
  ]);
}

function stageDomainFailure(
  code: string,
  reason: string,
  target: string,
  error: unknown
): DecisionApplicationFailure {
  const detail = operationErrorDetail(error);
  return decisionFailure([
    decisionDiagnostic({
      code,
      ...(detail === null ? {} : { detail }),
      reason,
      recovery:
        "Correct the selected Decision IDs or Decision source state, then retry staging.",
      target
    })
  ]);
}
