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
  decisionDomainCatalogFileName,
  parseDecisionDomainCatalog,
  type DecisionDomainCatalog
} from "./decision-domain-catalog.ts";
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
  displayDecisionPath,
  isDecisionRelativePath
} from "./decision-path.ts";
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
  selectedPaths: string[];
  status: "ok";
};

export type DecisionStageResult =
  | DecisionApplicationFailure
  | DecisionStageSuccess;

export async function stageDecisionRecords(options: {
  location: DecisionLocation;
  recordPaths: readonly string[];
}): Promise<DecisionStageResult> {
  const selectedPaths = validateSelectedPaths(options.recordPaths);
  if (selectedPaths.status === "error") {
    return selectedPaths;
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

  let target: DecisionStageTarget;
  try {
    target = await buildDecisionStageTarget({
      decisionsDirectory: location.decisionsDirectory,
      decisionScope,
      repository,
      selectedPaths: selectedPaths.value
    });
  } catch (error) {
    if (error instanceof DecisionStageInputError) {
      return decisionFailure([error.message], { exitCode: 2 });
    }
    return decisionFailure([
      "Failed to construct the selected decision snapshot: " + errorText(error)
    ]);
  }

  let catalogText: string;
  try {
    catalogText = decodeUtf8(target.catalog.data, decisionDomainCatalogFileName);
  } catch (error) {
    return decisionFailure([errorText(error)]);
  }
  const parsedCatalog = parseDecisionDomainCatalog(
    catalogText,
    decisionDomainCatalogFileName
  );
  if (parsedCatalog.status === "error") {
    return decisionFailure(parsedCatalog.errors);
  }
  if (target.sources.length === 0) {
    return decisionFailure([
      "Selected decision paths must produce at least one established decision"
    ]);
  }

  const indexPath = repositoryPath(decisionScope, decisionIndexFileName);
  const indexRelativePath = displayDecisionPath(
    location.workspaceRoot,
    path.join(location.decisionsDirectory, decisionIndexFileName)
  );
  let indexText: string;
  try {
    indexText = await buildDecisionIndexText(
      parsedCatalog.value,
      target.sources,
      indexRelativePath
    );
  } catch (error) {
    return decisionFailure([
      "Selected decision snapshot is invalid: " + errorText(error)
    ]);
  }

  const files = [
    target.catalog,
    ...target.sourceFiles,
    { data: Buffer.from(indexText, "utf8"), path: indexPath }
  ].sort(compareVersionControlFiles);
  let pendingFileCount: number;
  try {
    const replaced = await repository.replacePendingFiles({
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
    selectedPaths: selectedPaths.value,
    status: "ok"
  };
}

type DecisionStageTarget = {
  catalog: VersionControlFile;
  revision: RevisionId | null;
  sourceFiles: VersionControlFile[];
  sources: DecisionSource[];
};

async function buildDecisionStageTarget(options: {
  decisionsDirectory: string;
  decisionScope: string;
  repository: VersionControlRepository;
  selectedPaths: readonly string[];
}): Promise<DecisionStageTarget> {
  const revision = await options.repository.getCurrentRevision();
  const baseline = await readDecisionBaseline({
    decisionsDirectory: options.decisionsDirectory,
    decisionScope: options.decisionScope,
    repository: options.repository,
    revision
  });
  const sourceFiles = new Map(
    baseline.sourceFiles.map((file) => [decisionRelativePath(
      options.decisionScope,
      file.path
    ), file])
  );

  for (const selectedPath of options.selectedPaths) {
    const repositoryFilePath = repositoryPath(options.decisionScope, selectedPath);
    const filesystemPath = path.join(
      options.decisionsDirectory,
      ...selectedPath.split("/")
    );
    let data: Uint8Array;
    try {
      data = await fs.readFile(filesystemPath);
    } catch (error) {
      if (isMissingFileError(error)) {
        if (!sourceFiles.delete(selectedPath)) {
          throw new DecisionStageInputError(
            "Selected decision does not exist in the revision or filesystem: "
              + selectedPath
          );
        }
        continue;
      }
      throw new Error(
        `failed to read selected decision ${selectedPath}: ${errorText(error)}`,
        { cause: error }
      );
    }
    sourceFiles.set(selectedPath, { data, path: repositoryFilePath });
  }

  const orderedFiles = [...sourceFiles.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, file]) => file);
  return {
    catalog: baseline.catalog,
    revision,
    sourceFiles: orderedFiles,
    sources: orderedFiles.map((file) => {
      const relativePath = decisionRelativePath(options.decisionScope, file.path);
      return {
        path: relativePath,
        text: decodeUtf8(file.data, relativePath)
      };
    })
  };
}

async function readDecisionBaseline(options: {
  decisionsDirectory: string;
  decisionScope: string;
  repository: VersionControlRepository;
  revision: RevisionId | null;
}): Promise<{
  catalog: VersionControlFile;
  sourceFiles: VersionControlFile[];
}> {
  const catalogPath = repositoryPath(
    options.decisionScope,
    decisionDomainCatalogFileName
  );
  if (options.revision === null) {
    return {
      catalog: await readFilesystemCatalog(options.decisionsDirectory, catalogPath),
      sourceFiles: []
    };
  }

  const revisionPaths = await options.repository.listRevisionFiles(
    options.revision,
    { pathScopes: [options.decisionScope] }
  );
  if (revisionPaths.length === 0) {
    return {
      catalog: await readFilesystemCatalog(options.decisionsDirectory, catalogPath),
      sourceFiles: []
    };
  }

  const allowedPaths: string[] = [];
  for (const repositoryFilePath of revisionPaths) {
    const relativePath = decisionRelativePath(
      options.decisionScope,
      repositoryFilePath
    );
    if (
      relativePath === decisionDomainCatalogFileName
      || relativePath === decisionIndexFileName
      || isDecisionRelativePath(relativePath)
    ) {
      allowedPaths.push(repositoryFilePath);
      continue;
    }
    throw new Error(
      "revision decision scope contains unsupported file: " + relativePath
    );
  }
  if (!allowedPaths.includes(catalogPath)) {
    throw new Error(
      "revision decision scope is missing " + decisionDomainCatalogFileName
    );
  }

  const files = await readRevisionFiles(
    options.repository,
    options.revision,
    allowedPaths.filter((filePath) => (
      filePath !== repositoryPath(options.decisionScope, decisionIndexFileName)
    ))
  );
  const catalog = files.find((file) => file.path === catalogPath);
  if (catalog === undefined) {
    throw new Error(
      "revision decision scope is missing " + decisionDomainCatalogFileName
    );
  }
  return {
    catalog,
    sourceFiles: files.filter((file) => file.path !== catalogPath)
  };
}

async function readFilesystemCatalog(
  decisionsDirectory: string,
  repositoryFilePath: string
): Promise<VersionControlFile> {
  const catalogPath = path.join(
    decisionsDirectory,
    decisionDomainCatalogFileName
  );
  try {
    return {
      data: await fs.readFile(catalogPath),
      path: repositoryFilePath
    };
  } catch (error) {
    throw new Error(
      `${decisionDomainCatalogFileName} could not be read: ${errorText(error)}`,
      { cause: error }
    );
  }
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
  catalog: DecisionDomainCatalog,
  sources: readonly DecisionSource[],
  indexRelativePath: string
): Promise<string> {
  const snapshot = await buildDecisionStateSnapshotFromSources(catalog, sources);
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
    || !samePaths(
      Object.keys(parsed.value.entries),
      sources.map((source) => source.path)
    )
  ) {
    throw new Error(
      "generated index does not match the complete selected decision source"
    );
  }
  return indexText;
}

function validateSelectedPaths(
  recordPaths: readonly string[]
):
  | DecisionApplicationFailure
  | { status: "ok"; value: string[] } {
  const errors: string[] = [];
  const selectedPaths: string[] = [];
  const seen = new Set<string>();
  if (recordPaths.length === 0) {
    errors.push("stage requires at least one decision path");
  }
  for (const recordPath of recordPaths) {
    if (!isDecisionRelativePath(recordPath)) {
      errors.push(
        "Decision path must be a decision-root-relative POSIX Markdown path: "
          + recordPath
      );
      continue;
    }
    if (seen.has(recordPath)) {
      errors.push("Decision path must not be repeated: " + recordPath);
      continue;
    }
    seen.add(recordPath);
    selectedPaths.push(recordPath);
  }
  return errors.length === 0
    ? { status: "ok", value: selectedPaths }
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

function samePaths(left: readonly string[], right: readonly string[]): boolean {
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
