import fs from "node:fs/promises";
import path from "node:path";
import { withInvestigationCollectionMutationLock } from "./collection-mutation-lock.ts";
import { diagnosticFromError } from "./diagnostics.ts";
import {
  type BeforeInvestigationPublish,
  type InvestigationPublishWriter,
  type PublishWithinLockOptions
} from "./publish-contract.ts";
import { resolvePublishCandidateSelectors } from "./publish-selector.ts";
import {
  initialPublishPreparation,
  type InitialPublishPreparation
} from "./publish-preparation-start.ts";
import { parseInvestigationCandidatePublishOptions } from "./options.ts";
import { writeIndexAtomically } from "./publish-index-writer.ts";
import {
  currentIndexText,
  invalidResult,
  pathExists,
  publishLockFailure,
  publishMutation,
  publishNoChangeFailure,
  result,
  sameResourceSnapshots,
  sameSources,
  uniqueSorted,
  validateOptions
} from "./publish-support.ts";
import {
  prepareInvestigationPublish,
  resourceSnapshotStillCurrent,
  type InvestigationPublishPreparation
} from "./publish-preparation.ts";
import {
  canonicalizeInvestigationsDirectory,
  investigationIndexFileName,
  resolveInvestigationsDirectory
} from "./report-path.ts";
import type { InvestigationCandidatePublishResult } from "./types.ts";
import { establishedRelationReview } from "./relation-review.ts";

export async function publishInvestigationCandidates(
  input: unknown
): Promise<InvestigationCandidatePublishResult> {
  return await publishInvestigationCandidatesWithWriter(
    input,
    writeIndexAtomically
  );
}

export async function publishInvestigationCandidatesWithWriter(
  input: unknown,
  write: InvestigationPublishWriter,
  beforePublish: BeforeInvestigationPublish = async () => {}
): Promise<InvestigationCandidatePublishResult> {
  const parsed = parseInvestigationCandidatePublishOptions(input);
  if (parsed.isErr()) return invalidResult(input, parsed.error);
  const options = parsed.value;
  const validated = validateOptions(options);
  if (validated.errors.length > 0)
    return result(options, false, validated.errors);
  const resolved = resolveInvestigationsDirectory(
    options.workspaceRoot,
    options.investigationsDir
  );
  if (resolved.isErr()) return result(options, false, resolved.error);
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr()) return result(options, false, canonical.error);
  const root = canonical.value.investigationsDirectory;
  const indexPath = path.join(root, investigationIndexFileName);

  if (options.preflight === true) {
    const selected = await resolvePublishCandidateSelectors(root, options.ids);
    if (selected.status === "error")
      return result(options, false, selected.errors, { indexPath });
    const selectedOptions = { ...options, ids: selected.ids };
    const prepared = await prepareInvestigationPublish(
      root,
      selectedOptions.ids
    );
    return prepared.status === "ok"
      ? result(selectedOptions, false, [], {
          indexPath,
          relationReview: establishedRelationReview(
            "preflight",
            prepared.value.candidateSources,
            prepared.value.states
          ),
          warnings: prepared.warnings
        })
      : result(selectedOptions, false, prepared.errors, {
          diagnostics: prepared.diagnostics,
          indexPath,
          warnings: prepared.warnings
        });
  }

  try {
    return await withInvestigationCollectionMutationLock(indexPath, async () =>
      publishWithinLock({
        beforePublish,
        ids: options.ids,
        indexPath,
        root,
        write
      })
    );
  } catch (error) {
    return publishLockFailure(options, indexPath, error);
  }
}

async function publishWithinLock(
  options: PublishWithinLockOptions
): Promise<InvestigationCandidatePublishResult> {
  const selected = await resolvePublishCandidateSelectors(
    options.root,
    options.ids
  );
  if (selected.status === "error") {
    return result(
      { ids: options.ids, workspaceRoot: options.root },
      false,
      selected.errors,
      { indexPath: options.indexPath, mutation: publishMutation("no-change") }
    );
  }
  const selectedOptions = { ...options, ids: selected.ids };
  const initial = await initialPublishPreparation(selectedOptions);
  if ("errors" in initial) return initial;
  try {
    await selectedOptions.beforePublish();
  } catch (error) {
    return publishNoChangeFailure(
      selectedOptions,
      initial.preparation,
      "investigation-report.publish-before-write-failed",
      error
    );
  }
  return await publishProtectedPreparation(selectedOptions, initial);
}

async function publishProtectedPreparation(
  options: PublishWithinLockOptions,
  initial: InitialPublishPreparation
): Promise<InvestigationCandidatePublishResult> {
  const protectedPreparation = await prepareInvestigationPublish(
    options.root,
    options.ids
  );
  if (protectedPreparation.status === "error") {
    return result(
      { ids: options.ids, workspaceRoot: options.root },
      false,
      [
        "investigation publish preparation changed before any files were written",
        ...protectedPreparation.errors
      ],
      {
        diagnostics: protectedPreparation.diagnostics,
        indexPath: options.indexPath,
        warnings: protectedPreparation.warnings,
        mutation: publishMutation("no-change")
      }
    );
  }
  const drift = await preparationDrift(
    options.root,
    initial.preparation,
    protectedPreparation.value,
    initial.originalIndexText
  );
  if (drift.length > 0) {
    return result(
      { ids: options.ids, workspaceRoot: options.root },
      false,
      drift,
      {
        indexPath: options.indexPath,
        warnings: protectedPreparation.warnings,
        mutation: publishMutation("no-change")
      }
    );
  }

  return await publishPreparedCollection({
    indexText: protectedPreparation.value.nextIndexText,
    originalIndexText: initial.originalIndexText,
    preparation: protectedPreparation.value,
    root: options.root,
    write: options.write
  });
}

