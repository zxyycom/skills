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
  | { created: true; sourcePath: string; status: "ok" }
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
  const validationFailure = validateCandidateCreationRequest(scan, request);
  if (validationFailure !== null) return validationFailure;

  return await publishCandidateCreation(
    request,
    path.join(scan.decisionsDirectory, request.decisionId)
  );
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
  decisionPath: string
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
  return { created: true, sourcePath: request.decisionId, status: "ok" };
}

function candidateScaffoldMarkdown(
  request: NewDecisionCandidateRequest
): string {
  return (
    serializeDecisionFrontmatter(
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
