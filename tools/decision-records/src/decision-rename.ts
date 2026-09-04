import path from "node:path";
import {
  openVersionControl,
  VersionControlError
} from "../../shared/src/version-control/index.ts";
import {
  decisionAttention,
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { loadDecisionHistoryBaseline } from "./decision-history-baseline.ts";
import { serializeDecisionFrontmatter } from "./decision-metadata.ts";
import {
  datedDecisionIdForName,
  decisionNameFromId,
  parseDatedDecisionId,
  sourcePathForDecisionRename,
  utcDecisionDate
} from "./decision-path.ts";
import {
  DecisionCollectionLockError,
  withDecisionCollectionMutationLock
} from "./decision-collection-mutation-lock.ts";
import {
  applyLockedDecisionChanges,
  type DecisionFileChange
} from "./decision-transaction.ts";
import { loadDecisionValidationContext } from "./index.ts";
import { scanDecisionRecords } from "./scan.ts";
import {
  compareDecisionRecords,
  isDecisionCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionCandidateRecord,
  type EstablishedDecisionRecord,
  type DecisionId,
  type DecisionRecord,
  type DecisionScan,
  type DecisionScanOptions,
  type DecisionSourcePath
} from "./types.ts";

export type DecisionRenameOptions = DecisionScanOptions &
  Readonly<{
    preflight?: boolean;
    renameRecordedDecision?: boolean;
    source: string;
    target: string;
  }>;

export type DecisionRenamePlan = Readonly<{
  affectedCandidateRelationCount: number;
  affectedEstablishedRelationCount: number;
  newId: string;
  newName: string;
  newSourcePath: string;
  oldId: string;
  oldName: string;
  oldSourcePath: string;
  outcome: "preflight" | "ready";
}>;

/** Public rename diagnostics stay portable with the generated SDK bundle. */
export type DecisionRenameDiagnostic = Readonly<{
  causeCategory?:
    | "access-denied"
    | "busy"
    | "command-failed"
    | "not-found"
    | "not-repository"
    | "revision-unavailable"
    | "tool-unavailable"
    | "unknown";
  code: string;
  detail?: string | null;
  outcome?:
    | "committed-cleanup-pending"
    | "no-change"
    | "partial-or-unknown"
    | "rolled-back";
  reason: string;
  recovery: string;
  scope?: string;
  target: string;
}>;

export type DecisionRenameFailure = Readonly<{
  diagnostics: DecisionRenameDiagnostic[];
  errors: string[];
  exitCode: 1 | 2;
  plan: null;
  presentation: "command" | "plain";
  status: "error";
}>;

export type DecisionRenameAttention = Readonly<{
  diagnostics: DecisionRenameDiagnostic[];
  exitCode: 1;
  plan: DecisionRenamePlan;
  status: "attention";
  warnings: string[];
}>;

export type DecisionRenameCommittedCleanup = Readonly<{
  changed: true;
  diagnostics: DecisionRenameDiagnostic[];
  errors: [];
  exitCode: 1;
  outcome: "committed-cleanup-pending";
  plan: DecisionRenamePlan;
  status: "attention";
  warnings: string[];
}>;

export type DecisionRenameResult =
  | DecisionRenameFailure
  | DecisionRenameAttention
  | DecisionRenameCommittedCleanup
  | Readonly<{
      changed: boolean;
      diagnostics: [];
      errors: [];
      outcome: "committed" | "preflight";
      plan: DecisionRenamePlan;
      status: "ok";
    }>;

type PreparedDecisionRename = Readonly<{
  changes: readonly DecisionFileChange[];
  plan: DecisionRenamePlan;
  source: RenameableDecisionRecord;
}>;

const decisionRenameScope =
  "Decision Markdown files and derived decision index";

/** Renames one Decision identity and every managed relation that targets it. */
export async function renameDecisionRecord(
  options: DecisionRenameOptions
): Promise<DecisionRenameResult> {
  if (options.preflight === true) {
    const prepared = await prepareDecisionRenameAtCurrentState(options, false);
    if (prepared.status !== "ready") return prepared;
    return {
      changed: false,
      diagnostics: [],
      errors: [],
      outcome: "preflight",
      plan: { ...prepared.value.plan, outcome: "preflight" },
      status: "ok"
    };
  }
  const initial = await scanDecisionRecords(options);
  try {
    return await withDecisionCollectionMutationLock(
      initial.indexPath,
      async () => await applyDecisionRenameWithinLock(options)
    );
  } catch (error) {
    const completed = completedDecisionRenameWithLockCleanup(error);
    if (completed !== null) return completed;
    return {
      ...decisionFailure([
        decisionDiagnostic({
          code: "decision-records.rename-lock-failed",
          outcome: "no-change",
          reason: "Decision rename could not acquire its collection lock.",
          recovery:
            "Wait for the active transaction or inspect the collection lock before retrying rename.",
          scope: decisionRenameScope,
          target: "Decision collection mutation lock"
        })
      ]),
      plan: null
    };
  }
}

function completedDecisionRenameWithLockCleanup(
  error: unknown
): DecisionRenameCommittedCleanup | null {
  if (
    !(error instanceof DecisionCollectionLockError) ||
    error.kind !== "release-failed"
  ) {
    return null;
  }
  const result = error.operationResult;
  if (
    result === null ||
    typeof result !== "object" ||
    !("status" in result) ||
    result.status !== "ok" ||
    !("changed" in result) ||
    result.changed !== true ||
    !("outcome" in result) ||
    result.outcome !== "committed" ||
    !("plan" in result)
  ) {
    return null;
  }
  const plan = result.plan;
  if (
    plan === null ||
    typeof plan !== "object" ||
    !("oldId" in plan) ||
    !("newId" in plan)
  ) {
    return null;
  }
  const diagnostic = decisionDiagnostic({
    code: "decision-records.collection-lock-release-failed",
    outcome: "committed-cleanup-pending",
    reason:
      "Decision rename committed, but its collection lock could not be released.",
    recovery:
      "Verify the renamed Decision collection, then inspect the remaining lock before running another mutation.",
    scope: decisionRenameScope,
    target: "Decision collection mutation lock"
  });
  return {
    changed: true,
    diagnostics: [diagnostic],
    errors: [],
    exitCode: 1,
    outcome: "committed-cleanup-pending",
    plan: plan as DecisionRenamePlan,
    status: "attention",
    warnings: [diagnostic.reason]
  };
}

async function applyDecisionRenameWithinLock(
  options: DecisionRenameOptions
): Promise<DecisionRenameResult> {
  const prepared = await prepareDecisionRenameAtCurrentState(options, true);
  if (prepared.status !== "ready") return prepared;
  const current = await scanDecisionRecords(options);
  const transaction = await applyLockedDecisionChanges({
    changes: prepared.value.changes,
    originalScan: current,
    scanOptions: options
  });
  if (transaction.status === "error") {
    return { ...decisionFailure(transaction.diagnostics), plan: null };
  }
  return {
    changed: transaction.changed,
    diagnostics: [],
    errors: [],
    outcome: "committed",
    plan: prepared.value.plan,
    status: "ok"
  };
}

type PreparedRenameStep =
  | DecisionApplicationFailure
  | Readonly<{ status: "ready"; value: PreparedDecisionRename }>;

async function prepareDecisionRenameAtCurrentState(
  options: DecisionRenameOptions,
  requireConfirmation: boolean
): Promise<
  DecisionRenameResult | Extract<PreparedRenameStep, { status: "ready" }>
> {
  const { result } = await loadDecisionValidationContext(options, {
    allowEmptyDecisionSet: true
  });
  if (result.errors.length > 0) {
    return {
      ...decisionFailure(
        result.errors.map((reason) =>
          decisionDiagnostic({
            code: "decision-records.rename-collection-invalid",
            outcome: "no-change",
            reason,
            recovery:
              "Correct the Decision collection and derived index before retrying rename.",
            scope: decisionRenameScope,
            target: "Decision rename"
          })
        )
      ),
      plan: null
    };
  }
  const prepared = prepareDecisionRename(result.scan, options);
  if (prepared.status !== "ready") return { ...prepared, plan: null };
  const history = await loadDecisionHistoryBaseline(result.scan);
  if (history.status === "error") return { ...history, plan: null };
  const pending = await pendingDecisionRenameFailure(result.scan);
  if (pending !== null) return { ...pending, plan: null };
  const recorded =
    history.baseline.kind === "git-head" &&
    history.baseline.recordedDecisionIds.has(prepared.value.source.decisionId);
  if (
    requireConfirmation &&
    recorded &&
    options.renameRecordedDecision !== true
  ) {
    return {
      ...decisionAttention([
        decisionDiagnostic({
          code: "decision-records.rename-recorded-decision-confirmation-required",
          outcome: "no-change",
          reason:
            "Decision " +
            prepared.value.plan.oldId +
            " has entered Git HEAD; confirm that its recorded identity should be renamed.",
          recovery:
            "Re-run with --rename-recorded-decision only after confirming this working-tree rename; Git history is not rewritten.",
          scope: decisionRenameScope,
          target: prepared.value.plan.oldId
        })
      ]),
      plan: prepared.value.plan
    };
  }
  return prepared;
}

/**
 * `stage` owns a complete pending collection snapshot. Rename does not stage
 * on the caller's behalf, so it must reject that snapshot rather than leave
 * its old identity in Git's pending view.
 */
async function pendingDecisionRenameFailure(
  scan: DecisionScan
): Promise<DecisionApplicationFailure | null> {
  try {
    const repository = await openVersionControl(scan.decisionsDirectory);
    const revision = await repository.getCurrentRevision();
    const scope = repositoryRelativeDecisionScope(
      repository.rootDirectory,
      scan.decisionsDirectory
    );
    if (scope === null) return null;
    const changed =
      revision === null
        ? await repository.readPendingFiles({ pathScopes: [scope] })
        : await repository.listPendingChangedPaths({
            from: revision,
            pathScopes: [scope]
          });
    if (changed.length === 0) return null;
    return renameFailure(
      "decision-records.rename-pending-stage-conflict",
      "Decision pending snapshot already contains collection files; rename would leave its old identity in that staged view.",
      "Inspect or resolve the Decision pending snapshot, then retry rename without relying on automatic staging.",
      scan.indexRelativePath
    );
  } catch (error) {
    if (
      error instanceof VersionControlError &&
      error.code === "not-repository"
    ) {
      return null;
    }
    return renameFailure(
      "decision-records.rename-pending-stage-inspection-failed",
      "Decision pending snapshot could not be inspected before rename.",
      "Correct the version-control failure, then retry rename; no files were changed.",
      scan.indexRelativePath
    );
  }
}

function repositoryRelativeDecisionScope(
  repositoryRoot: string,
  decisionsDirectory: string
): string | null {
  const relative = path.relative(repositoryRoot, decisionsDirectory);
  if (
    relative.length === 0 ||
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`)
  ) {
    return null;
  }
  return relative.split(path.sep).join("/");
}

function prepareDecisionRename(
  scan: DecisionScan,
  options: DecisionRenameOptions
): PreparedRenameStep {
  const source = resolveRenameSource(scan, options.source);
  if (source.status !== "ok") return source;
  const target = resolveRenameTarget(
    source.record,
    scan.records,
    options.target
  );
  if (target.status !== "ok") return target;
  const relations = rewrittenDecisionChanges(
    scan.records,
    source.record,
    target.value
  );
  const sourceChange = relations.find(
    (change) => change.decisionPath === source.record.decisionPath
  );
  if (sourceChange === undefined) {
    throw new Error("Decision rename did not prepare its selected source");
  }
  const candidateRelations = scan.records
    .filter(isDecisionCandidateRecord)
    .flatMap((record) => record.source.document.relations)
    .filter((relation) => relation.target === source.record.decisionId).length;
  const establishedRelations = scan.records
    .filter(isEstablishedDecisionRecord)
    .flatMap((record) => record.source.document.relations)
    .filter((relation) => relation.target === source.record.decisionId).length;
  return {
    status: "ready",
    value: {
      changes: relations,
      plan: {
        affectedCandidateRelationCount: candidateRelations,
        affectedEstablishedRelationCount: establishedRelations,
        newId: target.value.decisionId,
        newName: target.value.name,
        newSourcePath: target.value.sourcePath,
        oldId: source.record.decisionId,
        oldName: decisionNameFromId(source.record.decisionId),
        oldSourcePath: source.record.sourcePath,
        outcome: "ready"
      },
      source: source.record
    }
  };
}

type RenameableDecisionRecord =
  | DecisionCandidateRecord
  | EstablishedDecisionRecord;

function resolveRenameSource(
  scan: DecisionScan,
  rawSource: string
):
  | Readonly<{ record: RenameableDecisionRecord; status: "ok" }>
  | DecisionApplicationFailure {
  const normalized = rawSource.replace(/\.md$/iu, "");
  const dated = parseDatedDecisionId(normalized);
  const records = scan.records.filter(
    (record): record is RenameableDecisionRecord =>
      isDecisionCandidateRecord(record) || isEstablishedDecisionRecord(record)
  );
  const matches =
    dated === null
      ? records.filter(
          (record) => decisionNameFromId(record.decisionId) === normalized
        )
      : records.filter((record) => record.decisionId === dated.id);
  if (matches.length === 1) return { record: matches[0]!, status: "ok" };
  const reason =
    matches.length === 0
      ? "Decision rename source does not exist: " + normalized
      : "Decision rename source is ambiguous: " +
        normalized +
        "; choose one standard ID: " +
        matches
          .map((record) => record.decisionId)
          .sort()
          .join(", ");
  return decisionFailure([
    decisionDiagnostic({
      code:
        matches.length === 0
          ? "decision-records.rename-source-not-found"
          : "decision-records.rename-source-ambiguous",
      outcome: "no-change",
      reason,
      recovery:
        matches.length === 0
          ? "Choose an existing standard Decision ID or unique name."
          : "Retry with one listed calendar-valid YYMMDD-name Decision ID.",
      scope: decisionRenameScope,
      target: normalized
    })
  ]);
}

type RenameTarget = Readonly<{
  decisionId: DecisionId;
  name: string;
  sourcePath: DecisionSourcePath;
}>;

function resolveRenameTarget(
  source: RenameableDecisionRecord,
  records: readonly DecisionRecord[],
  rawTarget: string
):
  | Readonly<{ status: "ok"; value: RenameTarget }>
  | DecisionApplicationFailure {
  const normalized = rawTarget.replace(/\.md$/iu, "");
  const explicit = parseDatedDecisionId(normalized);
  const sourceDated = parseDatedDecisionId(source.decisionId);
  const expectedDate =
    sourceDated?.date ??
    (source.source.kind === "established" && source.createdAt !== null
      ? utcDecisionDate(new Date(source.createdAt))
      : null);
  if (
    source.source.kind === "candidate" &&
    sourceDated === null &&
    explicit === null
  ) {
    return renameFailure(
      "decision-records.rename-date-required",
      "A legacy Decision candidate has no authoritative formation date for a name rename.",
      "Provide a complete calendar-valid YYMMDD-name target ID to explicitly choose the migration date.",
      normalized
    );
  }
  if (
    explicit !== null &&
    expectedDate !== null &&
    explicit.date !== expectedDate
  ) {
    return renameFailure(
      "decision-records.rename-date-mismatch",
      "Target Decision ID date must match the source's authoritative date: " +
        expectedDate,
      "Use the source date with the intended semantic name.",
      normalized
    );
  }
  const decisionId =
    explicit?.id ??
    (expectedDate === null
      ? null
      : datedDecisionIdForName(normalized, expectedDate));
  if (decisionId === null) {
    return renameFailure(
      "decision-records.rename-target-invalid",
      "Decision rename target must be a semantic name or calendar-valid YYMMDD-name ID: " +
        normalized,
      "Use lowercase kebab-case text, or a complete dated Decision ID.",
      normalized
    );
  }
  const name = decisionNameFromId(decisionId);
  const otherRecords = records.filter(
    (record) => record.decisionPath !== source.decisionPath
  );
  if (otherRecords.some((record) => record.decisionId === decisionId)) {
    return renameFailure(
      "decision-records.rename-id-conflict",
      "Target Decision ID already exists: " + decisionId,
      "Choose an unused dated Decision ID.",
      decisionId
    );
  }
  if (
    otherRecords.some((record) =>
      isDecisionCandidateRecord(record) || isEstablishedDecisionRecord(record)
        ? decisionNameFromId(record.decisionId) === name
        : false
    )
  ) {
    return renameFailure(
      "decision-records.rename-name-conflict",
      "Target Decision name already exists in the current collection: " + name,
      "Choose a unique semantic name or resolve the existing record first.",
      name
    );
  }
  const occupied = new Set(otherRecords.map((record) => record.sourcePath));
  const status = source.status;
  if (status === null) {
    return renameFailure(
      "decision-records.rename-source-invalid",
      "Decision rename source has no valid lifecycle status: " +
        source.sourcePath,
      "Correct the Decision source before retrying rename.",
      source.sourcePath
    );
  }
  const sourcePath = sourcePathForDecisionRename(
    decisionId,
    name,
    status,
    occupied
  );
  if (sourcePath === null) {
    return renameFailure(
      "decision-records.rename-path-conflict",
      "Both name and ID target paths are occupied for Decision " + decisionId,
      "Free one listed target path or choose a different name; no files were changed.",
      decisionId
    );
  }
  return { status: "ok", value: { decisionId, name, sourcePath } };
}

function renameFailure(
  code: string,
  reason: string,
  recovery: string,
  target: string
): DecisionApplicationFailure {
  return decisionFailure([
    decisionDiagnostic({
      code,
      outcome: "no-change",
      reason,
      recovery,
      scope: decisionRenameScope,
      target
    })
  ]);
}

function rewrittenDecisionChanges(
  records: readonly DecisionRecord[],
  source: RenameableDecisionRecord,
  target: RenameTarget
): DecisionFileChange[] {
  const changes: DecisionFileChange[] = [];
  for (const record of [...records].sort(compareDecisionRecords)) {
    if (
      !isDecisionCandidateRecord(record) &&
      !isEstablishedDecisionRecord(record)
    )
      continue;
    const isSource = record.decisionPath === source.decisionPath;
    const relations = record.source.document.relations.map((relation) => ({
      ...relation,
      target:
        relation.target === source.decisionId
          ? target.decisionId
          : relation.target
    }));
    const relationChanged = relations.some(
      (relation, index) =>
        relation.target !== record.source.document.relations[index]?.target
    );
    if (!isSource && !relationChanged) continue;
    const decisionId = isSource ? target.decisionId : record.decisionId;
    const nextText =
      serializeDecisionFrontmatter(
        decisionId,
        { ...record.source.document, relations },
        record.source.document.tags,
        record.source.document
      ) + record.source.body;
    changes.push({
      decisionPath: record.decisionPath,
      expectedText: record.source.text,
      nextText,
      ...(isSource && target.sourcePath !== record.sourcePath
        ? {
            targetPath: path.join(
              record.sourcePath.startsWith("archive/")
                ? path.dirname(path.dirname(record.decisionPath))
                : path.dirname(record.decisionPath),
              ...target.sourcePath.split("/")
            )
          }
        : {})
    });
  }
  return changes;
}
