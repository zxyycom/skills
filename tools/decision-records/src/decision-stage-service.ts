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
  decisionNameFromId,
  displayDecisionPath,
  isDecisionId,
  isDecisionSourcePath,
  normalizeDecisionSelectorInput,
  parseDatedDecisionId
} from "./decision-path.ts";
import { decisionIdFromMarkdown } from "./decision-metadata.ts";
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
type FilesystemDecisionCandidates = Readonly<{
  duplicateIds: ReadonlySet<DecisionId>;
  sources: ReadonlyMap<DecisionId, DecisionStageSource>;
}>;

type StageStep<T> = DecisionApplicationFailure | { status: "ok"; value: T };
type StageRepositoryContext = Readonly<{
  decisionScope: string;
  repository: VersionControlRepository;
}>;
type PendingDecisionSnapshot = Readonly<{
  expectedFiles: VersionControlFile[];
  revision: RevisionId | null;
}>;
type DecisionStageFiles = Readonly<{
  files: VersionControlFile[];
  indexRelativePath: string;
}>;

export async function stageDecisionRecords(options: {
  decisionIds: readonly string[];
  location: DecisionLocation;
}): Promise<DecisionStageResult> {
  const selectedSelectors = validateSelectedSelectors(options.decisionIds);
  if (selectedSelectors.status === "error") {
    return selectedSelectors;
  }
  const location = resolveDecisionLocation(options.location);
  const opened = await openStageRepository(location.decisionsDirectory);
  if (opened.status === "error") return opened;
  const { decisionScope, repository } = opened.value;

  const pending = await inspectPendingDecisionSnapshot(
    repository,
    decisionScope
  );
  if (pending.status === "error") return pending;

  const targetResult = await constructDecisionStageTarget({
    decisionsDirectory: location.decisionsDirectory,
    decisionScope,
    repository,
    revision: pending.value.revision,
    selectedSelectors: selectedSelectors.value
  });
  if (targetResult.status === "error") return targetResult;
  const target = targetResult.value;
  if (target.sources.length === 0) {
    return decisionFailure([
      "Selected Decision IDs must produce at least one established decision"
    ]);
  }

  const stagedFiles = await prepareDecisionStageFiles(
    location,
    decisionScope,
    repository,
    target
  );
  if (stagedFiles.status === "error") return stagedFiles;
  const replaced = await replacePendingDecisionFiles(
    repository,
    decisionScope,
    pending.value.expectedFiles,
    target.revision,
    stagedFiles.value.files
  );
  if (replaced.status === "error") return replaced;
  return {
    command: "stage",
    indexRelativePath: stagedFiles.value.indexRelativePath,
    pendingFileCount: replaced.value,
    selectedIds: target.selectedIds,
    status: "ok"
  };
}

async function openStageRepository(
  decisionsDirectory: string
): Promise<StageStep<StageRepositoryContext>> {
  let repository: VersionControlRepository;
  try {
    repository = await openVersionControl(decisionsDirectory);
  } catch (error) {
    return versionControlFailure(
      "open the version-controlled decision workspace",
      error
    );
  }
  const decisionScope = decisionRepositoryScope(
    repository.rootDirectory,
    decisionsDirectory
  );
  if (decisionScope === null) {
    return decisionFailure([
      "Decision directory must be inside, and below the root of, its version-controlled " +
        "repository: " +
        decisionsDirectory
    ]);
  }
  return { status: "ok", value: { decisionScope, repository } };
}

async function inspectPendingDecisionSnapshot(
  repository: VersionControlRepository,
  decisionScope: string
): Promise<StageStep<PendingDecisionSnapshot>> {
  try {
    const revision = await repository.getCurrentRevision();
    const expectedFiles = await repository.readPendingFiles({
      pathScopes: [decisionScope]
    });
    const existingPending =
      revision === null
        ? []
        : await repository.listPendingChangedPaths({
            from: revision,
            pathScopes: [decisionScope]
          });
    if (
      existingPending.length > 0 ||
      (revision === null && expectedFiles.length > 0)
    ) {
      return decisionFailure([
        "Decision pending snapshot already contains files in " +
          decisionScope +
          "; inspect or resolve it before staging another decision set."
      ]);
    }
    return { status: "ok", value: { expectedFiles, revision } };
  } catch (error) {
    return versionControlFailure(
      "inspect the pending decision snapshot",
      error
    );
  }
}

