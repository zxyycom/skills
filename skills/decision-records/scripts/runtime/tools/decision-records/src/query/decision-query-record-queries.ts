/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/query/decision-query-record-queries.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/query/decision-query-record-queries.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/query/decision-query-record-queries.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  type RecordShowFailure,
  showPublishedRecord
} from "../../../record-operations/src/query.ts";
import {
  createDecisionStateIndexDefinition,
  decisionIndexFileName
} from "../index/decision-index-definition.ts";
import { decisionIdFromMarkdown } from "../records/decision-metadata.ts";
import {
  decisionIndexDiagnostics,
  decisionIndexRecovery
} from "../index/decision-index-diagnostics.ts";
import type { DecisionIndexSnapshot } from "../index/decision-index-snapshot.ts";
import { decisionPublishedSnapshotSource } from "./decision-query-contract.ts";
import {
  decisionDiagnostic,
  decisionFailure,
  decisionFileSystemDiagnostic
} from "../application-result.ts";
import { readCandidateSelection } from "../candidates/decision-candidate-context.ts";
import {
  normalizeDecisionSelectorInput,
  isDecisionId,
  parseDatedDecisionId
} from "../collection/decision-path.ts";
import type {
  DecisionId,
  DecisionTraceDirection,
  DecisionIndexState
} from "../types.ts";
import {
  loadDecisionQueryContext,
  persistedSnapshotBodyWarning
} from "./decision-query-context.ts";
import { decisionSourceRevision } from "../index/decision-state-index.ts";
import type {
  DecisionTraceEntry,
  IndexedDecisionRecord,
  DecisionQueryRequest,
  DecisionQueryResult
} from "./decision-query-contract.ts";
import {
  decisionIndexRecordSnapshot,
  indexedRecord,
  selectorNotFound,
  candidateRecords
} from "./decision-query-records.ts";
import { resolveIndexedDecisionSelector } from "./decision-query-selectors.ts";
import { traceDecisionRelations } from "../relations/relation-graph.ts";

export async function showDecisionRecord(
  request: Extract<DecisionQueryRequest, { command: "show" }>
): Promise<DecisionQueryResult> {
  const shown = await showPublishedRecord({
    workspaceRoot: request.location.workspaceRoot,
    collection: request.location.decisionsDir,
    definition: createDecisionStateIndexDefinition(),
    indexPath: decisionIndexFileName,
    selector: request.decisionId,
    normalizeSelector: normalizeDecisionSelectorInput,
    datedSelectorId: (selector) => parseDatedDecisionId(selector)?.id ?? null,
    idFromMarkdown: decisionIdFromMarkdown,
    sourceFingerprint: ({ id, sourcePath, text }) => {
      if (!isDecisionId(id))
        throw new Error("validated Decision ID is invalid");
      return decisionSourceRevision([{ decisionId: id, sourcePath, text }])
        .entries[id]!;
    }
  });
  if (shown.status === "ok")
    return {
      body: shown.text,
      command: "show",
      record: indexedRecord({ id: shown.id, state: shown.state }),
      status: "ok",
      warnings: shown.stale ? [persistedSnapshotBodyWarning] : []
    };
  return decisionShowFailure(shown);
}

function decisionShowFailure(
  shown: RecordShowFailure<DecisionIndexState>
): DecisionQueryResult {
  if (shown.phase === "location")
    return decisionFailure([
      shown.error instanceof Error
        ? shown.error.message
        : "Decision collection could not be safely resolved"
    ]);
  if (shown.phase === "index")
    return decisionFailure(
      decisionIndexDiagnostics(shown.diagnostics, {
        code: "decision-records.index-query-failed",
        recovery: decisionIndexRecovery(
          shown.diagnostics,
          "Run sync-index after correcting the decision Markdown or index problem."
        ),
        target: decisionIndexFileName
      })
    );
  if (shown.phase === "selection") return decisionShowSelectionFailure(shown);
  return decisionFailure([
    decisionFileSystemDiagnostic(
      {
        code: "decision-records.decision-body-unavailable",
        reason: `Failed to read decision body ${shown.state.sourcePath}.`,
        recovery:
          "Restore a readable regular decision Markdown file, then retry the command.",
        target: shown.state.sourcePath
      },
      shown.error
    )
  ]);
}

function decisionShowSelectionFailure(
  shown: Extract<RecordShowFailure<DecisionIndexState>, { phase: "selection" }>
): DecisionQueryResult {
  return shown.matches.length === 0
    ? selectorNotFound("Established decision", shown.normalized)
    : decisionFailure(
        [
          decisionDiagnostic({
            code: "decision-records.decision-ambiguous",
            reason: `Established decision name is ambiguous: ${shown.normalized}; choose one standard ID: ${shown.matches.join(", ")}`,
            recovery:
              "Retry with one listed calendar-valid YYMMDD-name Decision ID.",
            target: shown.normalized
          })
        ],
        { presentation: "plain" }
      );
}

