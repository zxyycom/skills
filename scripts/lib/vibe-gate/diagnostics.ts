import type { CheckResult } from "@zxyycom/vibe-check";
import { operationErrorDetail } from "../../../tools/shared/src/node/error-detail.ts";
import { isKnownGateInput } from "./impact-paths.ts";
import type { GateWorkspaceSnapshot } from "./impact-snapshot.ts";

type CheckMessage = NonNullable<CheckResult["messages"]>[number];

const diagnosticOutputLimit = 4_000;
const diagnosticMessageLineLimit = 4;
const inputClosureEntryLimit = 5;
const publicDiagnosticLengthLimit = 500;

type GateInputClosureReason =
  | "symlink"
  | "unsupported-file-kind"
  | "unowned-domain-input"
  | "unknown-input";

export type GateInputClosureDiagnostic = Readonly<{
  entries: readonly Readonly<{
    path: string;
    reason: GateInputClosureReason;
  }>[];
  omittedCount: number;
  total: number;
}>;

/** Public summaries never carry raw filesystem/probe errors or terminal controls. */
export function publicGateDiagnostic(detail: string): string {
  // Redact before escaping controls: an escape's trailing word character must
  // not hide the original boundary before a secret name or provider token.
  const sanitized = operationErrorDetail(detail) ?? "diagnostic unavailable";
  const escaped = sanitized.replace(
    /[\p{Cc}\p{Cf}\u2028\u2029]/gu,
    (character) =>
      `\\u${character.codePointAt(0)!.toString(16).padStart(4, "0")}`
  );
  return escaped.length <= publicDiagnosticLengthLimit
    ? escaped
    : `${escaped.slice(0, publicDiagnosticLengthLimit - 1)}…`;
}

/** Project classification already happened in the snapshot; only project it here. */
export function gateInputClosureDiagnostic(
  snapshot: GateWorkspaceSnapshot
): GateInputClosureDiagnostic {
  const entries = snapshot.unclassifiedPaths
    .slice(0, inputClosureEntryLimit)
    .map((relativePath) => {
      const kind = snapshot.files.find(
        (file) => file.path === relativePath
      )?.kind;
      const reason: GateInputClosureReason =
        kind === "symlink"
          ? "symlink"
          : kind === "unsupported"
            ? "unsupported-file-kind"
            : isKnownGateInput(relativePath)
              ? "unowned-domain-input"
              : "unknown-input";
      return { path: publicGateDiagnostic(relativePath), reason };
    });
  return {
    entries,
    omittedCount: snapshot.unclassifiedPaths.length - entries.length,
    total: snapshot.unclassifiedPaths.length
  };
}

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
