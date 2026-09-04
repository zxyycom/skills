import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  decisionDiagnostic,
  decisionFileSystemDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  DecisionCollectionLockError,
  withDecisionCollectionMutationLock
} from "./decision-collection-mutation-lock.ts";
import { serializeDecisionFrontmatter } from "./decision-metadata.ts";
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
  DecisionScanOptions,
  DecisionTag
} from "./types.ts";

export type NewDecisionCandidateRequest = DecisionScanOptions & {
  background: string;
  decision: string;
  decisionId: DecisionId;
  purpose: string;
  relations: readonly DecisionRelation[];
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
    const target = resolveDecisionRelationSelector(scan, relation.target);
    if (target.status === "error") return target;
    relations.push({ ...relation, target: target.decisionId });
  }
  return { request: { ...request, relations }, status: "ok" };
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

function validateCandidateCreationRequest(
  scan: Awaited<ReturnType<typeof scanDecisionRecords>>,
  request: NewDecisionCandidateRequest
): NewDecisionCandidateResult | null {
  if (
    !scan.decisionsDirectoryAvailable ||
    scan.collectionErrors.length > 0 ||
    scan.sourceErrors.length > 0
  ) {
    return creationFailure(
      decisionDiagnostic({
        code: "decision-records.new-collection-invalid",
        outcome: "no-change",
        reason:
          scan.collectionErrors[0] ??
          scan.sourceErrors[0] ??
          "The decision candidate collection is unavailable.",
        recovery:
          "Correct the reported decision collection problem, then retry the command.",
        scope: "Decision candidate scaffold",
        target: scan.decisionsDirectory
      })
    );
  }
  if (scan.records.some((record) => record.decisionId === request.decisionId)) {
    return creationFailure(
      decisionDiagnostic({
        code: "decision-records.new-identity-conflict",
        outcome: "no-change",
        reason:
          "Decision ID already exists in the current collection: " +
          request.decisionId,
        recovery:
          "Choose a new Decision ID or continue the existing candidate; do not rerun new for the same identity.",
        scope: "Decision candidate scaffold",
        target: request.decisionId
      })
    );
  }
  return candidateRelationFailure(scan, request);
}

function candidateRelationFailure(
  scan: Awaited<ReturnType<typeof scanDecisionRecords>>,
  request: NewDecisionCandidateRequest
): NewDecisionCandidateResult | null {
  for (const relation of request.relations) {
    if (relation.target === request.decisionId) {
      return creationFailure(
        decisionDiagnostic({
          code: "decision-records.new-relation-invalid",
          outcome: "no-change",
          reason: "A candidate cannot relate to itself: " + relation.target,
          recovery:
            "Choose an existing direct predecessor Decision ID, then retry the command.",
          scope: "Decision candidate scaffold",
          target: request.decisionId
        })
      );
    }
    if (!scan.records.some((record) => record.decisionId === relation.target)) {
      return creationFailure(
        decisionDiagnostic({
          code: "decision-records.new-relation-target-missing",
          outcome: "no-change",
          reason:
            "Candidate relation target does not exist: " + relation.target,
          recovery:
            "Choose an existing direct predecessor Decision ID, then retry the command.",
          scope: "Decision candidate scaffold",
          target: relation.target
        })
      );
    }
  }
  return null;
}

async function publishCandidateCreation(
  request: NewDecisionCandidateRequest,
  decisionPath: string,
  sourcePath: ReturnType<typeof sourcePathForDecision>
): Promise<NewDecisionCandidateResult> {
  const markdown = candidateScaffoldMarkdown(request);
  let published: CandidatePublication;
  try {
    published = await publishNewDecisionCandidate(decisionPath, markdown);
  } catch (error) {
    return creationFailure(
      decisionFileSystemDiagnostic(
        {
          code: "decision-records.new-publish-failed",
          outcome: "no-change",
          reason:
            "Could not publish the decision candidate scaffold without overwriting an existing identity.",
          recovery:
            "Inspect the candidate path and collection, then retry with an unused Decision ID if no candidate was created.",
          scope: "Decision candidate scaffold",
          target: request.decisionId
        },
        error
      )
    );
  }
  if (published.cleanupPending) {
    return completedCreationFailure(
      request.decisionId,
      decisionFileSystemDiagnostic(
        {
          code: "decision-records.new-staging-cleanup-failed",
          outcome: "committed-cleanup-pending",
          reason:
            "The decision candidate scaffold was created, but its private staging file could not be removed.",
          recovery:
            "Keep the created scaffold, inspect the reported staging path, and remove only that private staging file before another mutation.",
          scope: "Decision candidate scaffold",
          target: published.stagingPath
        },
        published.cleanupError
      )
    );
  }
  return {
    created: true,
    decisionId: request.decisionId,
    sourcePath,
    status: "ok"
  };
}

