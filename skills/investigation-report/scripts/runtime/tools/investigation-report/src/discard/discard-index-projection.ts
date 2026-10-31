/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/discard/discard-index-projection.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/discard/discard-index-projection.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/discard/discard-index-projection.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  buildStateIndex,
  serializeStateIndex
} from "../../../index-runtime/src/index.ts";

import type { PublishedInvestigationSnapshot } from "../publication/preparation/published-preparation.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDiagnosticMessages
} from "../index/investigation-state-index.ts";

import type { InvestigationIndexState } from "../types.ts";
import {
  result,
  type DiscardCollectionOptions,
  type DiscardStep
} from "./discard.ts";
import { discardStepFailure, discardStepValue } from "./discard-protection.ts";

export async function buildDiscardIndexText(
  options: DiscardCollectionOptions,
  candidate: Readonly<{
    baseline: PublishedInvestigationSnapshot;
    states: Map<string, InvestigationIndexState>;
  }>
): Promise<DiscardStep<string>> {
  const snapshot: PublishedInvestigationSnapshot = {
    ...candidate.baseline,
    states: Object.fromEntries(candidate.states),
    sourceRevision: {
      ...candidate.baseline.sourceRevision,
      entries: Object.fromEntries(
        Object.entries(candidate.baseline.sourceRevision.entries).filter(
          ([id]) => candidate.states.has(id)
        )
      )
    }
  };
  const definition = createInvestigationStateIndexDefinition({ snapshot });
  const builtIndex = await buildStateIndex(definition, { root: options.root });
  return builtIndex.status === "error"
    ? discardStepFailure(
        result(
          options,
          false,
          [],
          investigationIndexDiagnosticMessages(
            builtIndex.diagnostics,
            options.indexPath
          )
        )
      )
    : discardStepValue(serializeStateIndex(builtIndex.value, definition));
}
