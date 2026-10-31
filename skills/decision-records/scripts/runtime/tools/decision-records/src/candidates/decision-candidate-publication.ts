/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/candidates/decision-candidate-publication.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/candidates/decision-candidate-publication.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/candidates/decision-candidate-publication.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { isDecisionId } from "../collection/decision-path.ts";
import type { DecisionId } from "../types.ts";
import { validateDecisionBody } from "../records/record.ts";
import path from "node:path";
import { runRecordTransaction } from "../../../record-operations/src/transactions/transaction.ts";
import {
  RecordAtomicCleanupError,
  readRecordFileSnapshot,
  writeRecordFileAtomically
} from "../../../record-operations/src/transactions/transaction-files.ts";
import {
  decisionDiagnostic,
  decisionFileSystemDiagnostic,
  decisionFailure,
  type DecisionMutationOutcome,
  type DecisionApplicationFailure
} from "../application-result.ts";
import { DecisionCollectionLockError } from "../collection/decision-collection-mutation-lock.ts";
import { serializeDecisionFrontmatter } from "../records/decision-metadata.ts";
import type {
  NewDecisionCandidateRequest,
  NewDecisionCandidateResult
} from "./decision-candidate-service.ts";

export async function publishCandidateCreation(
  request: NewDecisionCandidateRequest,
  decisionPath: string,
  sourcePath: string,
  verifyIdentities: (created: boolean) => Promise<void>
): Promise<NewDecisionCandidateResult> {
  const markdown = candidateScaffoldMarkdown(request);
  const invalid = await validateCandidateScaffold(
    request,
    sourcePath,
    markdown
  );
  if (invalid !== null) return creationFailure(invalid);
  const root = path.resolve(request.workspaceRoot ?? process.cwd());
  const result = await runRecordTransaction({
    prepare: async () => {
      const before = await readRecordFileSnapshot(root, decisionPath);
      if (before !== null)
        throw new Error(
          "Decision candidate target already exists: " + sourcePath
        );
      const indexPath = path.join(
        path.dirname(decisionPath),
        "decision-index.json"
      );
      const indexBefore = await readRecordFileSnapshot(root, indexPath);
      return {
        value: sourcePath,
        root,
        index: null,
        writes: [
          {
            path: decisionPath,
            before,
            next: Buffer.from(markdown),
            creationMode: 0o666,
            write: async (target: string, bytes: Uint8Array) =>
              writeRecordFileAtomically(
                root,
                {
                  path: target,
                  before: null,
                  next: bytes,
                  creationMode: 0o666
                },
                path.dirname(path.dirname(decisionPath))
              )
          }
        ],
        guards: [{ path: indexPath, before: indexBefore }]
      };
    },
    fresh: () => verifyIdentities(false),
    verify: () => verifyIdentities(true),
    verifyRecovered: () => verifyIdentities(false)
  });
  const facts = {
    changed: result.changed,
    committed: result.committed,
    verification: result.verification
  };
  if (result.status === "ok")
    return {
      ...facts,
      created: true,
      decisionId: request.decisionId,
      sourcePath,
      status: "ok"
    };
  const diagnostics = [
    ...result.errors.map((error) =>
      creationDiagnostic(error, sourcePath, result.outcome, false, root)
    ),
    ...result.cleanupErrors.map((error) =>
      creationDiagnostic(error, sourcePath, result.outcome, true, root)
    )
  ];
  const failure = { ...decisionFailure(diagnostics), ...facts };
  return result.changed
    ? { ...failure, created: true, decisionId: request.decisionId, sourcePath }
    : failure;
}

