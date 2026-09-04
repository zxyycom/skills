import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import {
  constants as fileSystemConstants,
  type Dirent,
  type Stats
} from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  buildStateIndex,
  serializeStateIndex
} from "../../index-runtime/src/index.ts";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError
} from "../../shared/src/version-control/index.ts";
import { findCandidatePathForInvestigationId } from "./candidate-path.ts";
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
  inspectInvestigationCollectionLayout
} from "./investigation-index-source.ts";
import {
  parseInvestigationReport,
  replaceInvestigationReportIdentity
} from "./markdown.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexFileName,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import {
  canonicalizeInvestigationsDirectory,
  datedInvestigationIdForName,
  investigationNameFromId,
  isInvestigationId,
  parseDatedInvestigationId,
  resolveInvestigationsDirectory,
  utcInvestigationDate
} from "./report-path.ts";
import { validateInvestigationRelationGraph } from "./relation-validation.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import {
  investigationResourcesDirectoryName,
  isInvestigationResourceId
} from "./resource-reference.ts";
import { collectValidatedInvestigationCollection } from "./validation.ts";
import type {
  InvestigationIndexState,
  InvestigationSource,
  ParsedInvestigationReportDocument
} from "./types.ts";

export type InvestigationRenameOptions = Readonly<{
  investigationsDir?: string;
  preflight?: boolean;
  renameRecordedCandidate?: boolean;
  renameRecordedReport?: boolean;
  source: string;
  target: string;
  workspaceRoot: string;
}>;

export type InvestigationRenamePlan = Readonly<{
  affectedCandidateRelationCount: number;
  affectedEstablishedRelationCount: number;
  affectedResourceReferenceCount: number;
  newId: string;
  newName: string;
  newSourcePath: string;
  oldId: string;
  oldName: string;
  oldSourcePath: string;
  outcome: "preflight" | "ready";
  resourceOwnerMoved: boolean;
}>;

export type InvestigationRenameResult = Readonly<{
  changed: boolean;
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  indexPath: string;
  mutation?: InvestigationMutationDiagnostic;
  plan: InvestigationRenamePlan | null;
  status: "attention" | "error" | "ok";
}>;

export type InvestigationRenameWriter = (
  targetPath: string,
  text: string
) => Promise<void>;

export type InvestigationRenameHooks = Readonly<{
  beforePublish?: () => Promise<void>;
  beforeResourceMove?: () => Promise<void>;
  beforeSourceOwnerRemoval?: () => Promise<void>;
  writeExisting?: InvestigationRenameWriter;
  writeNew?: InvestigationRenameWriter;
}>;

type RenameSource = Readonly<{
  candidate: boolean;
  document: ParsedInvestigationReportDocument;
  filePath: string;
  id: string;
  sourcePath: string;
  text: string;
}>;

type ResourceOwnerSnapshot = Readonly<{
  directories: readonly ResourceDirectorySnapshot[];
  files: readonly ResourceFileSnapshot[];
  mode: number;
}>;

type ResourceDirectorySnapshot = Readonly<{
  mode: number;
  path: string;
}>;

type ResourceFileSnapshot = Readonly<{
  contentHash: string;
  mode: number;
  path: string;
  size: number;
}>;

type ResourceMove = Readonly<{
  from: string;
  snapshot: ResourceOwnerSnapshot;
  to: string;
}>;

type ResourceMoveProgress = {
  sourceRemovalStarted: boolean;
  sourceRemoved: boolean;
  targetClaimed: boolean;
};

/** Bytes and mode used to prove a report file is still owned by this transaction. */
type ReportFileSnapshot = Readonly<{
  bytes: Buffer;
  contentHash: string;
  mode: number;
  size: number;
}>;

type PreparedRename = Readonly<{
  indexPath: string;
  noChange: boolean;
  nextIndexText: string | null;
  oldIndexText: string | null;
  originalSources: readonly RenameSource[];
  plan: InvestigationRenamePlan;
  resourceMove: ResourceMove | null;
  sourceBefore: RenameSource;
  sources: readonly RenameSource[];
  targetSource: RenameSource;
}>;

const renameScope = "investigation report rename collection";

/** Renames one Investigation across reports, candidates, resources, and index. */
export async function renameInvestigationRecord(
  options: InvestigationRenameOptions
): Promise<InvestigationRenameResult> {
  return await renameInvestigationRecordWithHooks(options);
}

/** Test seam for the transaction's source-drift and publish-recovery boundaries. */
export async function renameInvestigationRecordWithHooks(
  options: InvestigationRenameOptions,
  hooks: InvestigationRenameHooks = {}
): Promise<InvestigationRenameResult> {
  const resolved = resolveInvestigationsDirectory(
    options.workspaceRoot,
    options.investigationsDir
  );
  if (resolved.isErr()) return renameFailure("", null, resolved.error);
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr()) return renameFailure("", null, canonical.error);
  const root = canonical.value.investigationsDirectory;
  const indexPath = path.join(root, investigationIndexFileName);
  const initial = await prepareRename(root, indexPath, options);
  if ("result" in initial) return initial.result;
  if (options.preflight === true) {
    return renameSuccess(
      false,
      indexPath,
      {
        ...initial.value.plan,
        outcome: "preflight"
      },
      "preflight"
    );
  }
  if (initial.value.noChange) {
    return renameSuccess(false, indexPath, initial.value.plan, "no-change");
  }
  try {
    return await withInvestigationCollectionMutationLock(
      indexPath,
      async () => {
        const prepared = await prepareRename(root, indexPath, options);
        if ("result" in prepared) return prepared.result;
        if (prepared.value.noChange) {
          return renameSuccess(
            false,
            indexPath,
            prepared.value.plan,
            "no-change"
          );
        }
        const confirmation = await recordedRenameConfirmation(
          root,
          prepared.value.sourceBefore,
          prepared.value.resourceMove,
          options
        );
        if (confirmation !== null) return confirmation;
        return await publishRename(root, prepared.value, hooks);
      }
    );
  } catch (error) {
    return renameLockFailure(indexPath, error);
  }
}

type RenameStep<T> =
  | Readonly<{ result: InvestigationRenameResult }>
  | Readonly<{ value: T }>;

