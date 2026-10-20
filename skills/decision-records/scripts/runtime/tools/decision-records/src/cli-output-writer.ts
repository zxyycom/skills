/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli-output-writer.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli-output-writer.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli-output-writer.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type { DecisionRecordsCliIo } from "./cli-io.ts";

export function writeCliLine(
  writer: DecisionRecordsCliIo["stdout"] | DecisionRecordsCliIo["stderr"],
  text: string
): void {
  writer(`${text}\n`);
}
