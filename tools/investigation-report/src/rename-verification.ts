import path from "node:path";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import type { PreparedRename } from "./rename-contract.ts";
import {
  asFormalSource,
  inspectLayout,
  readCandidateSources
} from "./rename-preparation.ts";
import { errorText, lstatOrNull, readRegularText } from "./rename-support.ts";
import { syncInvestigationStateIndex } from "./investigation-state-index.ts";
import { collectValidatedInvestigationCollection } from "./validation.ts";

export async function verifyPreparedRename(
  root: string,
  prepared: PreparedRename
): Promise<string[]> {
  const errors = await verifyPreparedSources(prepared);
  await verifyPreparedTarget(root, prepared, errors);
  await verifyPreparedIndex(prepared, errors);
  await verifyPreparedResourceTarget(prepared, errors);
  return errors;
}

async function verifyPreparedSources(
  prepared: PreparedRename
): Promise<string[]> {
  const errors: string[] = [];
  for (const source of prepared.originalSources) {
    try {
      if ((await readRegularText(source.filePath)) !== source.text) {
        errors.push(
          `${source.id} changed after rename validation; no files were written`
        );
      }
    } catch (error) {
      errors.push(
        `${source.id} could not be re-read before rename: ${errorText(error)}`
      );
    }
  }
  return errors;
}

async function verifyPreparedTarget(
  root: string,
  prepared: PreparedRename,
  errors: string[]
): Promise<void> {
  const nextPath = path.join(root, prepared.plan.newSourcePath);
  if (
    nextPath !== prepared.sourceBefore.filePath &&
    (await lstatOrNull(nextPath)) !== null
  ) {
    errors.push(
      `Investigation rename target path already exists: ${prepared.plan.newSourcePath}`
    );
  }
}

async function verifyPreparedIndex(
  prepared: PreparedRename,
  errors: string[]
): Promise<void> {
  if (prepared.oldIndexText === null) return;
  try {
    if ((await readRegularText(prepared.indexPath)) !== prepared.oldIndexText) {
      errors.push(
        "investigation index changed after rename validation; no files were written"
      );
    }
  } catch (error) {
    errors.push(
      "investigation index could not be re-read before rename: " +
        errorText(error)
    );
  }
}

async function verifyPreparedResourceTarget(
  prepared: PreparedRename,
  errors: string[]
): Promise<void> {
  if (
    prepared.resourceMove !== null &&
    (await lstatOrNull(prepared.resourceMove.to)) !== null
  ) {
    errors.push(
      "Investigation resource owner target appeared after rename validation"
    );
  }
}

export async function verifyCommittedRename(
  root: string,
  prepared: PreparedRename
): Promise<readonly string[]> {
  const collection = await collectValidatedInvestigationCollection(root, {
    allowEmptyCollection: true
  });
  if (collection.errors.length > 0) return collection.errors;
  const candidateRead = await readCurrentCandidates(root, prepared.indexPath);
  if (candidateRead.errors !== null) return candidateRead.errors;
  if (await indexIsStale(root, collection))
    return ["investigation index is stale after rename"];
  return await retiredIdentityErrors(root, prepared, [
    ...collection.sources.map((source) => asFormalSource(root, source)),
    ...candidateRead.candidates
  ]);
}

async function readCurrentCandidates(
  root: string,
  indexPath: string
): Promise<
  Readonly<{
    candidates: readonly import("./rename-contract.ts").RenameSource[];
    errors: readonly string[] | null;
  }>
> {
  const layout = await inspectLayout(root, indexPath);
  if ("result" in layout)
    return { candidates: [], errors: layout.result.errors };
  const candidates = await readCandidateSources(
    root,
    layout.value.candidateIds
  );
  return "result" in candidates
    ? { candidates: [], errors: candidates.result.errors }
    : { candidates: candidates.value, errors: null };
}

async function indexIsStale(
  root: string,
  collection: Awaited<
    ReturnType<typeof collectValidatedInvestigationCollection>
  >
): Promise<boolean> {
  if (collection.snapshot === null || collection.sources.length === 0)
    return false;
  const freshness = await syncInvestigationStateIndex({
    investigationsDirectory: root,
    mode: "check",
    snapshot: collection.snapshot
  });
  return freshness.status === "error";
}

async function retiredIdentityErrors(
  root: string,
  prepared: PreparedRename,
  sources: readonly import("./rename-contract.ts").RenameSource[]
): Promise<readonly string[]> {
  const oldId = prepared.plan.oldId;
  const identityChanged = oldId !== prepared.plan.newId;
  const oldPathExists =
    prepared.plan.oldSourcePath !== prepared.plan.newSourcePath
      ? await lstatOrNull(path.join(root, prepared.plan.oldSourcePath))
      : null;
  const oldOwnerExists = identityChanged
    ? await lstatOrNull(
        path.join(root, investigationResourcesDirectoryName, oldId)
      )
    : null;
  const referenced =
    identityChanged &&
    sources.some((source) => referencesOldIdentity(source, oldId));
  return referenced || oldPathExists !== null || oldOwnerExists !== null
    ? [
        "current managed Investigation content still references the old identity after rename"
      ]
    : [];
}

function referencesOldIdentity(
  source: import("./rename-contract.ts").RenameSource,
  oldId: string
): boolean {
  return (
    source.id === oldId ||
    source.document.relations.some((relation) => relation.target === oldId) ||
    source.text.includes(`](./_resources/${oldId}/`)
  );
}
