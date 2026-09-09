import type { CheckResult } from "@zxyycom/vibe-check";

type CheckMessage = NonNullable<CheckResult["messages"]>[number];

const diagnosticOutputLimit = 4_000;
const diagnosticMessageLineLimit = 4;

export function truncateDiagnostic(value: string): string {
  return value.length <= diagnosticOutputLimit
    ? value
    : `…${value.slice(-diagnosticOutputLimit)}`;
}

export function diagnosticLines(output: string): string[] {
  return truncateDiagnostic(output.trim())
    .split(/\r\n|[\n\r\u2028\u2029]/u)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

export function diagnosticMessages(
  code: string,
  primary: string,
  output: string
): readonly CheckMessage[] {
  const lines = diagnosticLines(output);
  if (lines.length === 0) {
    return [{ level: "error" as const, code, message: primary }];
  }
  const visibleLines = lines.slice(-diagnosticMessageLineLimit);
  if (lines.length > visibleLines.length && visibleLines.length > 0) {
    visibleLines[0] = `…${visibleLines[0]}`;
  }
  return [
    { level: "error" as const, code, message: primary },
    ...visibleLines.map((message) => ({
      level: "error" as const,
      code: `${code}-detail`,
      message
    }))
  ];
}
