import { Buffer } from "node:buffer";
import { sameBytes } from "../../shared/src/node/bytes.ts";
import { isDeepStrictEqual } from "node:util";
import {
  readPendingSnapshot,
  replacePendingSnapshot,
  samePendingSnapshots,
  type PendingFileUpdate,
  type PendingSnapshot,
  type PendingSnapshotReplacementResult
} from "../../shared/src/version-control/pending-snapshot.ts";
import type {
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import { selectTargetSnapshot } from "./staging-selection.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexDiagnostic,
  StateIndexResult,
  StateSnapshot
} from "./types.ts";

export type RecordStageScope = "all" | "index" | "domain";
export type RecordStagePhase<Index, Context> = Readonly<{
  baseline: Index | null;
  workspace: Index;
  pendingIndex: Index | null;
  pending: PendingSnapshot;
  selectedIds: readonly string[];
  workspaceEvidence: string;
  workspaceBytes: Uint8Array;
  context: Context;
}>;
export type RecordDomainPreparation = Readonly<{
  pending: PendingSnapshot;
  updates: readonly PendingFileUpdate[];
  sourceFiles: readonly VersionControlFile[];
}>;
export type RecordStageResult<Index, Context> = Readonly<{
  phase: RecordStagePhase<Index, Context>;
  updates: readonly PendingFileUpdate[];
  replacement: PendingSnapshotReplacementResult;
}>;

export class RecordStageError extends Error {
  readonly kind:
    | "collection-changed"
    | "pending-deleted"
    | "target-invalid"
    | "pending-conflict"
    | "source-drift";
  readonly diagnostics: readonly StateIndexDiagnostic[];

  constructor(
    kind: RecordStageError["kind"],
    message: string,
    diagnostics: readonly StateIndexDiagnostic[] = []
  ) {
    super(message);
    this.name = "RecordStageError";
    this.kind = kind;
    this.diagnostics = diagnostics;
  }
}

export class RecordStagePublicationError extends Error {
  constructor(cause: unknown) {
    super("Failed to publish the protected record snapshot", { cause });
    this.name = "RecordStagePublicationError";
  }
}

/** Scope policy for the two record consumers, not the generic H-base staging default. */
export async function readRecordStagePending(
  repository: VersionControlRepository,
  options: Readonly<{
    scope: RecordStageScope;
    pathScope: string;
    indexPath: string;
    contentPaths: readonly string[];
  }>
): Promise<PendingSnapshot> {
  return await readPendingSnapshot(repository, {
    pathScope: options.pathScope,
    payloadScope: options.scope === "index" ? "content-paths" : "scope",
    contentPaths:
      options.scope === "index" ? [options.indexPath] : options.contentPaths
  });
}

/** Reuse only a parsed target payload backed by independently equivalent complete pending facts. */
export function sameRecordStagePendingIndex(
  before: PendingSnapshot,
  after: PendingSnapshot,
  indexPath: string
): boolean {
  if (!samePendingSnapshots(before, after)) return false;
  const left = before.files.find((file) => file.path === indexPath);
  const right = after.files.find((file) => file.path === indexPath);
  if (left === undefined || right === undefined) return left === right;
  return left.kind === right.kind && sameBytes(left.data, right.data);
}

type RecordStageOptions<
  State extends object,
  Metadata extends JsonObject,
  Index extends StateIndex<State, Metadata>,
  Context
> = Readonly<{
  repository: VersionControlRepository;
  revision: RevisionId | null;
  scope: RecordStageScope;
  indexPath: string;
  acquire: (
    phase: "prepare" | "verify",
    previous?: RecordStagePhase<Index, Context>
  ) => Promise<RecordStagePhase<Index, Context>>;
  build: (
    snapshot: StateSnapshot<State, Metadata>
  ) => StateIndexResult<Index> | Promise<StateIndexResult<Index>>;
  serialize: (index: Index) => string;
  prepareDomain: (
    phase: RecordStagePhase<Index, Context>,
    target: Index | null,
    stage: "prepare" | "verify"
  ) => Promise<RecordDomainPreparation>;
}>;

type RecordStagePreparation<Index, Context> = Readonly<{
  phase: RecordStagePhase<Index, Context>;
  target: Index | null;
  indexUpdates: readonly PendingFileUpdate[];
  pending: PendingSnapshot;
  updates: readonly PendingFileUpdate[];
  sourceFiles: readonly VersionControlFile[];
}>;

/** Owns P-base composition, independent fresh phases and exactly one protected publication. */
export async function stageRecordSelection<
  State extends object,
  Metadata extends JsonObject,
  Index extends StateIndex<State, Metadata>,
  Context
