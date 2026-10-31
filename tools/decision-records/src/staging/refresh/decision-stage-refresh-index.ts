import type { VersionControlFile } from "../../../../shared/src/version-control/index.ts";
import { parseDecisionIndex } from "../../index/decision-state-index.ts";
import { decodeUtf8 } from "../decision-stage-support.ts";
import type { DecisionIndex } from "../../types.ts";

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