async function prepareRename(
  root: string,
  indexPath: string,
  options: InvestigationRenameOptions
): Promise<RenameStep<PreparedRename>> {
  const layout = await inspectLayout(root, indexPath);
  if ("result" in layout) return layout;
  const formal = await collectValidatedInvestigationCollection(root, {
    allowEmptyCollection: true
  });
  if (formal.errors.length > 0 || formal.snapshot === null) {
    return renameStepFailure(indexPath, formal.errors);
  }
  if (formal.sources.length > 0) {
    const freshness = await syncInvestigationStateIndex({
      investigationsDirectory: root,
      mode: "check",
      snapshot: formal.snapshot
    });
    if (freshness.status === "error") {
      return renameStepFailure(indexPath, [
        "investigation index is not fresh for the current collection"
      ]);
    }
  }
  const candidates = await readCandidateSources(
    root,
    layout.value.candidateIds
  );
  if ("result" in candidates) return candidates;
  const sources = [
    ...formal.sources.map((source) => asFormalSource(root, source)),
    ...candidates.value
  ].sort((left, right) => compareText(left.id, right.id));
  const source = resolveRenameSource(sources, options.source, indexPath);
  if ("result" in source) return source;
  const target = resolveRenameTarget(
    source.value,
    sources,
    options.target,
    indexPath
  );
  if ("result" in target) return target;
  if (isNoOpRename(source.value, target.value)) {
    const plan = renamePlan(
      sources,
      source.value,
      target.value,
      sources,
      false
    );
    return {
      value: {
        indexPath,
        noChange: true,
        nextIndexText: null,
        oldIndexText: null,
        originalSources: sources,
        plan,
        resourceMove: null,
        sourceBefore: source.value,
        sources,
        targetSource: source.value
      }
    };
  }
  const rewritten = rewriteSources(sources, source.value, target.value);
  if ("result" in rewritten) return rewritten;
  const resourceMove = await prepareResourceMove(
    root,
    source.value.id,
    target.value.id,
    indexPath
  );
  if ("result" in resourceMove) return resourceMove;
  const index = await prepareNextIndex(root, indexPath, rewritten.value);
  if ("result" in index) return index;
  const plan = renamePlan(
    sources,
    source.value,
    target.value,
    rewritten.value,
    resourceMove.value !== null
  );
  return {
    value: {
      indexPath,
      noChange: false,
      nextIndexText: index.value.nextIndexText,
      oldIndexText: index.value.oldIndexText,
      originalSources: sources,
      plan,
      resourceMove: resourceMove.value,
      sourceBefore: source.value,
      sources: rewritten.value,
      targetSource: rewritten.value.find(
        (candidate) => candidate.id === target.value.id
      )!
    }
  };
}

function isNoOpRename(source: RenameSource, target: RenameTarget): boolean {
  return source.id === target.id && source.sourcePath === target.sourcePath;
}

async function inspectLayout(
  root: string,
  indexPath: string
): Promise<
  RenameStep<Awaited<ReturnType<typeof inspectInvestigationCollectionLayout>>>
> {
  try {
    const layout = await inspectInvestigationCollectionLayout(root);
    return layout.errors.length === 0
      ? { value: layout }
      : renameStepFailure(indexPath, layout.errors);
  } catch (error) {
    return renameStepFailure(indexPath, [
      "investigation collection could not be inspected: " + errorText(error)
    ]);
  }
}

function asFormalSource(
  root: string,
  source: InvestigationSource
): RenameSource {
  const parsed = parseInvestigationReport(source.text, source.id);
  if (parsed.report === null || parsed.errors.length > 0) {
    throw new Error(
      `validated formal Investigation ${source.id} became invalid`
    );
  }
  return {
    candidate: false,
    document: parsed.report,
    filePath: path.join(root, source.sourcePath),
    id: source.id,
    sourcePath: source.sourcePath,
    text: source.text
  };
}

async function readCandidateSources(
  root: string,
  candidateIds: readonly string[]
): Promise<RenameStep<RenameSource[]>> {
  const candidates: RenameSource[] = [];
  for (const id of candidateIds) {
    const filePath = await findCandidatePathForInvestigationId(root, id);
    if (filePath === null) {
      return renameStepFailure(path.join(root, investigationIndexFileName), [
        `Investigation candidate ${id} has no current source path`
      ]);
    }
    try {
      const text = await readRegularText(filePath);
      const parsed = parseInvestigationReport(text, id);
      if (parsed.report === null || parsed.frontmatterErrors.length > 0) {
        return renameStepFailure(path.join(root, investigationIndexFileName), [
          ...parsed.frontmatterErrors,
          `${id} candidate frontmatter cannot be renamed`
        ]);
      }
      candidates.push({
        candidate: true,
        document: parsed.report,
        filePath,
        id,
        sourcePath: path.basename(filePath),
        text
      });
    } catch (error) {
      return renameStepFailure(path.join(root, investigationIndexFileName), [
        `${id} candidate could not be read: ${errorText(error)}`
      ]);
    }
  }
  return { value: candidates };
}

function resolveRenameSource(
  sources: readonly RenameSource[],
  rawSource: string,
  indexPath: string
): RenameStep<RenameSource> {
  const normalized = rawSource.replace(/\.md$/iu, "");
  const dated = parseDatedInvestigationId(normalized);
  const matches =
    dated === null
      ? sources.filter(
          (source) => investigationNameFromId(source.id) === normalized
        )
      : sources.filter((source) => source.id === dated.id);
  if (matches.length === 1) return { value: matches[0]! };
  return renameStepFailure(indexPath, [
    matches.length === 0
      ? `Investigation rename source does not exist: ${normalized}`
      : `Investigation rename source is ambiguous: ${normalized}; choose one standard ID: ${matches
          .map((source) => source.id)
          .sort(compareText)
          .join(", ")}`
  ]);
}

type RenameTarget = Readonly<{ id: string; name: string; sourcePath: string }>;