function candidateScaffoldMarkdown(
  request: NewDecisionCandidateRequest
): string {
  return (
    serializeDecisionFrontmatter(
      request.decisionId,
      {
        background: request.background,
        decision: request.decision,
        purpose: request.purpose,
        relations: request.relations.map(({ target, type }) => ({
          target,
          type
        })),
        title: request.title
      },
      [...request.tags].sort((left, right) => left.localeCompare(right)),
      { alignment: null, createdAt: null, status: "candidate" }
    ) + "## 目的\n\n## 背景\n\n## 决策\n"
  );
}

async function publishNewDecisionCandidate(
  decisionPath: string,
  markdown: string
): Promise<CandidatePublication> {
  const decisionsDirectory = path.dirname(decisionPath);
  const stagingDirectory = path.dirname(decisionsDirectory);
  const [decisionsStats, stagingStats] = await Promise.all([
    fs.stat(decisionsDirectory),
    fs.stat(stagingDirectory)
  ]);
  if (decisionsStats.dev !== stagingStats.dev) {
    throw new Error(
      "candidate staging directory is not on the decision collection filesystem"
    );
  }
  const temporaryPath = path.join(
    stagingDirectory,
    ".decision-records-candidate-" +
      path.basename(decisionPath) +
      ".new-" +
      randomUUID()
  );
  let operationError: unknown = null;
  try {
    await fs.writeFile(temporaryPath, markdown, {
      encoding: "utf8",
      flag: "wx"
    });
    await fs.link(temporaryPath, decisionPath);
  } catch (error) {
    operationError = error;
  }
  try {
    await fs.rm(temporaryPath, { force: true });
  } catch (cleanupError) {
    if (operationError === null) {
      return {
        cleanupError,
        cleanupPending: true,
        stagingPath: temporaryPath
      };
    }
  }
  if (operationError !== null) {
    throw operationError;
  }
  return {
    cleanupError: null,
    cleanupPending: false,
    stagingPath: temporaryPath
  };
}

type CandidatePublication = {
  cleanupError: unknown;
  cleanupPending: boolean;
  stagingPath: string;
};

function completedCandidateCreation(
  error: unknown,
  decisionsDirectory: string
): (DecisionApplicationFailure & { created: true; sourcePath: string }) | null {
  if (!(error instanceof DecisionCollectionLockError)) {
    return null;
  }
  const completed = error.operationResult;
  if (
    error.kind !== "release-failed" ||
    completed === null ||
    typeof completed !== "object" ||
    !("sourcePath" in completed) ||
    typeof completed.sourcePath !== "string" ||
    !("status" in completed) ||
    !("created" in completed) ||
    completed.created !== true
  ) {
    return null;
  }
  if (completed.status === "ok") {
    return completedCreationFailure(
      completed.sourcePath,
      collectionLockDiagnostic(
        error,
        decisionsDirectory,
        "committed-cleanup-pending"
      )
    );
  }
  if (completed.status === "error") {
    const failure = completed as DecisionApplicationFailure & {
      created: true;
      sourcePath: string;
    };
    return {
      ...failure,
      diagnostics: [
        ...failure.diagnostics,
        collectionLockDiagnostic(
          error,
          decisionsDirectory,
          "committed-cleanup-pending"
        )
      ]
    };
  }
  return null;
}

function collectionLockDiagnostic(
  error: unknown,
  decisionsDirectory: string,
  outcome: "committed-cleanup-pending" | "no-change" = "no-change"
) {
  if (error instanceof DecisionCollectionLockError) {
    return decisionDiagnostic({
      code:
        "decision-records.collection-lock-" +
        (error.kind === "busy" ? "busy" : error.kind),
      ...(error.kind === "access-denied"
        ? { causeCategory: "access-denied" as const }
        : error.kind === "busy"
          ? { causeCategory: "busy" as const }
          : {}),
      outcome,
      reason:
        error.kind === "release-failed"
          ? "The decision candidate create operation finished, but its collection lock could not be released."
          : "The decision candidate create operation could not acquire its collection lock.",
      recovery:
        error.kind === "busy"
          ? "Wait for or confirm the active transaction; only if none is active, inspect the remaining lock before retrying."
          : "Inspect access to the decision collection, then retry the command.",
      scope: "Decision candidate scaffold",
      target: decisionsDirectory
    });
  }
  return decisionFileSystemDiagnostic(
    {
      code: "decision-records.new-lock-failed",
      outcome: "no-change",
      reason: "Could not create the decision candidate scaffold.",
      recovery: "Inspect the decision collection, then retry the command.",
      scope: "Decision candidate scaffold",
      target: decisionsDirectory
    },
    error
  );
}

function completedCreationFailure(
  sourcePath: string,
  diagnostic: Parameters<typeof decisionFailure>[0][number]
): DecisionApplicationFailure & { created: true; sourcePath: string } {
  return { ...creationFailure(diagnostic), created: true, sourcePath };
}

function creationFailure(
  diagnostic: Parameters<typeof decisionFailure>[0][number]
): DecisionApplicationFailure {
  return decisionFailure([diagnostic]);
}
