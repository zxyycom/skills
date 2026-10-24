import type { RecordVerificationPhase } from "../../record-operations/src/transaction-verification.ts";
import { requireRecordTextSnapshot } from "../../record-operations/src/transaction-snapshot.ts";
import path from "node:path";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import type { PreparedRename } from "./rename-contract.ts";
import { errorText, lstatOrNull, readRegularText } from "./rename-support.ts";

export async function verifyPreparedRename(
  root: string,
  prepared: PreparedRename,
  phase: RecordVerificationPhase
): Promise<string[]> {
  const errors = await verifyPreparedSources(root, prepared, phase);
  await verifyPreparedTarget(root, prepared, errors);
  await verifyPreparedIndex(root, prepared, phase, errors);
  await verifyPreparedResourceTarget(prepared, errors);
  return errors;
}

async function verifyPreparedSources(
  root: string,
  prepared: PreparedRename,
  phase: RecordVerificationPhase
): Promise<string[]> {
  const errors: string[] = [];
  if (prepared.preparation === undefined)
    return await verifyLocalNoOpSources(prepared);
  const preparation = prepared.preparation;
  const guards = prepared.originalSources.map((source) => ({
    path: source.filePath,
    before: requireRecordTextSnapshot(
      preparation.captured(source.filePath, source.text),
      root,
      source.filePath,
      source.text
    )
  }));
  await phase.verifyMany(guards, (failure, index) => {
    const source = prepared.originalSources[index]!;
    errors.push(
      failure.kind === "changed"
        ? `${source.id} changed after rename validation; no files were written`
        : `${source.id} could not be re-read before rename: ${errorText(failure.error)}`
    );
  });
  return errors;
}

async function verifyLocalNoOpSources(
  prepared: PreparedRename
): Promise<string[]> {
  const errors: string[] = [];
  // Local no-op identity preparation keeps its separate fresh text boundary.
  for (const source of prepared.originalSources) {
    try {
      if ((await readRegularText(source.filePath)) !== source.text)
        errors.push(
          `${source.id} changed after rename validation; no files were written`
        );
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
  root: string,
  prepared: PreparedRename,
  phase: RecordVerificationPhase,
  errors: string[]
): Promise<void> {
  if (prepared.oldIndexText === null) return;
  if (prepared.preparation !== undefined) {
    const before = requireRecordTextSnapshot(
      prepared.preparation.captured(prepared.indexPath, prepared.oldIndexText),
      root,
      prepared.indexPath,
      prepared.oldIndexText
    );
    await phase.verifyMany(
      [{ path: prepared.indexPath, before }],
      (failure) => {
        errors.push(
          failure.kind === "changed"
            ? "investigation index changed after rename validation; no files were written"
            : "investigation index could not be re-read before rename: " +
                errorText(failure.error)
        );
      }
    );
    return;
  }
  await verifyLocalNoOpIndex(prepared, errors);
}

async function verifyLocalNoOpIndex(
  prepared: PreparedRename,
  errors: string[]
): Promise<void> {
  try {
    if ((await readRegularText(prepared.indexPath)) !== prepared.oldIndexText)
      errors.push(
        "investigation index changed after rename validation; no files were written"
      );
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
  for (const source of prepared.sources) {
    const text = await readRegularText(path.join(root, source.sourcePath));
    if (text !== source.text)
      return [source.id + " changed after rename publication"];
  }
  if (
    prepared.nextIndexText !== null &&
    (await readRegularText(prepared.indexPath)) !== prepared.nextIndexText
  )
    return ["investigation index is stale after rename"];
  return await retiredIdentityErrors(root, prepared, prepared.sources);
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