function resolveRenameTarget(
  source: RenameSource,
  sources: readonly RenameSource[],
  rawTarget: string,
  indexPath: string
): RenameStep<RenameTarget> {
  const normalized = rawTarget.replace(/\.md$/iu, "");
  const explicit = parseDatedInvestigationId(normalized);
  const sourceDate = utcInvestigationDate(source.document.formedAt);
  if (sourceDate === null) {
    return renameStepFailure(indexPath, [
      `${source.id} has no valid formedAt UTC date for identity migration`
    ]);
  }
  if (explicit !== null && explicit.date !== sourceDate) {
    return renameStepFailure(indexPath, [
      `Target Investigation ID date must match formedAt UTC date ${sourceDate}`
    ]);
  }
  const id =
    explicit?.id ??
    datedInvestigationIdForName(normalized, source.document.formedAt);
  if (id === null || !isInvestigationId(id)) {
    return renameStepFailure(indexPath, [
      `Investigation rename target must be a semantic name or calendar-valid YYMMDD-name ID: ${normalized}`
    ]);
  }
  const others = sources.filter((candidate) => candidate.id !== source.id);
  if (others.some((candidate) => candidate.id === id)) {
    return renameStepFailure(indexPath, [
      `Target Investigation ID already exists: ${id}`
    ]);
  }
  const name = investigationNameFromId(id);
  if (
    others.some((candidate) => investigationNameFromId(candidate.id) === name)
  ) {
    return renameStepFailure(indexPath, [
      `Target Investigation name already exists: ${name}`
    ]);
  }
  const namePath = source.candidate ? `_candidate.${name}` : `${name}.md`;
  const idPath = source.candidate ? `_candidate.${id}` : `${id}.md`;
  const occupied = new Set(others.map((candidate) => candidate.sourcePath));
  const sourcePath = occupied.has(namePath)
    ? occupied.has(idPath)
      ? null
      : idPath
    : namePath;
  return sourcePath === null
    ? renameStepFailure(indexPath, [
        `Both name and ID target paths are occupied for Investigation ${id}`
      ])
    : { value: { id, name, sourcePath } };
}

function rewriteSources(
  sources: readonly RenameSource[],
  source: RenameSource,
  target: RenameTarget
): RenameStep<RenameSource[]> {
  const rewritten: RenameSource[] = [];
  for (const current of sources) {
    const text = replaceInvestigationReportIdentity(
      current.text,
      current.document,
      source.id,
      target.id
    );
    const id = current.id === source.id ? target.id : current.id;
    const sourcePath =
      current.id === source.id ? target.sourcePath : current.sourcePath;
    const parsed = parseInvestigationReport(text, id);
    if (parsed.report === null || parsed.frontmatterErrors.length > 0) {
      return renameStepFailure("", [
        `Renamed Investigation source ${id} could not be validated`
      ]);
    }
    rewritten.push({
      ...current,
      document: parsed.report,
      id,
      sourcePath,
      text
    });
  }
  return { value: rewritten };
}

async function prepareResourceMove(
  root: string,
  oldId: string,
  nextId: string,
  indexPath: string
): Promise<RenameStep<ResourceMove | null>> {
  if (oldId === nextId) return { value: null };
  const from = path.join(root, investigationResourcesDirectoryName, oldId);
  const to = path.join(root, investigationResourcesDirectoryName, nextId);
  try {
    const source = await lstatOrNull(from);
    if (source === null) return { value: null };
    if (source.isSymbolicLink() || !source.isDirectory()) {
      return renameStepFailure(indexPath, [
        "Investigation resource owner path must be a non-symbolic-link directory"
      ]);
    }
    if ((await lstatOrNull(to)) !== null) {
      return renameStepFailure(indexPath, [
        `Investigation resource owner target already exists: ${nextId}`
      ]);
    }
    const scanned = await scanResourceOwner(from, oldId);
    if (scanned.errors.length > 0)
      return renameStepFailure(indexPath, scanned.errors);
    return { value: { from, snapshot: scanned.value, to } };
  } catch (error) {
    return renameStepFailure(indexPath, [
      "Investigation resource owner could not be inspected: " + errorText(error)
    ]);
  }
}

type ResourceOwnerScan = Readonly<{
  errors: readonly string[];
  value: ResourceOwnerSnapshot;
}>;

/**
 * Capture every owner member's type-adjacent metadata and bytes so recovery
 * can distinguish this transaction's copy from a concurrent same-name write.
 */
async function scanResourceOwner(
  ownerPath: string,
  ownerId: string
): Promise<ResourceOwnerScan> {
  const directories: ResourceDirectorySnapshot[] = [];
  const errors: string[] = [];
  const files: ResourceFileSnapshot[] = [];
  let ownerMode = 0;
  try {
    const owner = await fs.lstat(ownerPath);
    if (owner.isSymbolicLink() || !owner.isDirectory()) {
      errors.push(
        "Investigation resource owner path must be a non-symbolic-link directory"
      );
    } else {
      ownerMode = resourceMode(owner.mode);
    }
  } catch (error) {
    errors.push(
      "Investigation resource owner could not be inspected: " + errorText(error)
    );
  }
  if (errors.length > 0) {
    return {
      errors: uniqueSorted(errors),
      value: emptyResourceOwnerSnapshot()
    };
  }
  async function walk(directory: string, relativePath: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      errors.push(
        "Investigation resource owner could not be read: " + errorText(error)
      );
      return;
    }
    for (const entry of entries.sort((left, right) =>
      compareText(left.name, right.name)
    )) {
      const next =
        relativePath.length === 0
          ? entry.name
          : `${relativePath}/${entry.name}`;
      const absolute = path.join(directory, entry.name);
      let stat: Stats;
      try {
        stat = await fs.lstat(absolute);
      } catch (error) {
        errors.push(
          `Investigation resource ${ownerId}/${next} could not be inspected: ${errorText(error)}`
        );
        continue;
      }
      if (stat.isSymbolicLink()) {
        errors.push(
          `Investigation resource ${ownerId}/${next} must not be a symbolic link`
        );
      } else if (stat.isDirectory()) {
        if (!isInvestigationResourceId(`${ownerId}/${next}/directory`)) {
          errors.push(
            `Investigation resource directory ${ownerId}/${next} must use a safe path`
          );
          continue;
        }
        directories.push({ mode: resourceMode(stat.mode), path: next });
        await walk(absolute, next);
      } else if (stat.isFile()) {
        if (!isInvestigationResourceId(`${ownerId}/${next}`)) {
          errors.push(
            `Investigation resource ${ownerId}/${next} must use a safe resource ID`
          );
          continue;
        }
        try {
          files.push(await resourceFileSnapshot(absolute, next, stat));
        } catch (error) {
          errors.push(
            `Investigation resource ${ownerId}/${next} could not be read: ${errorText(error)}`
          );
        }
      } else {
        errors.push(
          `Investigation resource ${ownerId}/${next} must be a regular file or directory`
        );
      }
    }
  }
  await walk(ownerPath, "");
  return {
    errors: uniqueSorted(errors),
    value: {
      directories: uniqueResourceDirectories(directories),
      files: uniqueResourceFiles(files),
      mode: ownerMode
    }
  };
}

