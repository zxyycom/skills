import { readRecordCandidates } from "../../record-operations/src/candidate.ts";
import { canonicalRecordCollection } from "../../record-operations/src/source.ts";
import {
  decisionNameFromId,
  normalizeDecisionSelectorInput,
  parseDatedDecisionId
} from "./decision-path.ts";
import { loadCandidateIdentityContext } from "./decision-candidate-discovery.ts";
import {
  candidateReadPhase,
  readDecisionCandidate
} from "./decision-candidate-readiness.ts";
import type { DecisionId, DecisionScanOptions } from "./types.ts";
export { loadCandidateIdentityContext } from "./decision-candidate-discovery.ts";
export type { CandidateIdentityContext } from "./decision-candidate-discovery.ts";

/** Only selected candidates and their direct dependencies receive body validation. */
export async function readCandidateSelection(
  options: DecisionScanOptions,
  selector?: string
) {
  const canonical = await canonicalRecordCollection(
    options.workspaceRoot ?? process.cwd(),
    options.decisionsDir ?? "docs/decisions"
  );
  const decisionsDirectory = canonical.collectionRoot;
  const identity = await loadCandidateIdentityContext(decisionsDirectory);
  const normalized =
    selector === undefined
      ? undefined
      : normalizeDecisionSelectorInput(selector);
  const selected = await readRecordCandidates({
    collection: identity.collection,
    ...(normalized === undefined
      ? {}
      : {
          selection: {
            selector: normalized,
            exactId: parseDatedDecisionId(normalized) !== null,
            name: (id: string) => decisionNameFromId(id as DecisionId)
          }
        }),
    prepare: async () => candidateReadPhase(identity),
    read: readDecisionCandidate
  });
  return {
    decisionsDirectory,
    records: selected.values,
    sourceErrors: selected.warnings,
    sourceById: new Map(
      identity.collection.candidates.map(({ id, text }) => [id, text])
    )
  };
}
