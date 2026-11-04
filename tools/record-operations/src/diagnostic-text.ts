import type { RecordDiagnosticCause } from "./history-index.ts";
import { operationErrorDetail } from "../../shared/src/version-control/error-detail.ts";

/** Preserve locator characters while escaping controls that can forge output lines. */
export function safeDiagnosticLocator(value: string): string {
  return JSON.stringify(value)
    .slice(1, -1)
    .replace(
      /[\u007f-\u009f\u2028\u2029]/gu,
      (character) =>
        `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
    );
}

export function safeDiagnosticText(value: unknown): string {
  return Array.from(
    operationErrorDetail(value) ?? "unavailable error detail",
    (character) => {
      const code = character.codePointAt(0)!;
      return code < 32 ||
        (code >= 127 && code <= 159) ||
        code === 0x2028 ||
        code === 0x2029
        ? " "
        : character;
    }
  ).join("");
}

/** Render each cause independently so long locators cannot consume system detail. */
export function renderRecordDiagnosticCauses(
  causes: readonly RecordDiagnosticCause[]
): string[] {
  return [
    ...causes
      .slice(0, 3)
      .flatMap((cause) => [
        `  cause: [${safeDiagnosticLocator(cause.code)}]${cause.stateId === undefined ? "" : ` "${safeDiagnosticLocator(cause.stateId)}"`}`,
        `    detail: ${safeDiagnosticText(cause.detail)}`,
        ...(cause.path == null
          ? []
          : [`    path: "${safeDiagnosticLocator(cause.path)}"`]),
        ...renderRecordSystemEvidence(cause.filesystem, "filesystem"),
        ...renderRecordSystemEvidence(cause.versionControl, "versionControl")
      ]),
    ...(causes.length <= 3 ? [] : [`  omittedCauses: ${causes.length - 3}`])
  ];
}

function renderRecordSystemEvidence(
  evidence:
    | RecordDiagnosticCause["versionControl"]
    | RecordDiagnosticCause["filesystem"],
  label: string
): string[] {
  if (evidence === undefined) return [];
  return [
    `    ${label}.causeCategory: ${safeDiagnosticText(evidence.causeCategory)}`,
    ...(evidence.operation == null
      ? []
      : [`    ${label}.operation: ${safeDiagnosticText(evidence.operation)}`]),
    ...(evidence.target == null
      ? []
      : [`    ${label}.target: "${safeDiagnosticLocator(evidence.target)}"`]),
    ...(evidence.detail == null
      ? []
      : [`    ${label}.detail: ${safeDiagnosticText(evidence.detail)}`])
  ];
}
