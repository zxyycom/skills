import fs from "node:fs/promises";
import path from "node:path";
import {
  decisionDiagnostic,
  decisionFileSystemDiagnostic,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { withDecisionCollectionMutationLock } from "./decision-collection-mutation-lock.ts";
import {
  collectionLockDiagnostic,
  creationFailure,
  completedCandidateCreation,
  publishCandidateCreation
} from "./decision-candidate-publication.ts";
import { validateCandidateCreationRequest } from "./decision-candidate-validation.ts";
import {
  bindRelationSummaries,
  normalizeRelationSummary
} from "./relation-summary.ts";
import {
  datedDecisionIdForName,
  decisionNameFromId,
  parseDatedDecisionId,
  sourcePathForDecision,
  utcDecisionDate
} from "./decision-path.ts";
import { decisionIndexFileName } from "./decision-state-index.ts";
import { scanDecisionRecords } from "./scan.ts";
import type {
  DecisionId,
  DecisionRelation,
  DecisionRelationSummary,
  DecisionScanOptions,
  DecisionTag
} from "./types.ts";

export type NewDecisionCandidateRequest = DecisionScanOptions & {
  background: string;
  decision: string;
  decisionId: DecisionId;
  purpose: string;
  relations: readonly DecisionRelation[];
  relationSummaries?: readonly DecisionRelationSummary[];
  tags: readonly DecisionTag[];
  title: string;
};

export type NewDecisionCandidateResult =
  | DecisionApplicationFailure
  | { created: true; decisionId: DecisionId; sourcePath: string; status: "ok" }
  | (DecisionApplicationFailure & { created: true; sourcePath: string });

export async function createDecisionCandidate(
  request: NewDecisionCandidateRequest
): Promise<NewDecisionCandidateResult> {
  const workspaceRoot = path.resolve(request.workspaceRoot ?? process.cwd());
  const decisionsDirectory = path.resolve(
    workspaceRoot,
    request.decisionsDir ?? "docs/decisions"
  );
  try {
    await fs.mkdir(decisionsDirectory, { recursive: true });
  } catch (error) {
    return creationFailure(
      decisionFileSystemDiagnostic(
        {
          code: "decision-records.new-directory-failed",
          outcome: "no-change",
          reason: "Could not prepare the decision candidate directory.",
          recovery:
            "Make the configured decision directory available as a writable directory, then retry the command.",
          scope: "Decision candidate scaffold",
          target: decisionsDirectory
        },
        error
      )
    );
  }
  try {
    return await withDecisionCollectionMutationLock(
      path.join(decisionsDirectory, decisionIndexFileName),
      async () => await createLockedDecisionCandidate(request)
    );
  } catch (error) {
    const completed = completedCandidateCreation(error, decisionsDirectory);
    if (completed !== null) {
      return completed;
    }
    return creationFailure(collectionLockDiagnostic(error, decisionsDirectory));
  }
}

async function createLockedDecisionCandidate(
  request: NewDecisionCandidateRequest
): Promise<NewDecisionCandidateResult> {
  const scan = await scanDecisionRecords(request);
  const prepared = prepareNewDecisionIdentity(request);
  if (prepared.status === "error") return creationFailure(prepared.diagnostic);
  const resolved = resolveCandidateRelationSelectors(scan, prepared.request);
  if (resolved.status === "error") return creationFailure(resolved.diagnostic);
  const validationFailure = validateCandidateCreationRequest(
    scan,
    resolved.request
  );
  if (validationFailure !== null) return validationFailure;

  const migration = legacyNameConflict(scan, resolved.request);
  if (migration !== null) return creationFailure(migration);

  const sourcePath = allocateCandidateSourcePath(scan, resolved.request);

  return await publishCandidateCreation(
    resolved.request,
    path.join(scan.decisionsDirectory, sourcePath),
    sourcePath
  );
}

function resolveCandidateRelationSelectors(
  scan: Awaited<ReturnType<typeof scanDecisionRecords>>,
  request: NewDecisionCandidateRequest
):
  | { request: NewDecisionCandidateRequest; status: "ok" }
  | { diagnostic: ReturnType<typeof decisionDiagnostic>; status: "error" } {
  const relations: DecisionRelation[] = [];
  for (const relation of request.relations) {
    const normalized = normalizeCandidateRelationSummary(relation.summary);
    if ("error" in normalized)
      return { diagnostic: normalized.error, status: "error" };
    const target = resolveDecisionRelationSelector(scan, relation.target);
    if (target.status === "error") return target;
    relations.push({ ...relation, ...normalized, target: target.decisionId });
  }
  const relationSummaries: DecisionRelationSummary[] = [];
  for (const summary of request.relationSummaries ?? []) {
    const target = resolveDecisionRelationSelector(scan, summary.target);
    if (target.status === "error") return target;
    relationSummaries.push({ ...summary, target: target.decisionId });
  }
  const bound = bindRelationSummaries(relations, relationSummaries);
  if ("error" in bound) {
    return {
      diagnostic: decisionDiagnostic({
        code: "decision-records.new-relation-summary-invalid",
        outcome: "no-change",
        reason: bound.error,
        recovery:
          "Provide each --relation-summary target once in this command's complete relation set, then retry.",
        scope: "Decision candidate scaffold",
        target: "--relation-summary"
      }),
      status: "error"
    };
  }
  return {
    request: { ...request, relations: bound.relations, relationSummaries: [] },
    status: "ok"
  };
}

function normalizeCandidateRelationSummary(
  summary: unknown
): { summary?: string } | { error: ReturnType<typeof decisionDiagnostic> } {
  if (summary === undefined) return {};
  const normalized = normalizeRelationSummary(summary);
  if (!("issue" in normalized)) return normalized;
  return {
    error: decisionDiagnostic({
      code: "decision-records.new-relation-summary-invalid",
      outcome: "no-change",
      reason: "Candidate relation summary " + normalized.issue,
      recovery:
        "Use a blank or trimmed single-line summary of at most 40 Unicode code points, then retry.",
      scope: "Decision candidate scaffold",
      target: "relation.summary"
    })
  };
}

function resolveDecisionRelationSelector(
  scan: Awaited<ReturnType<typeof scanDecisionRecords>>,
  selector: DecisionId
):
  | { decisionId: DecisionId; status: "ok" }
  | { diagnostic: ReturnType<typeof decisionDiagnostic>; status: "error" } {
  const dated = parseDatedDecisionId(selector);
  const matches =
    dated === null
      ? scan.records
          .filter(
            (record) =>
              typeof record.decisionId === "string" &&
              decisionNameFromId(record.decisionId as DecisionId) === selector
          )
          .map((record) => record.decisionId as DecisionId)
          .sort()
      : scan.records
          .filter((record) => record.decisionId === dated.id)
          .map((record) => record.decisionId as DecisionId);
  if (matches.length === 1) return { decisionId: matches[0]!, status: "ok" };
  return {
    diagnostic: decisionDiagnostic({
      code:
        matches.length === 0
          ? "decision-records.new-relation-target-missing"
          : "decision-records.new-relation-target-ambiguous",
      outcome: "no-change",
      reason:
        matches.length === 0
          ? "Candidate relation target does not exist: " + selector
          : "Candidate relation target is ambiguous: " +
            selector +
            "; choose one standard ID: " +
            matches.join(", "),
      recovery:
        matches.length === 0
          ? "Choose an existing direct predecessor Decision ID or unique name, then retry the command."
          : "Retry with one listed calendar-valid YYMMDD-name Decision ID.",
      scope: "Decision candidate scaffold",
      target: selector
    }),
    status: "error"
  };
}

function prepareNewDecisionIdentity(
  request: NewDecisionCandidateRequest
):
  | { request: NewDecisionCandidateRequest; status: "ok" }
  | { diagnostic: ReturnType<typeof decisionDiagnostic>; status: "error" } {
  const dated = parseDatedDecisionId(request.decisionId);
  const today = utcDecisionDate();
  if (dated !== null) {
    if (dated.date !== today) {
      return {
        diagnostic: decisionDiagnostic({
          code: "decision-records.new-formation-date-mismatch",
          outcome: "no-change",
          reason:
            "Decision ID date must match the authoritative UTC candidate formation date: " +
            today,
          recovery:
            "Provide the semantic name only, or provide the standard ID for today's UTC date.",
          scope: "Decision candidate scaffold",
          target: request.decisionId
        }),
        status: "error"
      };
    }
    return { request, status: "ok" };
  }
  const decisionId = datedDecisionIdForName(request.decisionId, today);
  if (decisionId === null) {
    return {
      diagnostic: decisionDiagnostic({
        code: "decision-records.new-name-invalid",
        outcome: "no-change",
        reason: "Decision name is invalid: " + request.decisionId,
        recovery:
          "Provide lowercase kebab-case semantic text or a calendar-valid YYMMDD-name Decision ID.",
        scope: "Decision candidate scaffold",
        target: request.decisionId
      }),
      status: "error"
    };
  }
  return { request: { ...request, decisionId }, status: "ok" };
}

function legacyNameConflict(
  scan: Awaited<ReturnType<typeof scanDecisionRecords>>,
  request: NewDecisionCandidateRequest
): ReturnType<typeof decisionDiagnostic> | null {
  const name = decisionNameFromId(request.decisionId);
  const legacy = scan.records.find(
    (record) =>
      parseDatedDecisionId(record.decisionId) === null &&
      decisionNameFromId(record.decisionId as DecisionId) === name
  );
  if (legacy === undefined) return null;
  return decisionDiagnostic({
    code: "decision-records.migration-required",
    outcome: "no-change",
    reason:
      "Creating " +
      request.decisionId +
      " would make legacy Decision " +
      legacy.decisionId +
      " ambiguous by name.",
    recovery:
      "First run the rename preflight for " +
      legacy.decisionId +
      " and rename it to a dated ID, then retry new for " +
      request.decisionId +
      ".",
    scope: "Decision candidate scaffold",
    target: legacy.decisionId
  });
}

function allocateCandidateSourcePath(
  scan: Awaited<ReturnType<typeof scanDecisionRecords>>,
  request: NewDecisionCandidateRequest
): ReturnType<typeof sourcePathForDecision> {
  const name = decisionNameFromId(request.decisionId);
  const nameCandidate = sourcePathForDecision(name, "candidate");
  const nameArchive = sourcePathForDecision(name, "archived");
  const occupied = new Set(scan.records.map((record) => record.sourcePath));
  return occupied.has(nameCandidate) || occupied.has(nameArchive)
    ? sourcePathForDecision(request.decisionId, "candidate")
    : nameCandidate;
}
