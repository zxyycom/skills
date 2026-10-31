/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/discard/loading/discard-loading-diagnostics.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/discard/loading/discard-loading-diagnostics.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/discard/loading/discard-loading-diagnostics.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { diagnosticFromError } from "../../diagnostics.ts";
import {
  discardMutation,
  errorText,
  result,
  type DiscardCollectionOptions
} from "../discard.ts";
import type { InvestigationReportDiscardResult } from "../../types.ts";

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
