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
