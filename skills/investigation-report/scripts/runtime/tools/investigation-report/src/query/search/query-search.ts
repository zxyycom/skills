/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/query/search/query-search.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/query/search/query-search.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/query/search/query-search.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import path from "node:path";
import { canonicalizeInvestigationsDirectory } from "../../collection/report-path.ts";
import {
  investigationIndexFileName,
  loadInvestigationQueryIndex
} from "../../index/investigation-state-index.ts";
import { diagnosticFromStateIndexDiagnostic } from "../../diagnostics.ts";
import {
  searchFailure,
  defaultInvestigationIndexPath
} from "../query-results.ts";
import { prepareSearch } from "../query-options.ts";
import { searchInvestigationMetadata } from "./query-search-metadata.ts";
import { searchSnapshot } from "./query-search-content.ts";
import type { InvestigationSearchResult } from "../../types.ts";

export async function searchInvestigationReports(
  input: unknown
): Promise<InvestigationSearchResult> {
  const prepared = prepareSearch(input);
  if (prepared.isErr())
    return searchFailure({
      errors: prepared.error,
      indexPath: defaultInvestigationIndexPath(),
      failureKind: "invalid-options"
    });
  const canonical = await canonicalizeInvestigationsDirectory(
    prepared.value.resolved
  );
  if (canonical.isErr())
    return searchFailure({
      errors: canonical.error,
      indexPath: prepared.value.indexPath,
      failureKind: "operation"
    });
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
  prepared: import("../query.ts").PreparedSearch
): Promise<InvestigationSearchResult> {
  const loaded = await loadInvestigationQueryIndex({
    investigationsDirectory,
    requiresRelations:
      prepared.validated.relatedTo !== undefined ||
      prepared.validated.relationType !== undefined
  });
  if (loaded.status === "ok")
    return await searchSnapshot({
      relations: loaded.relations,
      indexPath,
      investigationsDirectory,
      prepared,
      source: {
        kind: "published-index+current-text",
        currentness: "unchecked",
        fallback: false
      },
      warnings: []
    });
  return searchFailure({
    errors: [
      "the published investigation index could not be loaded for content search"
    ],
    indexPath,
    diagnostics: loaded.diagnostics.map((diagnostic) =>
      diagnosticFromStateIndexDiagnostic(diagnostic, {
        recovery:
          "Run check to diagnose the collection, then run sync-index after correcting the problem.",
        target: indexPath
      })
    ),
    failureKind: "operation"
  });
}
