import { Buffer } from "node:buffer";
import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  openVersionControl,
  type RevisionId,
  type VersionControlFile,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  buildDecisionIndexFromSnapshot,
  buildDecisionStateSnapshotFromSources,
  decisionIndexDiagnosticMessages,
  decisionIndexFileName,
  parseDecisionIndex,
  serializeDecisionIndex,
  type DecisionSource
} from "./decision-state-index.ts";
import {
  decisionIdFromSourcePath,
  displayDecisionPath,
  isDecisionId
} from "./decision-path.ts";
import { validateDecisionBody } from "./record.ts";
import {
  resolveDecisionLocation,
  type DecisionLocation
} from "./decision-query-context.ts";

const revisionReadConcurrency = 32;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

export type DecisionStageSuccess = {
  command: "stage";
  indexRelativePath: string;
  pendingFileCount: number;
  selectedIds: string[];
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
    return versionControlFailure("open the version-controlled decision workspace", error);
  }
  const decisionScope = decisionRepositoryScope(
    repository.rootDirectory,
    location.decisionsDirectory
  );
  if (decisionScope === null) {
    return decisionFailure([
      "Decision directory must be inside, and below the root of, its version-controlled "
        + "repository: " + location.decisionsDirectory
    ]);
  }
  let expectedPendingFiles: VersionControlFile[];
  let pendingRevision: RevisionId | null;
  try {
    pendingRevision = await repository.getCurrentRevision();
    expectedPendingFiles = await repository.readPendingFiles({
      pathScopes: [decisionScope]
    });
    const existingPending = pendingRevision === null
      ? []
      : await repository.listPendingChangedPaths({
        from: pendingRevision,
        pathScopes: [decisionScope]
      });
    if (existingPending.length > 0 || (
      pendingRevision === null && expectedPendingFiles.length > 0
    )) {
      return decisionFailure([
        "Decision pending snapshot already contains files in "
          + decisionScope
          + "; inspect or resolve it before staging another decision set."
      ]);
    }
  } catch (error) {
    return versionControlFailure("inspect the pending decision snapshot", error);
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
      return decisionFailure([error.message], { exitCode: 2 });
    }
    return decisionFailure([
      "Failed to construct the selected decision snapshot: " + errorText(error)
    ]);
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
    return decisionFailure([
      "Selected decision snapshot is invalid: " + errorText(error)
    ]);
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
    return decisionFailure([
      "Selected decision filesystem source changed before staging: " + errorText(error)
    ]);
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
    return versionControlFailure("replace the pending decision snapshot", error);
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
  decisionId: string;
  source: DecisionStageSource | null;
};

async function buildDecisionStageTarget(options: {
  decisionsDirectory: string;
  decisionScope: string;
  repository: VersionControlRepository;
  revision: RevisionId | null;
  selectedIds: readonly string[];
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
          "Selected Decision ID does not exist in the filesystem: "
            + selectedSource.decisionId
        );
      }
    }
    for (const source of filesystem.values()) {
      sourceById.set(source.source.decisionId, source);
    }
  } else {
    selectedSources = await Promise.all(options.selectedIds.map(async (decisionId) => ({
      decisionId,
      source: await readFilesystemDecisionSource(
        options.decisionsDirectory,
        options.decisionScope,
        decisionId
      )
    })));
    for (const selectedSource of selectedSources) {
      if (selectedSource.source === null && !sourceById.has(selectedSource.decisionId)) {
        throw new DecisionStageInputError(
          "Selected Decision ID does not exist in the revision or filesystem: "
            + selectedSource.decisionId
        );
      }
      if (selectedSource.source === null) {
        sourceById.delete(selectedSource.decisionId);
      } else {
        sourceById.set(selectedSource.decisionId, selectedSource.source);
      }
    }
  }
  const sources = [...sourceById.values()]
    .sort((left, right) => compareText(left.source.decisionId, right.source.decisionId));
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
    const sourcePath = decisionRelativePath(options.decisionScope, repositoryFilePath);
    if (sourcePath === decisionIndexFileName) {
      continue;
    }
    if (decisionIdFromSourcePath(sourcePath) === null) {
      throw new Error("revision decision scope contains unsupported file: " + sourcePath);
    }
    sourcePaths.push(repositoryFilePath);
  }
  const files = await readRevisionFiles(options.repository, options.revision, sourcePaths);
  return files.map((file) => stageSourceFromFile(
    file,
    decisionRelativePath(options.decisionScope, file.path)
  ));
}