async function constructDecisionStageTarget(
  options: Parameters<typeof buildDecisionStageTarget>[0]
): Promise<StageStep<DecisionStageTarget>> {
  try {
    return { status: "ok", value: await buildDecisionStageTarget(options) };
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
}

async function prepareDecisionStageFiles(
  location: ReturnType<typeof resolveDecisionLocation>,
  decisionScope: string,
  repository: VersionControlRepository,
  target: DecisionStageTarget
): Promise<StageStep<DecisionStageFiles>> {
  const indexPath = repositoryPath(decisionScope, decisionIndexFileName);
  const indexRelativePath = displayDecisionPath(
    location.workspaceRoot,
    path.join(location.decisionsDirectory, decisionIndexFileName)
  );
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
  return { status: "ok", value: { files, indexRelativePath } };
}

async function replacePendingDecisionFiles(
  repository: VersionControlRepository,
  decisionScope: string,
  expectedFiles: readonly VersionControlFile[],
  revision: RevisionId | null,
  files: readonly VersionControlFile[]
): Promise<StageStep<number>> {
  try {
    const replaced = await repository.replacePendingFiles({
      expectedFiles,
      expectedRevision: revision,
      files,
      pathScope: decisionScope
    });
    return { status: "ok", value: replaced.pendingPaths.length };
  } catch (error) {
    return versionControlFailure(
      "replace the pending decision snapshot",
      error
    );
  }
}

type DecisionStageTarget = {
  revision: RevisionId | null;
  selectedIds: DecisionId[];
  selectedSources: SelectedFilesystemSource[];
  sourceFiles: VersionControlFile[];
  sources: DecisionSource[];
};

type SelectedFilesystemSource = {
  decisionId: DecisionId;
  source: DecisionStageSource | null;
};

type DecisionStageTargetOptions = Readonly<{
  decisionsDirectory: string;
  decisionScope: string;
  repository: VersionControlRepository;
  revision: RevisionId | null;
  selectedSelectors: readonly string[];
}>;

async function buildDecisionStageTarget(
  options: DecisionStageTargetOptions
): Promise<DecisionStageTarget> {
  const baseline = await readDecisionBaseline({
    decisionsDirectory: options.decisionsDirectory,
    decisionScope: options.decisionScope,
    repository: options.repository,
    revision: options.revision
  });
  const filesystemCandidates = await readFilesystemDecisionCandidates(
    options.decisionsDirectory,
    options.decisionScope
  );
  const selectedIds = resolveSelectedDecisionIds(
    options.selectedSelectors,
    baseline,
    filesystemCandidates
  );
  const selectedOptions = { ...options, selectedIds };
  const sourceById = new Map(
    baseline.map((source) => [source.source.decisionId, source])
  );
  const selectedSources =
    options.revision === null || baseline.length === 0
      ? await mergeFilesystemDecisionSources(
          selectedOptions,
          sourceById,
          filesystemCandidates
        )
      : await mergeSelectedDecisionSources(
          selectedOptions,
          sourceById,
          filesystemCandidates
        );
  const sources = [...sourceById.values()].sort((left, right) =>
    compareText(left.source.decisionId, right.source.decisionId)
  );
  return {
    revision: options.revision,
    selectedIds,
    selectedSources,
    sourceFiles: sources.map((source) => source.file),
    sources: sources.map((source) => source.source)
  };
}

async function mergeFilesystemDecisionSources(
  options: Omit<DecisionStageTargetOptions, "selectedSelectors"> & {
    selectedIds: readonly DecisionId[];
  },
  sourceById: Map<DecisionId, DecisionStageSource>,
  filesystem: FilesystemDecisionCandidates
): Promise<SelectedFilesystemSource[]> {
  const selectedSources = options.selectedIds.map((decisionId) => ({
    decisionId,
    source: filesystem.sources.get(decisionId) ?? null
  }));
  for (const selectedSource of selectedSources) {
    if (filesystem.duplicateIds.has(selectedSource.decisionId)) {
      throw duplicateFilesystemDecisionIdError(selectedSource.decisionId);
    }
    if (selectedSource.source === null) {
      throw new DecisionStageInputError(
        "Selected Decision ID does not exist in the filesystem: " +
          selectedSource.decisionId
      );
    }
  }
  for (const selectedSource of selectedSources) {
    if (selectedSource.source !== null) {
      sourceById.set(
        selectedSource.source.source.decisionId,
        selectedSource.source
      );
    }
  }
  return selectedSources;
}

async function mergeSelectedDecisionSources(
  options: Omit<DecisionStageTargetOptions, "selectedSelectors"> & {
    selectedIds: readonly DecisionId[];
  },
  sourceById: Map<DecisionId, DecisionStageSource>,
  filesystem: FilesystemDecisionCandidates
): Promise<SelectedFilesystemSource[]> {
  const selectedSources = await Promise.all(
    options.selectedIds.map(async (decisionId) => {
      if (filesystem.duplicateIds.has(decisionId)) {
        throw duplicateFilesystemDecisionIdError(decisionId);
      }
      const current = filesystem.sources.get(decisionId);
      if (current !== undefined) return { decisionId, source: current };
      const baselineSource = sourceById.get(decisionId);
      return {
        decisionId,
        source:
          baselineSource === undefined
            ? null
            : await readFilesystemDecisionSource(
                options.decisionsDirectory,
                options.decisionScope,
                decisionId,
                baselineSource.source.sourcePath
              )
      };
    })
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
  return selectedSources;
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
    if (!isDecisionSourcePath(sourcePath)) {
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

/**
 * Discovers only recognizable current Decision identities for selector
 * resolution. It deliberately ignores unrelated or malformed files: selected
 * sources are read and verified again by the staging transaction below.
 */
async function readFilesystemDecisionCandidates(
  decisionsDirectory: string,
  decisionScope: string
): Promise<FilesystemDecisionCandidates> {
  const sources = new Map<DecisionId, DecisionStageSource>();
  const duplicateIds = new Set<DecisionId>();
  const addSource = async (sourcePath: string): Promise<void> => {
    try {
      const data = await readStageFile(
        path.join(decisionsDirectory, ...sourcePath.split("/"))
      );
      const source = stageSourceFromFile(
        {
          data,
          path: repositoryPath(decisionScope, sourcePath)
        },
        sourcePath
      );
      if (sources.has(source.source.decisionId)) {
        duplicateIds.add(source.source.decisionId);
      } else {
        sources.set(source.source.decisionId, source);
      }
    } catch {
      // A malformed unselected file is not part of this stage transaction.
    }
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
        if (archivedEntry.isFile() && archivedEntry.name.endsWith(".md")) {
          await addSource("archive/" + archivedEntry.name);
        }
      }
    }
  }
  return { duplicateIds, sources };
}

function resolveSelectedDecisionIds(
  selectors: readonly string[],
  baseline: readonly DecisionStageSource[],
  filesystem: FilesystemDecisionCandidates
): DecisionId[] {
  const candidateIds = new Set<DecisionId>([
    ...baseline.map((source) => source.source.decisionId),
    ...filesystem.sources.keys()
  ]);
  const resolved: DecisionId[] = [];
  const seen = new Set<DecisionId>();
  for (const selector of selectors) {
    const parsed = parseDatedDecisionId(selector);
    const decisionId =
      parsed === null
        ? resolveDecisionNameSelector(selector, candidateIds)
        : parsed.id;
    if (seen.has(decisionId)) {
      throw new DecisionStageInputError(
        "Selected Decision selector resolves to a repeated Decision ID: " +
          decisionId
      );
    }
    seen.add(decisionId);
    resolved.push(decisionId);
  }
  return resolved;
}

function duplicateFilesystemDecisionIdError(decisionId: DecisionId): Error {
  return new Error(
    "Decision ID occurs in more than one filesystem source path: " + decisionId
  );
}

function resolveDecisionNameSelector(
  name: string,
  candidateIds: ReadonlySet<DecisionId>
): DecisionId {
  const matches = [...candidateIds]
    .filter((decisionId) => decisionNameFromId(decisionId) === name)
    .sort(compareText);
  if (matches.length === 0) {
    throw new DecisionStageInputError(
      "Selected Decision name does not exist in the revision or filesystem: " +
        name
    );
  }
  if (matches.length > 1) {
    throw new DecisionStageInputError(
      "Selected Decision name is ambiguous: " +
        name +
        " (" +
        matches.join(", ") +
        ")"
    );
  }
  return matches[0]!;
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
      selectedSource.decisionId,
      selectedSource.source?.source.sourcePath
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
  decisionId: DecisionId,
  expectedSourcePath?: string
): Promise<DecisionStageSource | null> {
  const matches: DecisionStageSource[] = [];
  const inspect = async (
    sourcePath: string,
    entry: { isFile(): boolean; name: string }
  ): Promise<void> => {
    if (!isDecisionSourcePath(sourcePath)) return;
    const isKnownPath = sourcePath === expectedSourcePath;
    if (!entry.isFile()) {
      if (isKnownPath) {
        await readStageFile(
          path.join(decisionsDirectory, ...sourcePath.split("/"))
        );
      }
      return;
    }

    let data: Buffer;
    try {
      data = await readStageFile(
        path.join(decisionsDirectory, ...sourcePath.split("/"))
      );
    } catch (error) {
      if (isKnownPath) throw error;
      return;
    }
    let text: string;
    try {
      text = decodeUtf8(data, sourcePath);
    } catch (error) {
      if (isKnownPath) throw error;
      return;
    }
    const declaredId = decisionIdFromMarkdown(text);
    if (declaredId !== decisionId) {
      if (isKnownPath)
        throw new Error(
          `${sourcePath} no longer declares the selected Decision ID ${decisionId}`
        );
      return;
    }
    matches.push(
      stageSourceFromFile(
        { data, path: repositoryPath(decisionScope, sourcePath) },
        sourcePath
      )
    );
  };

  const rootEntries = await readStageDirectory(decisionsDirectory);
  for (const entry of rootEntries) {
    if (entry.name === decisionIndexFileName) continue;
    if (entry.name === "archive" && entry.isDirectory()) {
      const archiveEntries = await readStageDirectory(
        path.join(decisionsDirectory, "archive")
      );
      for (const archiveEntry of archiveEntries) {
        await inspect("archive/" + archiveEntry.name, archiveEntry);
      }
      continue;
    }
    await inspect(entry.name, entry);
  }
  if (matches.length > 1) {
    throw new Error(
      "Decision ID occurs in more than one filesystem source path: " +
        decisionId
    );
  }
  return matches[0] ?? null;
}

function stageSourceFromFile(
  file: VersionControlFile,
  sourcePath: string
): DecisionStageSource {
  if (!isDecisionSourcePath(sourcePath)) {
    throw new Error("invalid decision source path: " + sourcePath);
  }
  const text = decodeUtf8(file.data, sourcePath);
  const decisionId = decisionIdFromMarkdown(text);
  if (decisionId === null) {
    throw new Error(
      "decision source must declare a valid frontmatter Decision ID: " +
        sourcePath
    );
  }
  return {
    file,
    source: {
      decisionId,
      sourcePath,
      text
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

function validateSelectedSelectors(
  decisionIds: readonly string[]
): DecisionApplicationFailure | { status: "ok"; value: DecisionId[] } {
  const errors: string[] = [];
  const values: DecisionId[] = [];
  const seen = new Set<DecisionId>();
  if (decisionIds.length === 0) {
    errors.push("stage requires at least one Decision ID");
  }
  for (const value of decisionIds) {
    const decisionId = normalizeDecisionSelectorInput(value);
    if (!isDecisionId(decisionId)) {
      errors.push(
        "Decision selector must be extensionless kebab-case text: " + value
      );
      continue;
    }
    if (seen.has(decisionId)) {
      errors.push("Decision selector must not be repeated: " + decisionId);
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
    const entry = await fs.lstat(filePath);
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new Error(
        "Decision source must be a regular non-symlink file: " +
          path.basename(filePath)
      );
    }
    return await fs.readFile(filePath);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Decision source")) {
      throw error;
    }
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