function sameResourceOwnerSnapshot(
  left: ResourceOwnerSnapshot,
  right: ResourceOwnerSnapshot
): boolean {
  return (
    left.mode === right.mode &&
    sameResourceDirectories(left.directories, right.directories) &&
    sameResourceFiles(left.files, right.files)
  );
}

function emptyResourceOwnerSnapshot(): ResourceOwnerSnapshot {
  return { directories: [], files: [], mode: 0 };
}

async function resourceFileSnapshot(
  filePath: string,
  relativePath: string,
  initial: Stats
): Promise<ResourceFileSnapshot> {
  const contents = await fs.readFile(filePath);
  const current = await fs.lstat(filePath);
  if (
    current.isSymbolicLink() ||
    !current.isFile() ||
    current.size !== initial.size ||
    resourceMode(current.mode) !== resourceMode(initial.mode)
  ) {
    throw new Error("resource changed while its snapshot was being read");
  }
  return {
    contentHash: createHash("sha256").update(contents).digest("hex"),
    mode: resourceMode(current.mode),
    path: relativePath,
    size: current.size
  };
}

function resourceMode(mode: number): number {
  return mode & 0o7777;
}

function uniqueResourceDirectories(
  directories: readonly ResourceDirectorySnapshot[]
): ResourceDirectorySnapshot[] {
  return [...directories]
    .sort((left, right) => compareText(left.path, right.path))
    .filter(
      (directory, index, values) =>
        index === 0 || directory.path !== values[index - 1]!.path
    );
}

function uniqueResourceFiles(
  files: readonly ResourceFileSnapshot[]
): ResourceFileSnapshot[] {
  return [...files]
    .sort((left, right) => compareText(left.path, right.path))
    .filter(
      (file, index, values) =>
        index === 0 || file.path !== values[index - 1]!.path
    );
}

function sameResourceDirectories(
  left: readonly ResourceDirectorySnapshot[],
  right: readonly ResourceDirectorySnapshot[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (directory, index) =>
        directory.path === right[index]?.path &&
        directory.mode === right[index]?.mode
    )
  );
}

function sameResourceFiles(
  left: readonly ResourceFileSnapshot[],
  right: readonly ResourceFileSnapshot[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (file, index) =>
        file.path === right[index]?.path &&
        file.mode === right[index]?.mode &&
        file.size === right[index]?.size &&
        file.contentHash === right[index]?.contentHash
    )
  );
}

async function prepareNextIndex(
  root: string,
  indexPath: string,
  sources: readonly RenameSource[]
): Promise<
  RenameStep<
    Readonly<{ nextIndexText: string | null; oldIndexText: string | null }>
  >
> {
  const formal = sources.filter((source) => !source.candidate);
  if (formal.length === 0) {
    return { value: { nextIndexText: null, oldIndexText: null } };
  }
  let oldIndexText: string;
  try {
    oldIndexText = await readRegularText(indexPath);
  } catch (error) {
    return renameStepFailure(indexPath, [
      "Investigation index could not be read before rename: " + errorText(error)
    ]);
  }
  const states = new Map<string, InvestigationIndexState>();
  const formalSources: InvestigationSource[] = [];
  for (const source of formal) {
    const built = buildInvestigationReportState(
      source.id,
      parseInvestigationReport(source.text, source.id),
      source.sourcePath
    );
    if (built.status === "invalid")
      return renameStepFailure(indexPath, built.errors);
    states.set(source.id, built.state);
    formalSources.push({
      id: source.id,
      sourcePath: source.sourcePath,
      text: source.text
    });
  }
  const relationErrors = validateInvestigationRelationGraph(states);
  if (relationErrors.length > 0)
    return renameStepFailure(indexPath, relationErrors);
  try {
    const snapshot = createInvestigationStateSnapshot(
      formalSources,
      formalSources.map((source) => states.get(source.id)!)
    );
    const definition = createInvestigationStateIndexDefinition({ snapshot });
    const index = await buildStateIndex(definition, { root });
    if (index.status === "error") {
      return renameStepFailure(indexPath, [
        "Investigation rename could not build a complete derived index"
      ]);
    }
    return {
      value: {
        nextIndexText: serializeStateIndex(index.value, definition),
        oldIndexText
      }
    };
  } catch (error) {
    return renameStepFailure(indexPath, [
      "Investigation rename could not project the complete index: " +
        errorText(error)
    ]);
  }
}

function renamePlan(
  before: readonly RenameSource[],
  source: RenameSource,
  target: RenameTarget,
  after: readonly RenameSource[],
  resourceOwnerMoved: boolean
): InvestigationRenamePlan {
  const identityChanged = source.id !== target.id;
  const relationCounts = identityChanged
    ? before.reduce(
        (counts, current) => {
          const affected = current.document.relations.filter(
            (relation) => relation.target === source.id
          ).length;
          if (current.candidate) counts.candidate += affected;
          else counts.established += affected;
          return counts;
        },
        { candidate: 0, established: 0 }
      )
    : { candidate: 0, established: 0 };
  const resourcePrefix = `./_resources/${source.id}/`;
  const affectedResourceReferenceCount = identityChanged
    ? before.reduce(
        (count, current) =>
          count + countText(current.text, `](${resourcePrefix}`),
        0
      )
    : 0;
  const next = after.find((current) => current.id === target.id)!;
  return {
    affectedCandidateRelationCount: relationCounts.candidate,
    affectedEstablishedRelationCount: relationCounts.established,
    affectedResourceReferenceCount,
    newId: target.id,
    newName: target.name,
    newSourcePath: next.sourcePath,
    oldId: source.id,
    oldName: investigationNameFromId(source.id),
    oldSourcePath: source.sourcePath,
    outcome: "ready",
    resourceOwnerMoved
  };
}

