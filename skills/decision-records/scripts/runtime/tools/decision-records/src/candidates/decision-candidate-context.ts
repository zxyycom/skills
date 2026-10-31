/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/candidates/decision-candidate-context.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/candidates/decision-candidate-context.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/candidates/decision-candidate-context.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { readRecordCandidates } from "../../../record-operations/src/candidate.ts";
import { canonicalRecordCollection } from "../../../record-operations/src/source.ts";
import {
  decisionNameFromId,
  normalizeDecisionSelectorInput,
  parseDatedDecisionId
} from "../collection/decision-path.ts";
import { loadCandidateIdentityContext } from "./decision-candidate-discovery.ts";
import {
  candidateReadPhase,
  readDecisionCandidate
} from "./decision-candidate-readiness.ts";
import type { DecisionId, DecisionScanOptions } from "../types.ts";
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
  const normalized =
    selector === undefined
      ? undefined
      : normalizeDecisionSelectorInput(selector);
  const identity = await loadCandidateIdentityContext(
    decisionsDirectory,
    normalized === undefined ? undefined : [normalized]
  );
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
