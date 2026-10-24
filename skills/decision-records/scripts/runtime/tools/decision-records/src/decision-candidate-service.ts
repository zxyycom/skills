/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-candidate-service.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-candidate-service.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-candidate-service.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { createRecordCandidate } from "../../record-operations/src/candidate.ts";
import { ensureDecisionDirectoryPath } from "./decision-source-path-safety.ts";
import { resolveWorkspaceDecisionLocation } from "./decision-location.ts";
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
import { resolveCandidateRelationSelectors } from "./decision-candidate-relations.ts";
import {
  datedDecisionIdForName,
  decisionNameFromId,
  parseDatedDecisionId,
  sourcePathForDecision,
  utcDecisionDate
} from "./decision-path.ts";
import { decisionIndexFileName } from "./decision-state-index.ts";
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
      const migration = legacyNameConflict(scan, resolved);
      return migration === null ? null : creationFailure(migration);
    },
    allocate: allocateCandidateSourcePath,
    writeAndReadiness: async (scan, resolved, sourcePath) => {
      const result = await publishCandidateCreation(
        resolved,
        path.join(decisionsDirectory, sourcePath),
        sourcePath,
        async (created) => {
          const current =
            await loadCandidateIdentityContext(decisionsDirectory);
          const expected = [
            ...scan.records,
            ...(created
              ? [{ decisionId: resolved.decisionId, sourcePath }]
              : [])
          ];
          const signature = (records: CandidateIdentityContext["records"]) =>
            JSON.stringify(
              [...records].sort((left, right) =>
                left.sourcePath.localeCompare(right.sourcePath)
              )
            );
          if (signature(current.records) !== signature(expected))
            throw new Error(
              "Decision candidate identities changed during creation."
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

function legacyNameConflict(
  scan: CandidateIdentityContext,
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
  scan: CandidateIdentityContext,
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
