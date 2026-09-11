import { createHash } from "node:crypto";
import {
  testEvidenceCaseIdPatternSource,
  type TestEvidenceDiagnostic
} from "./core-schemas.ts";
import type {
  CaseSourceResult,
  CaseTextSource,
  IdentifiedCaseSource
} from "./case-source-types.ts";

const caseHeadingPattern = new RegExp(
  `^### Case (${testEvidenceCaseIdPatternSource.slice(1, -1)}): (.+)$`,
  "u"
);

export function diagnostic(
  input: Omit<TestEvidenceDiagnostic, "blocking">
): TestEvidenceDiagnostic {
  return { blocking: true, ...input };
}

export function failedCaseSource(details: {
  caseId?: string;
  code: string;
  line?: number;
  message: string;
  path: string;
}): CaseSourceResult<never> {
  return {
    diagnostics: [
      diagnostic({
        caseId: details.caseId,
        category: "case",
        code: details.code,
        message: details.message,
        path: details.path
      })
    ],
    value: null
  };
}

export function normalizeCaseMarkdown(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

export function caseSourceFingerprint(
  sourcePath: string,
  normalizedMarkdown: string
): string {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([sourcePath, normalizedMarkdown]), "utf8")
    .digest("hex");
  return `sha256:${fingerprint}`;
}

export function identifyCaseSource(
  source: CaseTextSource
): CaseSourceResult<IdentifiedCaseSource> {
  const normalizedMarkdown = normalizeCaseMarkdown(source.text);
  const heading = caseHeading(normalizedMarkdown);
  if (heading === null)
    return failedCaseSource({
      code: "case.heading-invalid",
      message: `${source.path} must begin with ### Case <CASE-ID>: <title>`,
      path: source.path
    });
  const id = heading[1] ?? "";
  const title = heading[2] ?? "";
  if (!isValidCaseTitle(title))
    return failedCaseSource({
      caseId: id,
      code: "case.heading-invalid",
      message: `${source.path} Case title must be non-empty and trimmed`,
      path: source.path
    });
  return {
    diagnostics: [],
    value: {
      ...source,
      fingerprint: caseSourceFingerprint(source.path, normalizedMarkdown),
      id,
      normalizedMarkdown,
      title
    }
  };
}
function caseHeading(markdown: string): RegExpExecArray | null {
  return caseHeadingPattern.exec(markdown.split("\n", 1)[0] ?? "");
}
function isValidCaseTitle(title: string): boolean {
  return title.length > 0 && title.trim() === title;
}