async function readFilesystemDecisionSources(
  decisionsDirectory: string,
  decisionScope: string
): Promise<Map<string, DecisionStageSource>> {
  const sources = new Map<string, DecisionStageSource>();
  const addSource = async (sourcePath: string): Promise<void> => {
    const decisionId = decisionIdFromSourcePath(sourcePath);
    if (decisionId === null) {
      throw new Error("filesystem decision scope contains unsupported file: " + sourcePath);
    }
    if (sources.has(decisionId)) {
      throw new Error("Decision ID occurs in more than one filesystem source path: " + decisionId);
    }
    const data = await fs.readFile(
      path.join(decisionsDirectory, ...sourcePath.split("/"))
    );
    sources.set(decisionId, stageSourceFromFile({
      data,
      path: repositoryPath(decisionScope, sourcePath)
    }, sourcePath));
  };
  const rootEntries = await fs.readdir(decisionsDirectory, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      await addSource(entry.name);
    } else if (entry.isDirectory() && entry.name === "archive") {
      const archivedEntries = await fs.readdir(
        path.join(decisionsDirectory, "archive"),
        { withFileTypes: true }
      );
      for (const archivedEntry of archivedEntries) {
        if (!archivedEntry.isFile() || !archivedEntry.name.endsWith(".md")) {
          throw new Error("filesystem archive contains unsupported entry: " + archivedEntry.name);
        }
        await addSource("archive/" + archivedEntry.name);
      }
    } else if (entry.name !== decisionIndexFileName) {
      throw new Error("filesystem decision scope contains unsupported entry: " + entry.name);
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
      selectedSource.source === null
      || current === null
      || selectedSource.source.source.sourcePath !== current.source.sourcePath
      || !Buffer.from(selectedSource.source.file.data).equals(Buffer.from(current.file.data))
    ) {
      throw new Error(selectedSource.decisionId);
    }
  }
}

async function readFilesystemDecisionSource(
  decisionsDirectory: string,
  decisionScope: string,
  decisionId: string
): Promise<DecisionStageSource | null> {
  const sourcePaths = [decisionId, "archive/" + decisionId];
  const sources: DecisionStageSource[] = [];
  for (const sourcePath of sourcePaths) {
    const filesystemPath = path.join(decisionsDirectory, ...sourcePath.split("/"));
    let entry;
    try {
      entry = await fs.lstat(filesystemPath);
    } catch (error) {
      if (isMissingFileError(error)) {
        continue;
      }
      throw error;
    }
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error("Decision source must be a regular non-symlink file: " + sourcePath);
    }
    const data = await fs.readFile(filesystemPath);
    sources.push(stageSourceFromFile({
      data,
      path: repositoryPath(decisionScope, sourcePath)
    }, sourcePath));
  }
  if (sources.length > 1) {
    throw new Error("Decision ID occurs in more than one filesystem source path: " + decisionId);
  }
  return sources[0] ?? null;
}

function stageSourceFromFile(
  file: VersionControlFile,
  sourcePath: string
): DecisionStageSource {
  const decisionId = decisionIdFromSourcePath(sourcePath);
  if (decisionId === null) {
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

async function readRevisionFiles(
  repository: VersionControlRepository,
  revision: RevisionId,
  filePaths: readonly string[]
): Promise<VersionControlFile[]> {
  const files: VersionControlFile[] = [];
  for (
    let offset = 0;
    offset < filePaths.length;
    offset += revisionReadConcurrency
  ) {
    const batch = filePaths.slice(offset, offset + revisionReadConcurrency);
    files.push(...await Promise.all(batch.map(async (filePath) => {
      const file = await repository.readRevisionFile(revision, filePath);
      if (file === null) {
        throw new Error("revision file disappeared while reading: " + filePath);
      }
      return file;
    })));
  }
  return files.sort(compareVersionControlFiles);
}

async function buildDecisionIndexText(
  sources: readonly DecisionSource[],
  indexRelativePath: string
): Promise<string> {
  const establishedSources = await selectEstablishedSources(sources);
  if (establishedSources.length === 0) {
    throw new Error("selected source contains no established decision");
  }
  const snapshot = await buildDecisionStateSnapshotFromSources(establishedSources);
  const built = await buildDecisionIndexFromSnapshot(snapshot);
  if (built.status === "error") {
    throw new Error(decisionIndexDiagnosticMessages(
      built.diagnostics,
      indexRelativePath
    ).join("; "));
  }
  const indexText = serializeDecisionIndex(built.value);
  const parsed = parseDecisionIndex(indexText, indexRelativePath);
  if (parsed.status === "error") {
    throw new Error(decisionIndexDiagnosticMessages(
      parsed.diagnostics,
      indexRelativePath
    ).join("; "));
  }
  if (
    !isDeepStrictEqual(parsed.value.sourceRevision, snapshot.sourceRevision)
    || !sameIds(
      Object.keys(parsed.value.entries),
      establishedSources.map((source) => source.decisionId)
    )
  ) {
    throw new Error("generated index does not match the complete selected decision source");
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
): DecisionApplicationFailure | { status: "ok"; value: string[] } {
  const errors: string[] = [];
  const values: string[] = [];
  const seen = new Set<string>();
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
    : decisionFailure(errors, { exitCode: 2 });
}

function decisionRepositoryScope(
  repositoryRoot: string,
  decisionsDirectory: string
): string | null {
  const relativePath = path.relative(repositoryRoot, decisionsDirectory);
  if (
    relativePath.length === 0
    || path.isAbsolute(relativePath)
    || relativePath === ".."
    || relativePath.startsWith(".." + path.sep)
  ) {
    return null;
  }
  return relativePath.split(path.sep).join("/");
}

function repositoryPath(scope: string, relativePath: string): string {
  return path.posix.join(scope, relativePath);
}

function decisionRelativePath(scope: string, repositoryFilePath: string): string {
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
    throw new Error(`${displayPath} must contain valid UTF-8`, { cause: error });
  }
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  const orderedLeft = [...left].sort(compareText);
  const orderedRight = [...right].sort(compareText);
  return orderedLeft.length === orderedRight.length
    && orderedLeft.every((entry, index) => entry === orderedRight[index]);
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
  return decisionFailure([
    `Failed to ${action}: ${errorText(error)}`
  ]);
}

class DecisionStageInputError extends Error {}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
