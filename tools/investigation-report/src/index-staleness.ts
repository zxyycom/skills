import type { StateIndex } from "../../index-runtime/src/index.ts";
import { investigationSourceRevision } from "./investigation-source-revision.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState,
  InvestigationSource
} from "./types.ts";

export type PersistedInvestigationIndex = StateIndex<
  InvestigationIndexState,
  InvestigationIndexMetadata
>;

/**
 * Checks whether one shown report's Markdown still matches the revision the
 * persisted index recorded for it. The body warning then separates the index
 * metadata source from the current body source.
 */
export function shownInvestigationStale(
  index: PersistedInvestigationIndex,
  source: Readonly<Pick<InvestigationSource, "id" | "sourcePath" | "text">>
): boolean {
  return (
    index.sourceRevision.entries[source.id] !==
    investigationSourceRevision([source]).entries[source.id]
  );
}

export const persistedSnapshotBodyWarning =
  "The persisted Investigation index is stale; the metadata reflects the last published index snapshot while the body is read from the current investigation Markdown. Run sync-index to publish the current projection.";
