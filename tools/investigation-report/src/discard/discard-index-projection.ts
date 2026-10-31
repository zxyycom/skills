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
