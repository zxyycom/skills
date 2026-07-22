import type {
  CatalogSectionName,
  ParsedCatalogCase
} from "./catalog.ts";
import { compileScopePattern } from "./scope.ts";
import type { ReviewResult } from "./types.ts";
import { normalizeWorkspaceRelative } from "./workspace-path.ts";

type LedgerCaseBase = {
  id: string;
  line: number;
};

export type LastReview = {
  at: string;
  commit: string;
  result: ReviewResult;
};

export type LedgerCase =
  | (LedgerCaseBase & {
    codePath: string;
    kind: "active-automated";
  })
  | (LedgerCaseBase & {
    kind: "planned-automated";
  })
  | (LedgerCaseBase & {
    kind: "active-review";
    lastReview: LastReview | null;
    scopePatterns: string[];
  })
  | (LedgerCaseBase & {
    kind: "active-exempt";
    scopePatterns: string[];
  });

export type CatalogValidationResult = {
  cases: LedgerCase[];
  documentedCaseIds: ReadonlySet<string>;
  errors: string[];
};

const sectionLabels: Record<CatalogSectionName, string> = {
  contract: "Contract",
  proves: "Proves",
  reason: "Reason",
  review: "Review",
  risk: "Risk",
  scope: "Scope"
};

const isoDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const gitCommitPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;

export function validateCatalogCases(
  entries: readonly ParsedCatalogCase[],
  catalogPath: string
): CatalogValidationResult {
  const errors: string[] = [];
  const duplicateIds = new Set(duplicateValues(entries.map((entry) => entry.id)));
  for (const id of [...duplicateIds].sort()) {
    errors.push(`duplicate case ID in ${catalogPath}: ${id}`);
  }

  const cases: LedgerCase[] = [];
  const acceptedIds = new Set<string>();
  for (const entry of entries) {
    const ledgerCase = validateCatalogCase(entry, catalogPath, errors);
    if (ledgerCase !== null && !acceptedIds.has(entry.id)) {
      cases.push(ledgerCase);
      acceptedIds.add(entry.id);
    }
  }
  return {
    cases,
    documentedCaseIds: new Set(
      entries
        .filter((entry) => entry.headingFormatIsValid && entry.caseIdIsValid)
        .map((entry) => entry.id)
    ),
    errors
  };
}

function validateCatalogCase(
  entry: ParsedCatalogCase,
  catalogPath: string,
  errors: string[]
): LedgerCase | null {
  const initialErrorCount = errors.length;
  const location = `${catalogPath}:${entry.line} ${entry.id}`;
  if (!entry.headingFormatIsValid) {
    errors.push(
      `${catalogPath}:${entry.line} case heading must use exactly: `
      + "### Case <CASE-ID>: <title>"
    );
    return null;
  }
  if (!entry.caseIdIsValid) {
    errors.push(`${location} must include a valid case ID`);
    return null;
  }
  if (entry.statusDeclarations !== 1 || entry.status === null) {
    errors.push(`${location} must declare exactly one Status: active or Status: planned`);
  }
  if (entry.verificationDeclarations !== 1 || entry.verification === null) {
    errors.push(
      `${location} must declare exactly one Verification: automated, review, or exempt`
    );
  }
  if (entry.status === null || entry.verification === null) {
    return null;
  }

  if (entry.status === "planned" && entry.verification !== "automated") {
    errors.push(`${location} Status: planned only supports Verification: automated`);
    return null;
  }

  if (entry.status === "planned") {
    requireListSections(entry, ["contract", "proves"], catalogPath, errors);
    forbidCode(entry, "planned automated cases", catalogPath, errors);
    forbidSections(
      entry,
      ["scope", "risk", "reason", "review"],
      "planned automated cases",
      catalogPath,
      errors
    );
    forbidReviewState(entry, "planned automated cases", catalogPath, errors);
    return errors.length === initialErrorCount
      ? { id: entry.id, kind: "planned-automated", line: entry.line }
      : null;
  }

  if (entry.verification === "automated") {
    const codePath = requireCode(entry, catalogPath, errors);
    requireListSections(entry, ["contract", "proves"], catalogPath, errors);
    forbidSections(
      entry,
      ["scope", "risk", "reason", "review"],
      "active automated cases",
      catalogPath,
      errors
    );
    forbidReviewState(entry, "active automated cases", catalogPath, errors);
    return errors.length === initialErrorCount && codePath !== null
      ? { codePath, id: entry.id, kind: "active-automated", line: entry.line }
      : null;
  }

  if (entry.verification === "review") {
    const scopePatterns = requireScopeSection(entry, catalogPath, errors);
    const lastReview = validateLastReview(entry, catalogPath, errors);
    requireListSections(
      entry,
      ["contract", "risk", "reason", "review"],
      catalogPath,
      errors
    );
    forbidCode(entry, "active review cases", catalogPath, errors);
    forbidSections(entry, ["proves"], "active review cases", catalogPath, errors);
    return errors.length === initialErrorCount
      ? {
          id: entry.id,
          kind: "active-review",
          lastReview,
          line: entry.line,
          scopePatterns
        }
      : null;
  }

  const scopePatterns = requireScopeSection(entry, catalogPath, errors);
  requireListSections(entry, ["reason"], catalogPath, errors);
  forbidCode(entry, "active exempt cases", catalogPath, errors);
  forbidSections(
    entry,
    ["contract", "proves", "risk", "review"],
    "active exempt cases",
    catalogPath,
    errors
  );
  forbidReviewState(entry, "active exempt cases", catalogPath, errors);
  return errors.length === initialErrorCount
    ? {
        id: entry.id,
        kind: "active-exempt",
        line: entry.line,
        scopePatterns
      }
    : null;
}

