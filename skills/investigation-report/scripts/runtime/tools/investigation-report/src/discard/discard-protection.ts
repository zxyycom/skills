/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/discard/discard-protection.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/discard/discard-protection.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/discard/discard-protection.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { InvestigationPreparation } from "../transactions/strict-preparation.ts";
import { readLocalPublication } from "../publication/local-publication.ts";
import { sameInvestigationSources } from "../index/investigation-index-source.ts";
import {
  diagnosticFromError,
  genericInvestigationDiagnostic
} from "../diagnostics.ts";
import type { InvestigationReportDiscardResult } from "../types.ts";
import { publishDiscard } from "./discard-publication.ts";
import type { ResourceTreeScan } from "./discard-history.ts";
import { readRegularText } from "./discard-files.ts";
import {
  discardMutation,
  errorText,
  result,
  type DiscardCollectionOptions,
  type DiscardStep,
  type ValidatedInvestigationCollection
} from "./discard.ts";

export async function discardProtectionFailure(
  options: DiscardCollectionOptions,
  collection: ValidatedInvestigationCollection,
  originalIndexText: string
): Promise<InvestigationReportDiscardResult | null> {
  let protectedCollection: Awaited<ReturnType<typeof readLocalPublication>>;
  try {
    protectedCollection = await readLocalPublication(
      options.root,
      collection.sources.map((source) => source.id)
    );
  } catch (error) {
    return result(
      options,
      false,
      [],
      [
        "investigation collection changed after discard validation; no files were written",
        errorText(error)
      ]
    );
  }
  if (
    protectedCollection.errors.length > 0 ||
    protectedCollection.snapshot === null ||
    !sameInvestigationSources(collection.sources, protectedCollection.sources)
  ) {
    return result(
      options,
      false,
      [],
      [
        "investigation collection changed after discard validation; no files were written",
        ...protectedCollection.errors
      ]
    );
  }
  return await discardIndexProtectionFailure(options, originalIndexText);
}

async function discardIndexProtectionFailure(
  options: DiscardCollectionOptions,
  originalIndexText: string
): Promise<InvestigationReportDiscardResult | null> {
  let currentIndexText: string;
  try {
    currentIndexText = await readRegularText(options.indexPath);
  } catch (error) {
    return discardIndexRecheckFailure(options, error);
  }
  return currentIndexText === originalIndexText
    ? null
    : discardIndexDriftFailure(options);
}

function discardIndexRecheckFailure(
  options: DiscardCollectionOptions,
  error: unknown
): InvestigationReportDiscardResult {
  return result(
    options,
    false,
    [],
    [
      `current investigation index could not be re-read before discard transaction: ${errorText(error)}`
    ],
    {
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.discard-index-recheck-failed",
          error,
          mutation: discardMutation("no-change"),
          reason:
            "the current investigation index could not be re-read before discard publication",
          recovery:
            "restore read access to the index and verify it has not changed before retrying discard",
          target: options.indexPath
        })
      ],
      mutation: discardMutation("no-change")
    }
  );
}

function discardIndexDriftFailure(
  options: DiscardCollectionOptions
): InvestigationReportDiscardResult {
  return result(
    options,
    false,
    [],
    [
      "investigation index changed after discard validation; no files were written"
    ],
    {
      diagnostics: [
        genericInvestigationDiagnostic({
          code: "investigation-report.discard-index-drift",
          mutation: discardMutation("no-change"),
          reason: "the investigation index changed after discard validation",
          recovery:
            "review the concurrent index change, then retry discard from the current collection state",
          target: options.indexPath
        })
      ],
      mutation: discardMutation("no-change")
    }
  );
}

export async function publishPreparedDiscard(
  options: DiscardCollectionOptions,
  prepared: Readonly<{
    indexText: string;
    preparation?: InvestigationPreparation;
    originalIndexText: string;
    originalSources: readonly import("../types.ts").InvestigationSource[];
    resourceProgress: import("../rename/rename-contract.ts").ResourceMoveProgress;
    ownedResources: ResourceTreeScan;
    reportPath: string;
    resourceOwnerPath: string;
  }>
): Promise<InvestigationReportDiscardResult> {
  const publication = await publishDiscard({
    afterResourceTombstone: options.afterResourceTombstone,
    preparation: prepared.preparation,
    indexPath: options.indexPath,
    indexText: prepared.indexText,
    originalIndexText: prepared.originalIndexText,
    originalSources: prepared.originalSources,
    resourceProgress: prepared.resourceProgress,
    reportPath: prepared.reportPath,
    resourceOwnerPath: prepared.resourceOwnerPath,
    resourceSnapshot: prepared.ownedResources,
    root: options.root,
    write: options.write
  });
  return result(
    options,
    publication.changed,
    prepared.ownedResources.resourceIds,
    publication.errors,
    {
      diagnostics: publication.diagnostics,
      ...(publication.mutation === undefined
        ? {}
        : { mutation: publication.mutation })
    }
  );
}

export function discardStepValue<T>(value: T): DiscardStep<T> {
  return { ok: true, value };
}

export function discardStepFailure<T>(
  failure: InvestigationReportDiscardResult
): DiscardStep<T> {
  return { ok: false, result: failure };
}
