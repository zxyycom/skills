import path from "node:path";
import { canonicalizeInvestigationsDirectory } from "./report-path.ts";
import {
  investigationIndexFileName,
  loadCurrentInvestigationIndex
} from "./investigation-state-index.ts";
import { diagnosticFromStateIndexDiagnostic } from "./diagnostics.ts";
import { collectValidatedInvestigationCollection } from "./validation.ts";
import {
  searchFailure,
  defaultInvestigationIndexPath
} from "./query-results.ts";
import { prepareSearch } from "./query-options.ts";
import {
  searchInvestigationMetadata,
  searchSnapshot
} from "./query-search-metadata.ts";
import type { InvestigationSearchResult } from "./types.ts";

export async function searchInvestigationReports(
  input: unknown
): Promise<InvestigationSearchResult> {
  const prepared = prepareSearch(input);
  if (prepared.isErr())
    return searchFailure(prepared.error, defaultInvestigationIndexPath());
  const canonical = await canonicalizeInvestigationsDirectory(
    prepared.value.resolved
  );
  if (canonical.isErr())
    return searchFailure(canonical.error, prepared.value.indexPath);
  const investigationsDirectory = canonical.value.investigationsDirectory;
  const indexPath = path.join(
    investigationsDirectory,
    investigationIndexFileName
  );
  return prepared.value.in === "metadata"
    ? await searchInvestigationMetadata(
        investigationsDirectory,
        indexPath,
        prepared.value
      )
    : await searchContent(investigationsDirectory, indexPath, prepared.value);
}

async function searchContent(
  investigationsDirectory: string,
  indexPath: string,
  prepared: import("./query.ts").PreparedSearch
): Promise<InvestigationSearchResult> {
  const loaded = await loadCurrentInvestigationIndex({
    investigationsDirectory
  });
  return loaded.status === "ok"
    ? await searchSnapshot({
        entries: Object.entries(loaded.value.entries).map(([id, state]) => ({
          id,
          state
        })),
        indexPath,
        investigationsDirectory,
        prepared,
        warnings: []
      })
    : await searchValidatedFallback(
        investigationsDirectory,
        indexPath,
        prepared,
        loaded.diagnostics.map((diagnostic) =>
          diagnosticFromStateIndexDiagnostic(diagnostic, {
            recovery:
              "restore the derived index or correct the formal collection before retrying search",
            target: indexPath
          })
        )
      );
}

async function searchValidatedFallback(
  investigationsDirectory: string,
  indexPath: string,
  prepared: import("./query.ts").PreparedSearch,
  diagnostics: readonly import("./diagnostics.ts").InvestigationDiagnostic[]
): Promise<InvestigationSearchResult> {
  const collection = await collectValidatedInvestigationCollection(
    investigationsDirectory,
    { allowEmptyCollection: true }
  );
  if (collection.errors.length > 0 || collection.snapshot === null) {
    return searchFailure(
      collection.errors.length > 0
        ? collection.errors
        : ["the formal investigation collection could not be validated"],
      indexPath,
      diagnostics
    );
  }
  return await searchSnapshot({
    entries: Object.entries(collection.snapshot.states).map(([id, state]) => ({
      id,
      state
    })),
    indexPath,
    investigationsDirectory,
    prepared,
    warnings: [
      "The derived investigation index is unavailable; search used a validated in-memory source projection. Run sync-index before relying on index-backed operations."
    ]
  });
}
