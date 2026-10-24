/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-stage-refresh-index.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-stage-refresh-index.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-stage-refresh-index.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type { VersionControlFile } from "../../shared/src/version-control/index.ts";
import { parseDecisionIndex } from "./decision-state-index.ts";
import { decodeUtf8 } from "./decision-stage-support.ts";
import type { DecisionIndex } from "./types.ts";

export function strictIndex(text: string, label: string): DecisionIndex {
  const parsed = parseDecisionIndex(text, label);
  if (parsed.status === "error")
    throw new Error(
      label +
        ": " +
        parsed.diagnostics.map((item) => item.message).join("; ") +
        "; run check / sync-index for recovery."
    );
  return Object.freeze(parsed.value);
}
export function indexFromFile(file: VersionControlFile): DecisionIndex {
  if (file.kind !== "regular")
    throw new Error("Decision index must be a regular file: " + file.path);
  return strictIndex(decodeUtf8(file.data, file.path), file.path);
}
