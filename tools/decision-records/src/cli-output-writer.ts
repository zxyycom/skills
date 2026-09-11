import type { DecisionRecordsCliIo } from "./cli-io.ts";

export function writeCliLine(
  writer: DecisionRecordsCliIo["stdout"] | DecisionRecordsCliIo["stderr"],
  text: string
): void {
  writer(`${text}\n`);
}