export async function showDecisionCandidate(
  request: Extract<DecisionQueryRequest, { command: "show-candidate" }>
): Promise<DecisionQueryResult> {
  let selected;
  try {
    selected = await readCandidateSelection(
      request.location,
      request.decisionId
    );
  } catch (error) {
    return decisionFailure([String(error)]);
  }
  const record = candidateRecords(selected)[0];
  if (record === undefined)
    return decisionFailure([
      "Selected Decision source is not a valid candidate scaffold: " +
        request.decisionId
    ]);
  return {
    body: selected.sourceById.get(record.decisionId)!,
    command: "show-candidate",
    record,
    status: "ok",
    warnings: selected.sourceErrors
  };
}

export async function traceDecisionRecord(
  request: Extract<DecisionQueryRequest, { command: "trace" }>
): Promise<DecisionQueryResult> {
  const options = normalizeTraceOptions(request);
  if (options.status === "error") return options.failure;
  const context = await loadDecisionQueryContext(request.location, true);
  if (context.status === "error") return context;
  const resolved = resolveIndexedDecisionSelector(
    context,
    request.decisionId,
    "Established decision"
  );
  if (resolved.status === "error") return resolved.failure;
  const relationErrors = context.relationErrors();
  if (relationErrors.length > 0) return decisionFailure(relationErrors);
  const traced = traceDecisionResult(
    context,
    resolved.record.decisionId,
    options
  );
  return { ...traced, warnings: context.warnings };
}

function traceDecisionResult(
  snapshot: DecisionIndexSnapshot,
  anchorId: DecisionId,
  options: Extract<ReturnType<typeof normalizeTraceOptions>, { status: "ok" }>
): Extract<DecisionQueryResult, { command: "trace"; status: "ok" }> {
  const { direction, maxDepth, maxRecords } = options;
  const records = decisionIndexRecordSnapshot(snapshot).records;
  const trace = traceDecisionRelations(snapshot.getRelationGraph, anchorId, {
    direction,
    maxDepth,
    maxRecords
  });
  const recordById = new Map(
    records.map((record) => [record.decisionId, record])
  );
  return {
    anchorId,
    command: "trace",
    source: decisionPublishedSnapshotSource,
    contextIds: trace.contextIds,
    coverage: trace.coverage,
    direction,
    entries: traceEntries(recordById, [...trace.traceIds, ...trace.contextIds]),
    frontier: trace.frontier,
    ...(trace.blockedEvent === undefined
      ? {}
      : { blockedEvent: trace.blockedEvent }),
    limits: {
      depth: maxDepth === null ? "all" : maxDepth,
      maxRecords
    },
    status: "ok",
    traceIds: trace.traceIds,
    warnings: []
  };
}

function normalizeTraceOptions(
  request: Extract<DecisionQueryRequest, { command: "trace" }>
):
  | {
      direction: DecisionTraceDirection;
      maxDepth: number | null;
      maxRecords: number;
      status: "ok";
    }
  | { failure: DecisionQueryResult; status: "error" } {
  const issues: string[] = [];
  const direction = request.direction ?? "both";
  const maxDepth = request.maxDepth === undefined ? 5 : request.maxDepth;
  const maxRecords = request.maxRecords ?? 50;
  if (
    direction !== "both" &&
    direction !== "predecessors" &&
    direction !== "successors"
  ) {
    issues.push("direction must be predecessors, successors, or both");
  }
  if (maxDepth !== null && (!Number.isSafeInteger(maxDepth) || maxDepth < 0)) {
    issues.push("maxDepth must be a non-negative safe integer or null");
  }
  if (!Number.isSafeInteger(maxRecords) || maxRecords < 1) {
    issues.push("maxRecords must be a positive safe integer");
  }
  if (issues.length > 0) {
    return {
      failure: decisionFailure(
        issues.map((reason) =>
          decisionDiagnostic({
            code: "decision-records.trace-options-invalid",
            reason,
            recovery: "Correct the Decision trace options, then retry.",
            target: "Decision trace options"
          })
        ),
        { exitCode: 2 }
      ),
      status: "error"
    };
  }
  return {
    direction,
    maxDepth,
    maxRecords,
    status: "ok"
  };
}

function traceEntries(
  recordById: ReadonlyMap<string, IndexedDecisionRecord>,
  decisionIds: readonly string[]
): Record<string, DecisionTraceEntry> {
  return Object.fromEntries(
    [...new Set(decisionIds)].sort().map((decisionId) => {
      const record = recordById.get(decisionId);
      if (record === undefined) {
        throw new TypeError(
          "Trace selected an unknown Decision: " + decisionId
        );
      }
      return [
        decisionId,
        {
          title: record.projection.title,
          status: record.status,
          alignment: record.alignment,
          createdAt: record.createdAt,
          purpose: record.projection.purpose,
          background: record.projection.background,
          decision: record.projection.decision,
          tags: [...record.tags],
          relations: record.projection.relations.map((relation) => ({
            ...relation
          }))
        }
      ];
    })
  );
}