>(
  options: RecordStageOptions<State, Metadata, Index, Context>
): Promise<RecordStageResult<Index, Context>> {
  const before = await prepareRecordStage(options, "prepare");
  const after = await prepareRecordStage(options, "verify", before);
  if (!samePendingSnapshots(before.pending, after.pending))
    throw new RecordStageError(
      "pending-conflict",
      "The pending snapshot changed before the write; reread it before retrying"
    );
  if (
    before.phase.workspaceEvidence !== after.phase.workspaceEvidence ||
    !isDeepStrictEqual(before.phase.selectedIds, after.phase.selectedIds) ||
    !isDeepStrictEqual(before.updates, after.updates) ||
    !isDeepStrictEqual(before.sourceFiles, after.sourceFiles)
  )
    throw new RecordStageError(
      "source-drift",
      "The published index, selected sources or required owner bytes, members or representation changed before the pending write"
    );
  try {
    const replacement = await replacePendingSnapshot(options.repository, {
      expectedRevision: options.revision,
      expectedSnapshot: before.pending,
      updates: before.updates
    });
    return { phase: before.phase, updates: before.updates, replacement };
  } catch (error) {
    throw new RecordStagePublicationError(error);
  }
}

async function prepareRecordStage<
  State extends object,
  Metadata extends JsonObject,
  Index extends StateIndex<State, Metadata>,
  Context
>(
  options: RecordStageOptions<State, Metadata, Index, Context>,
  stage: "prepare" | "verify",
  previous?: RecordStagePreparation<Index, Context>
): Promise<RecordStagePreparation<Index, Context>> {
  const acquired = await options.acquire(stage, previous?.phase);
  const phase = sealRecordStagePhase(acquired);
  const equivalent =
    previous !== undefined &&
    sameRecordTargetInputs(previous.phase, phase, options.indexPath);
  const target = equivalent
    ? previous.target
    : await recordTarget(options, phase);
  const domain =
    options.scope === "index"
      ? { pending: phase.pending, updates: [], sourceFiles: [] }
      : await options.prepareDomain(phase, target, stage);
  if (!samePendingSnapshots(phase.pending, domain.pending))
    throw new RecordStageError(
      "pending-conflict",
      "The pending snapshot changed during source preparation"
    );
  const indexUpdates: readonly PendingFileUpdate[] = equivalent
    ? previous.indexUpdates
    : target === null
      ? []
      : [
          {
            path: options.indexPath,
            kind: "regular",
            data: Buffer.from(options.serialize(target), "utf8")
          }
        ];
  const updates = [...domain.updates, ...indexUpdates].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0
  );
  return {
    phase,
    target,
    indexUpdates,
    pending: domain.pending,
    updates,
    sourceFiles: domain.sourceFiles
  };
}

function sealRecordStagePhase<Index, Context>(
  phase: RecordStagePhase<Index, Context>
): RecordStagePhase<Index, Context> {
  return {
    ...phase,
    baseline: phase.baseline === null ? null : Object.freeze(phase.baseline),
    workspace: Object.freeze(phase.workspace),
    pendingIndex:
      phase.pendingIndex === null ? null : Object.freeze(phase.pendingIndex),
    selectedIds: Object.freeze([...phase.selectedIds])
  };
}

/** Fresh actual W bytes and complete policy-equivalent P identify deterministic target input. */
function sameRecordTargetInputs<Index, Context>(
  before: RecordStagePhase<Index, Context>,
  after: RecordStagePhase<Index, Context>,
  indexPath: string
): boolean {
  return (
    after.baseline === before.baseline &&
    sameRecordStagePendingIndex(before.pending, after.pending, indexPath) &&
    sameBytes(before.workspaceBytes, after.workspaceBytes) &&
    isDeepStrictEqual(before.selectedIds, after.selectedIds)
  );
}

async function recordTarget<
  State extends object,
  Metadata extends JsonObject,
  Index extends StateIndex<State, Metadata>,
  Context
>(
  options: Readonly<{
    scope: RecordStageScope;
    build: (
      snapshot: StateSnapshot<State, Metadata>
    ) => StateIndexResult<Index> | Promise<StateIndexResult<Index>>;
  }>,
  phase: RecordStagePhase<Index, Context>
): Promise<Index | null> {
  for (const index of [
    phase.baseline,
    ...(options.scope === "domain" ? [] : [phase.pendingIndex])
  ]) {
    if (
      index !== null &&
      (index.namespace !== phase.workspace.namespace ||
        index.definitionVersion !== phase.workspace.definitionVersion ||
        !isDeepStrictEqual(index.metadata, phase.workspace.metadata) ||
        index.sourceRevision.metadata !==
          phase.workspace.sourceRevision.metadata)
    )
      throw new RecordStageError(
        "collection-changed",
        "Record stage index metadata is incompatible; handle the complete index explicitly"
      );
  }
  if (options.scope === "domain") return null;
  if (phase.baseline !== null && phase.pendingIndex === null)
    throw new RecordStageError(
      "pending-deleted",
      "The pending index was deleted; restore that deletion before stage index/all"
    );
  const target = await options.build(
    selectTargetSnapshot(
      phase.pendingIndex,
      phase.workspace,
      new Set(phase.selectedIds)
    )
  );
  if (target.status === "error")
    throw new RecordStageError(
      "target-invalid",
      "Selected stage dependencies are incomplete; explicitly select the required related IDs or resource owners as well",
      target.diagnostics
    );
  // Both domain builders return normalized recursively frozen members; seal
  // their domain-specific outer projection before handing it to source adapters.
  return Object.freeze(target.value);
}