async function recordedRenameConfirmation(
  root: string,
  source: RenameSource,
  resourceMove: ResourceMove | null,
  options: InvestigationRenameOptions
): Promise<InvestigationRenameResult | null> {
  const recorded = await hasRecordedRenameSource(root, source, resourceMove);
  if (recorded.errors.length > 0) {
    return renameFailure(
      path.join(root, investigationIndexFileName),
      null,
      recorded.errors,
      renameMutation("no-change")
    );
  }
  const confirmed = source.candidate
    ? options.renameRecordedCandidate === true
    : options.renameRecordedReport === true;
  if (!recorded.recorded || confirmed) return null;
  const noun = source.candidate ? "candidate" : "report";
  const flag = source.candidate
    ? "--rename-recorded-candidate"
    : "--rename-recorded-report";
  return {
    ...renameFailure(
      path.join(root, investigationIndexFileName),
      null,
      [
        `Investigation ${noun} ${source.id} has entered Git HEAD; confirm that its recorded identity should be renamed.`,
        `Re-run with ${flag} only after confirming this working-tree rename; Git history is not rewritten.`
      ],
      renameMutation("no-change")
    ),
    status: "attention"
  };
}

async function hasRecordedRenameSource(
  root: string,
  source: RenameSource,
  resourceMove: ResourceMove | null
): Promise<Readonly<{ errors: string[]; recorded: boolean }>> {
  try {
    const repository = await openVersionControl(root);
    const revision = await repository.getCurrentRevision();
    if (revision === null) return { errors: [], recorded: false };
    const scope =
      path.resolve(root) === repository.rootDirectory
        ? ""
        : repositoryRelativePathFromFileSystemPath(
            repository.rootDirectory,
            root
          );
    const paths = [
      scope.length === 0 ? source.sourcePath : `${scope}/${source.sourcePath}`,
      ...(resourceMove === null
        ? []
        : [
            scope.length === 0
              ? `${investigationResourcesDirectoryName}/${path.basename(resourceMove.from)}`
              : `${scope}/${investigationResourcesDirectoryName}/${path.basename(resourceMove.from)}`
          ])
    ];
    const files = await repository.listRevisionFiles(revision, {
      pathScopes: paths
    });
    return { errors: [], recorded: files.length > 0 };
  } catch (error) {
    if (
      error instanceof VersionControlError &&
      error.code === "not-repository"
    ) {
      return { errors: [], recorded: false };
    }
    return {
      errors: [
        "Git HEAD could not be inspected before Investigation rename: " +
          errorText(error)
      ],
      recorded: false
    };
  }
}

async function publishRename(
  root: string,
  prepared: PreparedRename,
  hooks: InvestigationRenameHooks
): Promise<InvestigationRenameResult> {
  if (prepared.noChange) {
    return renameSuccess(false, prepared.indexPath, prepared.plan, "no-change");
  }
  try {
    await (hooks.beforePublish ?? noOp)();
  } catch (error) {
    return renameFailure(
      prepared.indexPath,
      prepared.plan,
      ["Investigation rename publish preparation failed: " + errorText(error)],
      renameMutation("no-change")
    );
  }
  const verification = await verifyPreparedRename(root, prepared);
  if (verification.length > 0) {
    return renameFailure(
      prepared.indexPath,
      prepared.plan,
      verification,
      renameMutation("no-change")
    );
  }
  let originalByPath: Map<string, ReportFileSnapshot>;
  try {
    originalByPath = await captureRenameSourceSnapshots(
      prepared.originalSources
    );
  } catch (error) {
    return renameFailure(
      prepared.indexPath,
      prepared.plan,
      [
        "Investigation rename sources could not be snapshotted before publication: " +
          errorText(error)
      ],
      renameMutation("no-change")
    );
  }
  const target = prepared.targetSource;
  const sourceBefore = prepared.sourceBefore;
  const sourceOldPath = sourceBefore.filePath;
  const sourceNewPath = path.join(root, target.sourcePath);
  let createdSourcePath = false;
  const resourceMoveProgress: ResourceMoveProgress = {
    sourceRemovalStarted: false,
    sourceRemoved: false,
    targetClaimed: false
  };
  const writtenPaths = new Set<string>();
  const writtenByPath = new Map<string, ReportFileSnapshot>();
  try {
    for (const source of prepared.sources) {
      const previousPath =
        source.id === prepared.plan.newId ? sourceOldPath : source.filePath;
      const nextPath =
        source.id === prepared.plan.newId ? sourceNewPath : source.filePath;
      const original = originalByPath.get(previousPath)!;
      if (nextPath !== previousPath) {
        await (hooks.writeNew ?? writeNewText)(nextPath, source.text);
        createdSourcePath = true;
        writtenPaths.add(nextPath);
        writtenByPath.set(
          nextPath,
          await captureWrittenReportSnapshot(nextPath, source.text)
        );
        await removeReportFileIfUnchanged(previousPath, original);
      } else if (!sameReportBytes(original.bytes, Buffer.from(source.text))) {
        await (hooks.writeExisting ?? writeTextAtomically)(
          nextPath,
          source.text
        );
        writtenPaths.add(nextPath);
        writtenByPath.set(
          nextPath,
          await captureWrittenReportSnapshot(nextPath, source.text)
        );
      }
    }
    if (prepared.resourceMove !== null) {
      await (hooks.beforeResourceMove ?? noOp)();
      await moveResourceOwner(
        prepared.resourceMove,
        prepared.plan.oldId,
        prepared.plan.newId,
        resourceMoveProgress,
        hooks.beforeSourceOwnerRemoval
      );
    }
    if (prepared.nextIndexText !== null) {
      await (hooks.writeExisting ?? writeTextAtomically)(
        prepared.indexPath,
        prepared.nextIndexText
      );
      writtenPaths.add(prepared.indexPath);
    }
    const verified = await verifyCommittedRename(root, prepared);
    if (verified.length > 0) throw new Error(verified.join("; "));
    return renameSuccess(true, prepared.indexPath, prepared.plan, "committed");
  } catch (error) {
    const restored = await restoreRename({
      createdSourcePath,
      originalByPath,
      prepared,
      resourceMoveProgress,
      sourceNewPath,
      sourceOldPath,
      writtenPaths,
      writtenByPath
    });
    const outcome =
      restored.length === 0 ? "rolled-back" : "partial-or-unknown";
    return renameFailure(
      prepared.indexPath,
      null,
      ["Investigation rename publish failed: " + errorText(error), ...restored],
      renameMutation(outcome)
    );
  }
}

