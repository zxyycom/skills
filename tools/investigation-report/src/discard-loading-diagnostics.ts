import { diagnosticFromError } from "./diagnostics.ts";
import {
  discardMutation,
  errorText,
  result,
  type DiscardCollectionOptions
} from "./discard.ts";
import type { InvestigationReportDiscardResult } from "./types.ts";

export function discardIndexReadFailure(
  options: DiscardCollectionOptions,
  error: unknown
): InvestigationReportDiscardResult {
  return result(
    options,
    false,
    [],
    [
      `failed to read current index before discard transaction: ${errorText(error)}`
    ],
    {
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.discard-index-read-failed",
          error,
          mutation: discardMutation("no-change"),
          reason:
            "the current investigation index could not be read before discard",
          recovery:
            "restore read access to the current index, then retry discard",
          target: options.indexPath
        })
      ],
      mutation: discardMutation("no-change")
    }
  );
}
