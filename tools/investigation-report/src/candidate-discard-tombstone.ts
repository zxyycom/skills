import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  diagnosticFromError,
  genericInvestigationDiagnostic
} from "./diagnostics.ts";
import {
  type CandidateResourceTree,
  scanResourceTree
} from "./candidate-discard-resources.ts";
import {
  discardMutation,
  result,
  sameResourceTree,
  uniqueSorted
} from "./candidate-discard-support.ts";
import type { CandidateDiscardPreparation } from "./candidate-discard.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import type {
  InvestigationCandidateDiscardOptions,
  InvestigationCandidateDiscardResult
} from "./types.ts";

export async function discardPreparedCandidate(
  input: InvestigationCandidateDiscardOptions,
  root: string,
  preparation: CandidateDiscardPreparation
): Promise<InvestigationCandidateDiscardResult> {
  const tombstone = candidateDiscardTombstone(input, root, preparation);
  const moved = await moveCandidateToTombstone(preparation, tombstone);
  if (moved.status === "error") {
    return candidateTombstoneMoveFailure(input, moved);
  }
  return await finishCandidateTombstoneDiscard(input, preparation, tombstone);
}

type CandidateDiscardTombstone = Readonly<{
  candidatePath: string;
  resourceOwnerPath: string;
  trash: string;
  trashCandidate: string;
  trashResources: string;
}>;

function candidateDiscardTombstone(
  input: InvestigationCandidateDiscardOptions,
  root: string,
  preparation: CandidateDiscardPreparation
): CandidateDiscardTombstone {
  const trash = path.join(
    path.dirname(root),
    `.investigation-candidate-discard-${randomUUID()}`
  );
  const trashCandidate = path.join(trash, "candidate");
  const trashResources = path.join(trash, "resources");
  const resourceOwnerPath = path.join(
    root,
    investigationResourcesDirectoryName,
    input.id
  );
  return {
    candidatePath: preparation.candidatePath,
    resourceOwnerPath,
    trash,
    trashCandidate,
    trashResources
  };
}

async function moveCandidateToTombstone(
  preparation: CandidateDiscardPreparation,
  tombstone: CandidateDiscardTombstone
): Promise<
  | { status: "ok" }
  | {
      error: unknown;
      outcome: "partial-or-unknown" | "rolled-back";
      restoreErrors: string[];
      status: "error";
    }
> {
  let movedCandidate = false;
  let movedResources = false;
  try {
    await fs.mkdir(tombstone.trash, { mode: 0o700 });
    await fs.rename(preparation.candidatePath, tombstone.trashCandidate);
    movedCandidate = true;
    movedResources = await moveCandidateResourcesToTombstone(
      preparation.resources,
      tombstone
    );
  } catch (error) {
    const restoreErrors = await restoreTombstone({
      candidatePath: tombstone.candidatePath,
      movedCandidate,
      movedResources,
      resourceOwnerPath: tombstone.resourceOwnerPath,
      trash: tombstone.trash,
      trashCandidate: tombstone.trashCandidate,
      trashResources: tombstone.trashResources
    });
    const outcome =
      restoreErrors.length === 0 ? "rolled-back" : "partial-or-unknown";
    return { error, outcome, restoreErrors, status: "error" };
  }
  return { status: "ok" };
}

async function moveCandidateResourcesToTombstone(
  resources: CandidateResourceTree,
  tombstone: CandidateDiscardTombstone
): Promise<boolean> {
  if (resources.resourceIds.length === 0) return false;
  await fs.rename(tombstone.resourceOwnerPath, tombstone.trashResources);
  const afterMove = await scanResourceTree(
    tombstone.trashResources,
    path.basename(tombstone.resourceOwnerPath)
  );
  if (!sameResourceTree(resources, afterMove)) {
    throw new Error(
      "owner resource members changed while being moved to tombstone"
    );
  }
  return true;
}

function candidateTombstoneMoveFailure(
  input: InvestigationCandidateDiscardOptions,
  failure: Extract<
    Awaited<ReturnType<typeof moveCandidateToTombstone>>,
    { status: "error" }
  >
): InvestigationCandidateDiscardResult {
  return result(
    input,
    false,
    [],
    [
      "candidate discard failed before its commit point",
      ...failure.restoreErrors
    ],
    {
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.discard-candidate-publish-failed",
          error: failure.error,
          mutation: discardMutation(failure.outcome),
          reason:
            "the candidate and confirmed owner resources could not be moved to their tombstone",
          recovery:
            failure.outcome === "rolled-back"
              ? "correct the reported failure, then retry discard-candidate"
              : "stop mutations and reconcile the candidate and owner resource paths before retrying",
          target: input.id
        })
      ],
      mutation: discardMutation(failure.outcome)
    }
  );
}

async function finishCandidateTombstoneDiscard(
  input: InvestigationCandidateDiscardOptions,
  preparation: CandidateDiscardPreparation,
  tombstone: CandidateDiscardTombstone
): Promise<InvestigationCandidateDiscardResult> {
  const cleanupErrors = await cleanTombstone({
    candidatePath: tombstone.trashCandidate,
    resources: preparation.resources,
    resourcesPath: tombstone.trashResources,
    trash: tombstone.trash
  });
  return result(input, true, preparation.resources.resourceIds, cleanupErrors, {
    diagnostics:
      cleanupErrors.length === 0
        ? []
        : [
            genericInvestigationDiagnostic({
              code: "investigation-report.discard-candidate-cleanup-pending",
              mutation: discardMutation("committed-cleanup-pending"),
              reason:
                "the candidate discard committed, but the exact tombstone cleanup could not finish",
              recovery:
                "inspect and remove only the reported tombstone residue before another mutation",
              target: tombstone.trash
            })
          ],
    mutation:
      cleanupErrors.length === 0
        ? undefined
        : discardMutation("committed-cleanup-pending")
  });
}

async function restoreTombstone(options: {
  candidatePath: string;
  movedCandidate: boolean;
  movedResources: boolean;
  resourceOwnerPath: string;
  trash: string;
  trashCandidate: string;
  trashResources: string;
}): Promise<string[]> {
  const errors: string[] = [];
  if (options.movedResources) {
    try {
      await fs.rename(options.trashResources, options.resourceOwnerPath);
    } catch {
      errors.push("failed to restore candidate owner resources");
    }
  }
  if (options.movedCandidate) {
    try {
      await fs.rename(options.trashCandidate, options.candidatePath);
    } catch {
      errors.push("failed to restore investigation candidate");
    }
  }
  await fs.rmdir(options.trash).catch(() => undefined);
  return uniqueSorted(errors);
}

async function cleanTombstone(options: {
  candidatePath: string;
  resources: CandidateResourceTree;
  resourcesPath: string;
  trash: string;
}): Promise<string[]> {
  const errors: string[] = [];
  try {
    if (options.resources.resourceIds.length > 0) {
      for (const id of [...options.resources.resourceIds].reverse()) {
        const relative = id.split("/").slice(1);
        await fs.unlink(path.join(options.resourcesPath, ...relative));
      }
      for (const directory of [...options.resources.directories].sort(
        (left, right) => right.length - left.length
      )) {
        await fs.rmdir(path.join(options.resourcesPath, directory));
      }
    }
    await fs.unlink(options.candidatePath);
    await fs.rmdir(options.trash);
  } catch {
    errors.push(`candidate tombstone cleanup is pending at ${options.trash}`);
  }
  return errors;
}