/**
 * Claim the target owner before copying its validated members. `rename()` can
 * replace an empty target directory on POSIX, so it is not a no-overwrite move
 * primitive for owner trees that may be created concurrently.
 */
async function moveResourceOwner(
  move: ResourceMove,
  oldId: string,
  newId: string,
  progress: ResourceMoveProgress,
  beforeSourceOwnerRemoval: (() => Promise<void>) | undefined
): Promise<void> {
  await fs.mkdir(move.to, { mode: move.snapshot.mode });
  await fs.chmod(move.to, move.snapshot.mode);
  progress.targetClaimed = true;
  await copyResourceOwnerMembers(move.from, move.to, move.snapshot);
  await verifyResourceOwnerSnapshot(move.to, newId, move.snapshot);
  await verifyResourceOwnerSnapshot(move.from, oldId, move.snapshot);
  await (beforeSourceOwnerRemoval ?? noOp)();
  progress.sourceRemovalStarted = true;
  await removeResourceOwnerMembers(move.from, oldId, move.snapshot);
  progress.sourceRemoved = true;
}

async function copyResourceOwnerMembers(
  from: string,
  to: string,
  snapshot: ResourceOwnerSnapshot
): Promise<void> {
  for (const directory of [...snapshot.directories].sort(
    compareResourceDirectory
  )) {
    const target = path.join(to, directory.path);
    await fs.mkdir(target, { mode: directory.mode });
    await fs.chmod(target, directory.mode);
  }
  for (const file of snapshot.files) {
    const target = path.join(to, file.path);
    await fs.copyFile(
      path.join(from, file.path),
      target,
      fileSystemConstants.COPYFILE_EXCL
    );
    await fs.chmod(target, file.mode);
  }
}

async function verifyResourceOwnerSnapshot(
  ownerPath: string,
  ownerId: string,
  expected: ResourceOwnerSnapshot
): Promise<void> {
  const current = await scanResourceOwner(ownerPath, ownerId);
  if (
    current.errors.length > 0 ||
    !sameResourceOwnerSnapshot(expected, current.value)
  ) {
    throw new Error("Investigation resource owner changed while being moved");
  }
}

/** Deletes only the preflighted members; a concurrent extra keeps its directory non-empty. */
async function removeResourceOwnerMembers(
  ownerPath: string,
  ownerId: string,
  expected: ResourceOwnerSnapshot
): Promise<void> {
  await verifyResourceOwnerSnapshot(ownerPath, ownerId, expected);
  for (const file of expected.files) {
    await verifyResourceFileSnapshot(path.join(ownerPath, file.path), file);
    await fs.rm(path.join(ownerPath, file.path), { force: false });
  }
  for (const directory of [...expected.directories].sort((left, right) =>
    compareResourceDirectory(right, left)
  )) {
    await verifyResourceDirectorySnapshot(
      path.join(ownerPath, directory.path),
      directory
    );
    await fs.rmdir(path.join(ownerPath, directory.path));
  }
  const owner = await fs.lstat(ownerPath);
  if (
    owner.isSymbolicLink() ||
    !owner.isDirectory() ||
    resourceMode(owner.mode) !== expected.mode
  ) {
    throw new Error("Investigation resource owner changed before removal");
  }
  await fs.rmdir(ownerPath);
}

async function verifyResourceFileSnapshot(
  filePath: string,
  expected: ResourceFileSnapshot
): Promise<void> {
  const initial = await fs.lstat(filePath);
  if (
    initial.isSymbolicLink() ||
    !initial.isFile() ||
    initial.size !== expected.size ||
    resourceMode(initial.mode) !== expected.mode
  ) {
    throw new Error("Investigation resource file changed before removal");
  }
  const contents = await fs.readFile(filePath);
  const current = await fs.lstat(filePath);
  if (
    current.isSymbolicLink() ||
    !current.isFile() ||
    current.size !== expected.size ||
    resourceMode(current.mode) !== expected.mode ||
    createHash("sha256").update(contents).digest("hex") !== expected.contentHash
  ) {
    throw new Error("Investigation resource file changed before removal");
  }
}

async function verifyResourceDirectorySnapshot(
  directoryPath: string,
  expected: ResourceDirectorySnapshot
): Promise<void> {
  const current = await fs.lstat(directoryPath);
  if (
    current.isSymbolicLink() ||
    !current.isDirectory() ||
    resourceMode(current.mode) !== expected.mode
  ) {
    throw new Error("Investigation resource directory changed before removal");
  }
}

function compareResourceDirectory(
  left: ResourceDirectorySnapshot,
  right: ResourceDirectorySnapshot
): number {
  const depth = (value: string): number => value.split("/").length;
  return (
    depth(left.path) - depth(right.path) || compareText(left.path, right.path)
  );
}

