/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/discard-index-projection.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/discard-index-projection.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/discard-index-projection.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  buildStateIndex,
  serializeStateIndex
} from "../../index-runtime/src/index.ts";

import { createInvestigationStateSnapshot } from "./investigation-index-source.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDiagnosticMessages
} from "./investigation-state-index.ts";

import type { InvestigationIndexState } from "./types.ts";
import {
  result,
  type DiscardCollectionOptions,
  type DiscardStep,
  type InvestigationCollectionSource
} from "./discard.ts";
import { discardStepFailure, discardStepValue } from "./discard-protection.ts";

export async function buildDiscardIndexText(
  options: DiscardCollectionOptions,
  candidate: Readonly<{
    sources: InvestigationCollectionSource[];
    states: Map<string, InvestigationIndexState>;
  }>
): Promise<DiscardStep<string>> {
  const snapshot = createInvestigationStateSnapshot(
    candidate.sources,
    candidate.sources.map((source) =>
      requiredInvestigationState(candidate.states, source.id)
    )
  );
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

function requiredInvestigationState(
  states: ReadonlyMap<string, InvestigationIndexState>,
  investigationId: string
): InvestigationIndexState {
  const state = states.get(investigationId);
  if (state === undefined) {
    throw new Error(
      `validated investigation collection is missing state for ${investigationId}`
    );
  }
  return state;
}
