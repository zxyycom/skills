/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-rename-failure.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-rename-failure.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-rename-failure.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";

const decisionRenameScope =
  "Decision Markdown files and derived decision index";

export function renameFailure(
  code: string,
  reason: string,
  recovery: string,
  target: string
): DecisionApplicationFailure {
  return decisionFailure([
    decisionDiagnostic({
      code,
      outcome: "no-change",
      reason,
      recovery,
      scope: decisionRenameScope,
      target
    })
  ]);
}