async function verifyPreparedRename(
  root: string,
  prepared: PreparedRename
): Promise<string[]> {
  const errors: string[] = [];
  const sourceBefore = prepared.sourceBefore;
  for (const source of prepared.originalSources) {
    try {
      if ((await readRegularText(source.filePath)) !== source.text) {
        errors.push(
          `${source.id} changed after rename validation; no files were written`
        );
      }
    } catch (error) {
      errors.push(
        `${source.id} could not be re-read before rename: ${errorText(error)}`
      );
    }
  }
  const nextPath = path.join(root, prepared.plan.newSourcePath);
  if (
    nextPath !== sourceBefore.filePath &&
    (await lstatOrNull(nextPath)) !== null
  ) {
    errors.push(
      `Investigation rename target path already exists: ${prepared.plan.newSourcePath}`
    );
  }
  if (prepared.oldIndexText !== null) {
    try {
      if (
        (await readRegularText(prepared.indexPath)) !== prepared.oldIndexText
      ) {
        errors.push(
          "investigation index changed after rename validation; no files were written"
        );
      }
    } catch (error) {
      errors.push(
        "investigation index could not be re-read before rename: " +
          errorText(error)
      );
    }
  }
  if (prepared.resourceMove !== null) {
    if ((await lstatOrNull(prepared.resourceMove.to)) !== null) {
      errors.push(
        "Investigation resource owner target appeared after rename validation"
      );
    }
  }
  return errors;
}

async function verifyCommittedRename(
  root: string,
  prepared: PreparedRename
): Promise<string[]> {
  const collection = await collectValidatedInvestigationCollection(root, {
    allowEmptyCollection: true
  });
  if (collection.errors.length > 0) return collection.errors;
  const layout = await inspectLayout(root, prepared.indexPath);
  if ("result" in layout) return layout.result.errors;
  const candidates = await readCandidateSources(
    root,
    layout.value.candidateIds
  );
  if ("result" in candidates) return candidates.result.errors;
  if (collection.snapshot !== null && collection.sources.length > 0) {
    const freshness = await syncInvestigationStateIndex({
      investigationsDirectory: root,
      mode: "check",
      snapshot: collection.snapshot
    });
    if (freshness.status === "error")
      return ["investigation index is stale after rename"];
  }
  const oldId = prepared.plan.oldId;
  const oldPath = prepared.plan.oldSourcePath;
  const identityChanged = oldId !== prepared.plan.newId;
  const sourcePathChanged = oldPath !== prepared.plan.newSourcePath;
  const resourcesPrefix = path.join(
    root,
    investigationResourcesDirectoryName,
    oldId
  );
  const oldPathExists = sourcePathChanged
    ? await lstatOrNull(path.join(root, oldPath))
    : null;
  const oldOwnerExists = identityChanged
    ? await lstatOrNull(resourcesPrefix)
    : null;
  const sourceReferenced = identityChanged
    ? [
        ...collection.sources.map((source) => asFormalSource(root, source)),
        ...candidates.value
      ].some(
        (source) =>
          source.id === oldId ||
          source.document.relations.some(
            (relation) => relation.target === oldId
          ) ||
          source.text.includes(`](./_resources/${oldId}/`)
      )
    : false;
  return sourceReferenced || oldPathExists !== null || oldOwnerExists !== null
    ? [
        "current managed Investigation content still references the old identity after rename"
      ]
    : [];
}

