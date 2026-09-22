import {
  sameStateSourceRevision,
  type StateIndex,
  type StateSourceRevision
} from "../../index-runtime/src/index.ts";
import { readInvestigationSourceRevision } from "./investigation-index-source.ts";
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
 * Compares the persisted index source revision with the current formal
 * Markdown revision. A mismatch — or any failure to read the current
 * revision — counts as a known source change: read-only queries keep serving
 * the persisted snapshot and report its boundary, while strict check and
 * mutations own the actual source diagnosis.
 */
export async function investigationIndexStale(
  investigationsDirectory: string,
  index: PersistedInvestigationIndex
): Promise<boolean> {
  let currentRevision: StateSourceRevision;
  try {
    currentRevision = await readInvestigationSourceRevision(
      investigationsDirectory
    );
  } catch {
    return true;
  }
  return !sameStateSourceRevision(index.sourceRevision, currentRevision);
}

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

export const persistedSnapshotWarning =
  "The persisted Investigation index is stale; this result reflects the last published index snapshot, not the current investigation Markdown. Run sync-index to publish the current projection before drawing conclusions about the complete collection.";

export const persistedSnapshotBodyWarning =
  "The persisted Investigation index is stale; the metadata reflects the last published index snapshot while the body is read from the current investigation Markdown. Run sync-index to publish the current projection.";
