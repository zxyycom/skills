import { runRecordTransaction } from "../../../../record-operations/src/transactions/transaction.ts";
import type { PreparedInvestigationCandidateCreateOptions } from "./candidate-creation-input.ts";
import type { CandidateCollectionLayout } from "../candidate-discovery.ts";
import { serializeInvestigationCandidate } from "../candidate-format.ts";
import type { InvestigationCandidateCreateResult } from "../../types.ts";
import { candidateCreationResult } from "./candidate-create-result.ts";
import {
  prepareCandidateCreation,
  verifyCandidateCreationBeforeWrite,
  verifyCandidateCreationAfterWrite,
  type CandidateCreationContext
} from "./candidate-create-transaction.ts";

export async function writePreparedCandidate(
  directory: string,
  candidate: PreparedInvestigationCandidateCreateOptions,
  layout: CandidateCollectionLayout,
  target: string
): Promise<InvestigationCandidateCreateResult> {
  const context: CandidateCreationContext = {
    directory,
    candidate,
    layout,
    target,
    markdown: serializeInvestigationCandidate(candidate),
    cleanupWarnings: [],
    verifiedLayout: layout
  };
  const transaction = await runRecordTransaction({
    prepare: () => prepareCandidateCreation(context),
    fresh: () => verifyCandidateCreationBeforeWrite(context),
    verify: () => verifyCandidateCreationAfterWrite(context),
    verifyRecovered: async () => {},
    cleanup: async () => {
      if (context.cleanupWarnings.length > 0)
        throw new Error(context.cleanupWarnings.join("; "));
    }
  });
  return await candidateCreationResult(context, transaction);
}