async function publishPreparedCollection(options: {
  indexText: string;
  originalIndexText: string | null;
  preparation: InvestigationPublishPreparation;
  root: string;
  write: InvestigationPublishWriter;
}): Promise<InvestigationCandidatePublishResult> {
  const moved: Array<Readonly<{ candidatePath: string; formalPath: string }>> =
    [];
  try {
    for (const source of options.preparation.candidateSources) {
      const candidatePath = options.preparation.candidatePaths.get(source.id)!;
      const formalPath = path.join(options.root, source.sourcePath);
      await fs.link(candidatePath, formalPath);
      moved.push({ candidatePath, formalPath });
      await fs.unlink(candidatePath);
    }
    const written = await options.write(
      options.preparation.indexPath,
      options.indexText,
      options.preparation.indexExisted
    );
    return result(
      {
        ids: options.preparation.candidateSources.map((source) => source.id),
        workspaceRoot: options.root
      },
      true,
      [],
      {
        indexPath: options.preparation.indexPath,
        relationReview: establishedRelationReview(
          "committed",
          options.preparation.candidateSources,
          options.preparation.states
        ),
        warnings: [
          ...options.preparation.warnings,
          ...(written?.warnings ?? [])
        ]
      }
    );
  } catch (error) {
    const restored = await restorePreparedPublication({
      moved,
      originalIndexText: options.originalIndexText,
      preparation: options.preparation,
      write: options.write
    });
    const outcome =
      restored.length === 0 ? "rolled-back" : "partial-or-unknown";
    return result(
      {
        ids: options.preparation.candidateSources.map((source) => source.id),
        workspaceRoot: options.root
      },
      false,
      [
        "investigation publish failed before the derived index commit point",
        ...restored
      ],
      {
        diagnostics: [
          diagnosticFromError({
            code: "investigation-report.publish-failed",
            error,
            mutation: publishMutation(outcome),
            reason:
              "the selected candidates could not be published before the derived index commit point",
            recovery:
              restored.length === 0
                ? "correct the reported failure, then retry publish from the current collection state"
                : "stop mutations and reconcile the candidate, formal report, and index paths before retrying",
            target: options.preparation.indexPath
          })
        ],
        indexPath: options.preparation.indexPath,
        warnings: options.preparation.warnings,
        mutation: publishMutation(outcome)
      }
    );
  }
}

async function restorePreparedPublication(options: {
  moved: readonly Readonly<{ candidatePath: string; formalPath: string }>[];
  originalIndexText: string | null;
  preparation: InvestigationPublishPreparation;
  write: InvestigationPublishWriter;
}): Promise<string[]> {
  const errors: string[] = [];
  for (const moved of [...options.moved].reverse()) {
    try {
      if (
        (await pathExists(moved.formalPath)) &&
        !(await pathExists(moved.candidatePath))
      ) {
        await fs.link(moved.formalPath, moved.candidatePath);
      }
      await fs.rm(moved.formalPath, { force: true });
    } catch {
      errors.push(
        `failed to restore candidate ${path.basename(moved.candidatePath)}`
      );
    }
  }
  try {
    if (options.originalIndexText === null) {
      await fs.rm(options.preparation.indexPath, { force: true });
    } else {
      await options.write(
        options.preparation.indexPath,
        options.originalIndexText,
        true
      );
    }
  } catch {
    errors.push("failed to restore the investigation index");
  }
  return uniqueSorted(errors);
}

async function preparationDrift(
  root: string,
  first: InvestigationPublishPreparation,
  protectedPreparation: InvestigationPublishPreparation,
  originalIndexText: string | null
): Promise<string[]> {
  if (!sameSources(first.formalSources, protectedPreparation.formalSources)) {
    return [
      "formal investigation sources changed after publish preparation; no files were written"
    ];
  }
  if (
    !sameSources(first.candidateSources, protectedPreparation.candidateSources)
  ) {
    return [
      "selected investigation candidates changed after publish preparation; no files were written"
    ];
  }
  const current = await currentIndexText(
    protectedPreparation.indexPath,
    protectedPreparation.indexExisted
  );
  if (current.status === "error") return current.errors;
  if (current.value !== originalIndexText) {
    return [
      "investigation index changed after publish preparation; no files were written"
    ];
  }
  if (
    !sameResourceSnapshots(
      first.resourceSnapshot,
      protectedPreparation.resourceSnapshot
    )
  ) {
    return [
      "selected candidate resources changed identity after publish preparation; no files were written"
    ];
  }
  return await resourceSnapshotStillCurrent(
    root,
    protectedPreparation.resourceSnapshot
  );
}

export type { InvestigationPublishWriter } from "./publish-contract.ts";