function requireCode(
  entry: ParsedCatalogCase,
  catalogPath: string,
  errors: string[]
): string | null {
  if (
    entry.codeDeclarations !== 1
    || entry.invalidCode
    || entry.codePath === null
  ) {
    errors.push(
      `${catalogPath}:${entry.line} ${entry.id} active automated case must declare `
      + "exactly one valid Code path"
    );
    return null;
  }
  return entry.codePath;
}

function requireListSections(
  entry: ParsedCatalogCase,
  names: readonly CatalogSectionName[],
  catalogPath: string,
  errors: string[]
): void {
  for (const name of names) {
    const section = entry.sections[name];
    if (section.declarations !== 1 || section.items.length === 0) {
      errors.push(
        `${catalogPath}:${entry.line} ${entry.id} must include exactly one non-empty `
        + `${sectionLabels[name]} list`
      );
    }
  }
}

function requireScopeSection(
  entry: ParsedCatalogCase,
  catalogPath: string,
  errors: string[]
): string[] {
  requireListSections(entry, ["scope"], catalogPath, errors);
  const scopePatterns: string[] = [];
  for (const item of entry.sections.scope.items) {
    const match = item.match(/^`([^`]+)`$/u);
    const normalized = match === null
      ? null
      : normalizeWorkspaceRelative(match[1] ?? "");
    if (normalized === null) {
      errors.push(
        `${catalogPath}:${entry.line} ${entry.id} Scope item must be one backticked `
        + `workspace-relative path or glob: ${item}`
      );
      continue;
    }
    try {
      compileScopePattern(normalized);
    } catch (error) {
      errors.push(
        `${catalogPath}:${entry.line} ${entry.id} Scope pattern is invalid: `
        + `${normalized} (${error instanceof Error ? error.message : String(error)})`
      );
      continue;
    }
    scopePatterns.push(normalized);
  }
  return [...new Set(scopePatterns)];
}

function validateLastReview(
  entry: ParsedCatalogCase,
  catalogPath: string,
  errors: string[]
): LastReview | null {
  const location = `${catalogPath}:${entry.line} ${entry.id}`;
  const declarations = [
    entry.reviewResultDeclarations,
    entry.reviewedAtDeclarations,
    entry.reviewedCommitDeclarations
  ];
  if (declarations.every((count) => count === 0)) {
    return null;
  }
  if (declarations.some((count) => count !== 1)) {
    errors.push(
      `${location} must declare Review-Result, Reviewed-At, and Reviewed-Commit together`
    );
    return null;
  }
  if (entry.reviewResult === null) {
    errors.push(`${location} Review-Result must be pass, findings, or blocked`);
  }
  if (
    entry.reviewedAt === null
    || !isoDateTimePattern.test(entry.reviewedAt)
    || Number.isNaN(Date.parse(entry.reviewedAt))
  ) {
    errors.push(`${location} Reviewed-At must be an ISO 8601 date-time with timezone`);
  }
  if (
    entry.reviewedCommit === null
    || !gitCommitPattern.test(entry.reviewedCommit)
  ) {
    errors.push(`${location} Reviewed-Commit must be one full Git commit hash`);
  }
  if (
    entry.reviewResult === null
    || entry.reviewedAt === null
    || entry.reviewedCommit === null
  ) {
    return null;
  }
  return {
    at: entry.reviewedAt,
    commit: entry.reviewedCommit,
    result: entry.reviewResult
  };
}

function forbidSections(
  entry: ParsedCatalogCase,
  names: readonly CatalogSectionName[],
  subject: string,
  catalogPath: string,
  errors: string[]
): void {
  for (const name of names) {
    if (entry.sections[name].declarations > 0) {
      errors.push(
        `${catalogPath}:${entry.line} ${entry.id} ${subject} must not declare `
        + `${sectionLabels[name]}`
      );
    }
  }
}

function forbidCode(
  entry: ParsedCatalogCase,
  subject: string,
  catalogPath: string,
  errors: string[]
): void {
  if (entry.codeDeclarations > 0) {
    errors.push(`${catalogPath}:${entry.line} ${entry.id} ${subject} must not declare Code`);
  }
}

function forbidReviewState(
  entry: ParsedCatalogCase,
  subject: string,
  catalogPath: string,
  errors: string[]
): void {
  if (
    entry.reviewResultDeclarations > 0
    || entry.reviewedAtDeclarations > 0
    || entry.reviewedCommitDeclarations > 0
  ) {
    errors.push(
      `${catalogPath}:${entry.line} ${entry.id} ${subject} must not declare `
      + "Review-Result, Reviewed-At, or Reviewed-Commit"
    );
  }
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates];
}
