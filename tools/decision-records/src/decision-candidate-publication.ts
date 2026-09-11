import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  decisionDiagnostic,
  decisionFileSystemDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { DecisionCollectionLockError } from "./decision-collection-mutation-lock.ts";
import { serializeDecisionFrontmatter } from "./decision-metadata.ts";
import type {
  NewDecisionCandidateRequest,
  NewDecisionCandidateResult
} from "./decision-candidate-service.ts";

export async function publishCandidateCreation(
  request: NewDecisionCandidateRequest,
  decisionPath: string,
  sourcePath: string
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
        relations: request.relations.map((relation) => ({ ...relation })),
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
  const temporaryPath = await candidateTemporaryPath(decisionPath);
  return publishCandidateFile(temporaryPath, decisionPath, markdown);
}

async function candidateTemporaryPath(decisionPath: string): Promise<string> {
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
  return path.join(
    stagingDirectory,
    ".decision-records-candidate-" +
      path.basename(decisionPath) +
      ".new-" +
      randomUUID()
  );
}

async function publishCandidateFile(
  temporaryPath: string,
  decisionPath: string,
  markdown: string
): Promise<CandidatePublication> {
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
  const cleanupError = await removeCandidateStagingFile(temporaryPath);
  if (operationError !== null) throw operationError;
  return cleanupError === null
    ? { cleanupError: null, cleanupPending: false, stagingPath: temporaryPath }
    : { cleanupError, cleanupPending: true, stagingPath: temporaryPath };
}

async function removeCandidateStagingFile(
  temporaryPath: string
): Promise<Error | null> {
  try {
    await fs.rm(temporaryPath, { force: true });
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

type CandidatePublication = {
  cleanupError: Error | null;
  cleanupPending: boolean;
  stagingPath: string;
};

export function completedCandidateCreation(
  error: unknown,
  decisionsDirectory: string
): (DecisionApplicationFailure & { created: true; sourcePath: string }) | null {
  const completed = releasedCandidateCreation(error);
  if (completed === null) return null;
  const diagnostic = collectionLockDiagnostic(
    error,
    decisionsDirectory,
    "committed-cleanup-pending"
  );
  return completed.status === "ok"
    ? completedCreationFailure(completed.sourcePath, diagnostic)
    : appendCompletedCreationDiagnostic(completed, diagnostic);
}

function releasedCandidateCreation(
  error: unknown
):
  | (DecisionApplicationFailure & { created: true; sourcePath: string })
  | { created: true; sourcePath: string; status: "ok" }
  | null {
  if (
    !(error instanceof DecisionCollectionLockError) ||
    error.kind !== "release-failed"
  )
    return null;
  return isCreatedCandidateResult(error.operationResult)
    ? error.operationResult
    : null;
}

function isCreatedCandidateResult(
  value: unknown
): value is
  | (DecisionApplicationFailure & { created: true; sourcePath: string })
  | { created: true; sourcePath: string; status: "ok" } {
  if (value === null || typeof value !== "object") return false;
  if (!("sourcePath" in value) || typeof value.sourcePath !== "string")
    return false;
  if (!("created" in value) || value.created !== true) return false;
  return (
    "status" in value && (value.status === "ok" || value.status === "error")
  );
}

function appendCompletedCreationDiagnostic(
  failure: DecisionApplicationFailure & { created: true; sourcePath: string },
  diagnostic: ReturnType<typeof collectionLockDiagnostic>
): DecisionApplicationFailure & { created: true; sourcePath: string } {
  return { ...failure, diagnostics: [...failure.diagnostics, diagnostic] };
}

export function collectionLockDiagnostic(
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
  diagnostic: ReturnType<typeof collectionLockDiagnostic>
): DecisionApplicationFailure & { created: true; sourcePath: string } {
  return { ...creationFailure(diagnostic), created: true, sourcePath };
}

export function creationFailure(
  diagnostic: Parameters<typeof decisionFailure>[0][number]
): DecisionApplicationFailure {
  return decisionFailure([diagnostic]);
}