async function captureRenameSourceSnapshots(
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

async function captureWrittenReportSnapshot(
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

async function captureReportFileSnapshot(
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

async function verifyReportFileSnapshot(
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

function sameReportBytes(left: Buffer, right: Buffer): boolean {
  return left.byteLength === right.byteLength && left.equals(right);
}

async function removeReportFileIfUnchanged(
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

async function restoreRename(options: RestoreRenameOptions): Promise<string[]> {
  const errors: string[] = [];
  if (options.prepared.resourceMove !== null) {
    const resourceErrors = await restoreResourceOwnerMove(
      options.prepared.resourceMove,
      options.prepared.plan.oldId,
      options.prepared.plan.newId,
      options.resourceMoveProgress
    );
    errors.push(...resourceErrors);
  }
  if (options.createdSourcePath) {
    errors.push(...(await restoreMovedReportSource(options)));
  }
  for (const [sourcePath, original] of options.originalByPath) {
    if (
      sourcePath === options.sourceOldPath &&
      options.sourceNewPath !== options.sourceOldPath
    ) {
      continue;
    }
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
  if (options.prepared.oldIndexText !== null) {
    try {
      await fs.writeFile(
        options.prepared.indexPath,
        options.prepared.oldIndexText,
        "utf8"
      );
    } catch (error) {
      errors.push("failed to restore investigation index: " + errorText(error));
    }
  }
  return errors;
}

/**
 * Never remove a claimed target until it still has exactly the owner members
 * this transaction copied. If another writer won the target race or changed
 * it afterwards, leave it for explicit reconciliation rather than deleting it.
 */
async function restoreResourceOwnerMove(
  move: ResourceMove,
  oldId: string,
  newId: string,
  progress: ResourceMoveProgress
): Promise<string[]> {
  if (!progress.targetClaimed) return [];
  try {
    await verifyResourceOwnerSnapshot(move.to, newId, move.snapshot);
  } catch (error) {
    return [
      "failed to restore Investigation resource owner because its target changed after publication: " +
        errorText(error)
    ];
  }
  if (!progress.sourceRemovalStarted) {
    return await removeClaimedResourceOwner(move.to, newId, move.snapshot);
  }
  if (!progress.sourceRemoved) {
    const sourceState = await resourceOwnerRecoveryState(
      move.from,
      oldId,
      move.snapshot
    );
    if (sourceState === "equal") {
      return await removeClaimedResourceOwner(move.to, newId, move.snapshot);
    }
    if (sourceState === "diverged") {
      return [
        "failed to restore Investigation resource owner because its old owner changed during removal"
      ];
    }
    try {
      await restoreMissingResourceOwnerMembers(
        move.to,
        move.from,
        move.snapshot
      );
      await verifyResourceOwnerSnapshot(move.from, oldId, move.snapshot);
    } catch (error) {
      return [
        "failed to restore Investigation resource owner: " + errorText(error)
      ];
    }
    return await removeClaimedResourceOwner(move.to, newId, move.snapshot);
  }
  try {
    if ((await lstatOrNull(move.from)) !== null) {
      return [
        "failed to restore Investigation resource owner because its old owner path reappeared"
      ];
    }
    await fs.mkdir(move.from, { mode: move.snapshot.mode });
    await fs.chmod(move.from, move.snapshot.mode);
    await copyResourceOwnerMembers(move.to, move.from, move.snapshot);
    await verifyResourceOwnerSnapshot(move.from, oldId, move.snapshot);
  } catch (error) {
    return [
      "failed to restore Investigation resource owner: " + errorText(error)
    ];
  }
  return await removeClaimedResourceOwner(move.to, newId, move.snapshot);
}

type ResourceOwnerRecoveryState = "diverged" | "equal" | "subset";

async function resourceOwnerRecoveryState(
  ownerPath: string,
  ownerId: string,
  expected: ResourceOwnerSnapshot
): Promise<ResourceOwnerRecoveryState> {
  try {
    const current = await scanResourceOwner(ownerPath, ownerId);
    if (current.errors.length > 0) return "diverged";
    if (sameResourceOwnerSnapshot(current.value, expected)) return "equal";
    return isResourceOwnerSnapshotSubset(current.value, expected)
      ? "subset"
      : "diverged";
  } catch {
    return "diverged";
  }
}

function isResourceOwnerSnapshotSubset(
  current: ResourceOwnerSnapshot,
  expected: ResourceOwnerSnapshot
): boolean {
  return (
    current.mode === expected.mode &&
    current.directories.every((directory) =>
      expected.directories.some(
        (candidate) =>
          candidate.path === directory.path && candidate.mode === directory.mode
      )
    ) &&
    current.files.every((file) =>
      expected.files.some(
        (candidate) =>
          candidate.path === file.path &&
          candidate.mode === file.mode &&
          candidate.size === file.size &&
          candidate.contentHash === file.contentHash
      )
    )
  );
}

async function restoreMissingResourceOwnerMembers(
  from: string,
  to: string,
  snapshot: ResourceOwnerSnapshot
): Promise<void> {
  for (const directory of [...snapshot.directories].sort(
    compareResourceDirectory
  )) {
    const target = path.join(to, directory.path);
    const existing = await lstatOrNull(target);
    if (existing === null) {
      await fs.mkdir(target, { mode: directory.mode });
      await fs.chmod(target, directory.mode);
    } else {
      await verifyResourceDirectorySnapshot(target, directory);
    }
  }
  for (const file of snapshot.files) {
    const target = path.join(to, file.path);
    if ((await lstatOrNull(target)) === null) {
      await fs.copyFile(
        path.join(from, file.path),
        target,
        fileSystemConstants.COPYFILE_EXCL
      );
      await fs.chmod(target, file.mode);
    } else {
      await verifyResourceFileSnapshot(target, file);
    }
  }
}

async function removeClaimedResourceOwner(
  ownerPath: string,
  ownerId: string,
  expected: ResourceOwnerSnapshot
): Promise<string[]> {
  try {
    const entry = await lstatOrNull(ownerPath);
    if (entry === null) return [];
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      return [
        "failed to remove Investigation resource owner because its target changed type"
      ];
    }
    await removeResourceOwnerMembers(ownerPath, ownerId, expected);
    return [];
  } catch (error) {
    return [
      "failed to remove renamed Investigation resource owner: " +
        errorText(error)
    ];
  }
}

function renameSuccess(
  changed: boolean,
  indexPath: string,
  plan: InvestigationRenamePlan,
  outcome: "committed" | "no-change" | "preflight"
): InvestigationRenameResult {
  return {
    changed,
    diagnostics: [],
    errors: [],
    indexPath,
    plan: { ...plan, outcome: outcome === "preflight" ? "preflight" : "ready" },
    status: "ok"
  };
}

function renameFailure(
  indexPath: string,
  plan: InvestigationRenamePlan | null,
  errors: readonly string[],
  mutation?: InvestigationMutationDiagnostic
): InvestigationRenameResult {
  const sorted = uniqueSorted(errors);
  return {
    changed: false,
    diagnostics: [
      genericInvestigationDiagnostic({
        code: "investigation-report.rename-failed",
        ...(mutation === undefined ? {} : { mutation }),
        reason: sorted.join("; "),
        recovery:
          "Correct the reported Investigation identity, collection, or recovery issue before retrying rename.",
        target: plan?.oldId ?? indexPath
      })
    ],
    errors: sorted,
    indexPath,
    ...(mutation === undefined ? {} : { mutation }),
    plan,
    status: "error"
  };
}

function renameStepFailure<T>(
  indexPath: string,
  errors: readonly string[]
): RenameStep<T> {
  return { result: renameFailure(indexPath, null, errors) };
}

function renameLockFailure(
  indexPath: string,
  error: unknown
): InvestigationRenameResult {
  const mutation = renameMutation(
    error instanceof InvestigationCollectionMutationLockError &&
      error.operationCompleted
      ? "committed-cleanup-pending"
      : "no-change"
  );
  return {
    ...renameFailure(
      indexPath,
      null,
      ["Investigation rename lock failed: " + errorText(error)],
      mutation
    ),
    diagnostics: [
      diagnosticFromError({
        code: "investigation-report.rename-lock-failed",
        error,
        mutation,
        reason:
          "the Investigation rename transaction could not acquire or release its collection lock",
        recovery:
          "Wait for the active transaction or inspect the collection lock before retrying rename.",
        target: indexPath
      })
    ]
  };
}

function renameMutation(
  outcome: InvestigationMutationDiagnostic["outcome"]
): InvestigationMutationDiagnostic {
  return { outcome, scope: renameScope };
}

async function readRegularText(filePath: string): Promise<string> {
  const entry = await fs.lstat(filePath);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new Error("must be a regular non-symbolic-link file");
  }
  return await fs.readFile(filePath, "utf8");
}

async function writeTextAtomically(
  targetPath: string,
  text: string
): Promise<void> {
  await readRegularText(targetPath);
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

async function writeNewText(targetPath: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const file = await fs.open(targetPath, "wx", 0o600);
  try {
    await file.writeFile(text, "utf8");
  } finally {
    await file.close();
  }
}

async function lstatOrNull(
  targetPath: string
): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(targetPath);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function countText(text: string, needle: string): number {
  let count = 0;
  let index = text.indexOf(needle);
  while (index >= 0) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

async function noOp(): Promise<void> {}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorText(error: unknown): string {
  return sanitizeInvestigationDiagnosticText(error);
}