function creationDiagnostic(
  error: unknown,
  sourcePath: string,
  outcome: DecisionMutationOutcome,
  cleanup: boolean,
  workspaceRoot: string
) {
  return decisionFileSystemDiagnostic(
    {
      code: cleanup
        ? "decision-records.new-staging-cleanup-failed"
        : "decision-records.new-publish-failed",
      outcome,
      reason: cleanup
        ? "Decision candidate was published but temporary cleanup failed."
        : "Decision candidate publication or verification failed.",
      recovery:
        "Inspect the actual candidate sourcePath and reported cleanup state before running another mutation.",
      scope: "Decision candidate scaffold",
      target:
        error instanceof RecordAtomicCleanupError
          ? path
              .relative(workspaceRoot, error.temporaryPath)
              .split(path.sep)
              .join("/")
          : sourcePath
    },
    error
  );
}

async function validateCandidateScaffold(
  request: NewDecisionCandidateRequest,
  sourcePath: string,
  markdown: string
): Promise<ReturnType<typeof decisionDiagnostic> | null> {
  const errors: string[] = [];
  const validated = await validateDecisionBody({
    body: markdown,
    decisionId: request.decisionId,
    sourcePath,
    errors,
    targetExists: (target) =>
      request.relations.some((relation) => relation.target === target)
  });
  if (validated === null || errors.length > 0)
    return decisionDiagnostic({
      code: "decision-records.new-input-invalid",
      outcome: "no-change",
      reason: errors.join("; ") || "Candidate scaffold input is invalid.",
      recovery: "Correct the candidate fields before retrying.",
      target: request.decisionId
    });
  return null;
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

export function completedCandidateCreation(
  error: unknown,
  decisionsDirectory: string
):
  | (DecisionApplicationFailure & {
      created: true;
      decisionId: DecisionId;
      sourcePath: string;
    })
  | null {
  const completed = releasedCandidateCreation(error);
  if (completed === null) return null;
  const diagnostic = collectionLockDiagnostic(
    error,
    decisionsDirectory,
    completed.status === "ok"
      ? "committed-cleanup-pending"
      : (completed.diagnostics.find((entry) => entry.outcome !== undefined)
          ?.outcome ?? "committed-cleanup-pending")
  );
  return completed.status === "ok"
    ? { ...completed, ...creationFailure(diagnostic) }
    : appendCompletedCreationDiagnostic(completed, diagnostic);
}

function releasedCandidateCreation(error: unknown):
  | (DecisionApplicationFailure & {
      created: true;
      decisionId: DecisionId;
      sourcePath: string;
    })
  | { created: true; decisionId: DecisionId; sourcePath: string; status: "ok" }
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

function isCreatedCandidateResult(value: unknown): value is
  | (DecisionApplicationFailure & {
      created: true;
      decisionId: DecisionId;
      sourcePath: string;
    })
  | {
      created: true;
      decisionId: DecisionId;
      sourcePath: string;
      status: "ok";
    } {
  if (value === null || typeof value !== "object") return false;
  if (!("decisionId" in value) || !isDecisionId(value.decisionId)) return false;
  if (!("sourcePath" in value) || typeof value.sourcePath !== "string")
    return false;
  if (!("created" in value) || value.created !== true) return false;
  return (
    "status" in value && (value.status === "ok" || value.status === "error")
  );
}

function appendCompletedCreationDiagnostic(
  failure: DecisionApplicationFailure & {
    created: true;
    decisionId: DecisionId;
    sourcePath: string;
  },
  diagnostic: ReturnType<typeof collectionLockDiagnostic>
): DecisionApplicationFailure & {
  created: true;
  decisionId: DecisionId;
  sourcePath: string;
} {
  return {
    ...failure,
    diagnostics: [...failure.diagnostics, diagnostic],
    errors: [...failure.errors, diagnostic.reason]
  };
}

export function collectionLockDiagnostic(
  error: unknown,
  decisionsDirectory: string,
  outcome: DecisionMutationOutcome = "no-change"
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
          : error.kind === "release-failed"
            ? "Inspect the actual candidate and remaining lock before running another mutation."
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

export function creationFailure(
  diagnostic: Parameters<typeof decisionFailure>[0][number]
): DecisionApplicationFailure {
  return decisionFailure([diagnostic]);
}
