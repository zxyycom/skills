import { createRecordCandidate } from "../../../record-operations/src/candidate.ts";
import { ensureDecisionDirectoryPath } from "../sources/decision-source-path-safety.ts";
import { resolveWorkspaceDecisionLocation } from "../collection/decision-location.ts";
import fs from "node:fs/promises";
import path from "node:path";
import {
  decisionDiagnostic,
  decisionFileSystemDiagnostic,
  type DecisionApplicationFailure
} from "../application-result.ts";
import { withDecisionCollectionMutationLock } from "../collection/decision-collection-mutation-lock.ts";
import {
  collectionLockDiagnostic,
  creationFailure,
  completedCandidateCreation,
  publishCandidateCreation
} from "./decision-candidate-publication.ts";
import { validateCandidateCreationRequest } from "./decision-candidate-validation.ts";
import { resolveCandidateRelationSelectors } from "./decision-candidate-relations.ts";
import {
  datedDecisionIdForName,
  parseDatedDecisionId,
  sourcePathForDecision,
  utcDecisionDate
} from "../collection/decision-path.ts";
import { decisionIndexFileName } from "../index/decision-state-index.ts";
import {
  loadCandidateIdentityContext,
  type CandidateIdentityContext
} from "./decision-candidate-context.ts";

import type {
  DecisionId,
  DecisionRelation,
  DecisionRelationSummary,
  DecisionScanOptions,
  DecisionTag
} from "../types.ts";

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

export type NewDecisionCandidateResult = {
  changed?: boolean;
  committed?: boolean;
  verification?: "passed" | "failed-or-unknown" | "not-run";
} & (
  | DecisionApplicationFailure
  | {
      created: true;
      decisionId: DecisionId;
      sourcePath: string;
      status: "ok";
      warnings?: readonly string[];
    }
  | (DecisionApplicationFailure & {
      created: true;
      decisionId: DecisionId;
      sourcePath: string;
    })
);

export async function createDecisionCandidate(
  request: NewDecisionCandidateRequest
): Promise<NewDecisionCandidateResult> {
  const directory = await prepareCandidateDirectory(request);
  if (directory.status === "error") return directory;
  const { decisionsDirectory } = directory;
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

async function prepareCandidateDirectory(
  request: NewDecisionCandidateRequest
): Promise<
  DecisionApplicationFailure | { status: "ok"; decisionsDirectory: string }
> {
  const location = resolveWorkspaceDecisionLocation({
    cwd: request.workspaceRoot ?? process.cwd(),
    ...(request.decisionsDir === undefined
      ? {}
      : { decisionsDir: request.decisionsDir })
  });
  if (location.error !== undefined)
    return creationFailure(
      decisionDiagnostic({
        code: location.error.code,
        outcome: "no-change",
        reason: location.error.message,
        recovery:
          "Choose a workspace-relative decision directory within the workspace root.",
        target: "Decision candidate directory"
      })
    );
  const workspaceRoot = path.resolve(request.workspaceRoot ?? process.cwd());
  const decisionsDirectory = path.resolve(
    workspaceRoot,
    request.decisionsDir ?? "docs/decisions"
  );
  try {
    await ensureDecisionDirectoryPath(workspaceRoot, decisionsDirectory, true);
    await fs.mkdir(decisionsDirectory, { recursive: true });
    await ensureDecisionDirectoryPath(workspaceRoot, decisionsDirectory);
  } catch (error) {
    return candidateDirectoryFailure(error, decisionsDirectory);
  }
  return { status: "ok", decisionsDirectory };
}

async function createLockedDecisionCandidate(
  request: NewDecisionCandidateRequest
): Promise<NewDecisionCandidateResult> {
  const decisionsDirectory = path.resolve(
    request.workspaceRoot ?? process.cwd(),
    request.decisionsDir ?? "docs/decisions"
  );
  return await createRecordCandidate<
    CandidateIdentityContext,
    NewDecisionCandidateRequest,
    NewDecisionCandidateResult
  >({
    discover: async () => ({
      status: "ok",
      value: await loadCandidateIdentityContext(decisionsDirectory)
    }),
    resolve: (scan) => {
      const prepared = prepareNewDecisionIdentity(request);
      if (prepared.status === "error")
        return {
          status: "error",
          result: creationFailure(prepared.diagnostic)
        };
      const resolved = resolveCandidateRelationSelectors(
        scan,
        prepared.request
      );
      return resolved.status === "error"
        ? { status: "error", result: creationFailure(resolved.diagnostic) }
        : { status: "ok", value: resolved.request };
    },
    conflict: (scan, resolved) => {
      const invalid = validateCandidateCreationRequest(scan, resolved);
      if (invalid !== null) return invalid;
      return null;
    },
    allocate: allocateCandidateSourcePath,
    writeAndReadiness: async (scan, resolved, sourcePath) => {
      const result = await publishCandidateCreation(
        resolved,
        path.join(decisionsDirectory, sourcePath),
        sourcePath,
        async () => {
          // The creation primitive protects the exclusive target and reads back its bytes.
          // Only the published snapshot is shared state; unrelated candidates are not guards.
          const current = await loadCandidateIdentityContext(
            decisionsDirectory,
            []
          );
          if (
            JSON.stringify(current.collection.formal) !==
            JSON.stringify(scan.collection.formal)
          )
            throw new Error(
              "Decision published identities changed during creation."
            );
        }
      );
      return result.status === "ok"
        ? { ...result, warnings: scan.collection.warnings }
        : result;
    }
  });
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

function allocateCandidateSourcePath(
  _scan: CandidateIdentityContext,
  request: NewDecisionCandidateRequest
): ReturnType<typeof sourcePathForDecision> {
  return sourcePathForDecision(request.decisionId, "candidate");
}

function candidateDirectoryFailure(
  error: unknown,
  decisionsDirectory: string
): DecisionApplicationFailure {
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
