import type {
  CatalogSectionName,
  ParsedVerificationCase
} from "./catalog.ts";
import type { VerificationKind } from "./types.ts";

export type VerificationCase = {
  entries: string[];
  id: string;
  line: number;
  verification: VerificationKind;
};

export type CatalogValidationResult = {
  cases: VerificationCase[];
  errors: string[];
};

const sectionLabels: Record<CatalogSectionName, string> = {
  contract: "Contract",
  entry: "Entry",
  proves: "Proves"
};

export function validateVerificationCases(
  entries: readonly ParsedVerificationCase[],
  catalogPath: string
): CatalogValidationResult {
  const errors: string[] = [];
  for (const id of duplicateValues(entries.map((entry) => entry.id)).sort()) {
    errors.push(`duplicate case ID in ${catalogPath}: ${id}`);
  }

  const cases: VerificationCase[] = [];
  const acceptedIds = new Set<string>();
  for (const entry of entries) {
    const verificationCase = validateVerificationCase(
      entry,
      catalogPath,
      errors
    );
    if (verificationCase !== null && !acceptedIds.has(entry.id)) {
      cases.push(verificationCase);
      acceptedIds.add(entry.id);
    }
  }
  return { cases, errors };
}

function validateVerificationCase(
  entry: ParsedVerificationCase,
  catalogPath: string,
  errors: string[]
): VerificationCase | null {
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
  if (entry.verificationDeclarations !== 1 || entry.verification === null) {
    errors.push(
      `${location} must declare exactly one Verification: test or check`
    );
  }
  requireListSections(
    entry,
    ["entry", "contract", "proves"],
    catalogPath,
    errors
  );
  const implementationEntries = parseEntries(entry, catalogPath, errors);

  if (
    errors.length !== initialErrorCount
    || entry.verification === null
    || implementationEntries.length === 0
  ) {
    return null;
  }
  return {
    entries: implementationEntries,
    id: entry.id,
    line: entry.line,
    verification: entry.verification
  };
}

function requireListSections(
  entry: ParsedVerificationCase,
  names: readonly CatalogSectionName[],
  catalogPath: string,
  errors: string[]
): void {
  for (const name of names) {
    const section = entry.sections[name];
    if (section.declarations !== 1 || section.items.length === 0) {
      errors.push(
        `${catalogPath}:${entry.line} ${entry.id} must include exactly one `
        + `non-empty ${sectionLabels[name]} list`
      );
    }
  }
}

function parseEntries(
  entry: ParsedVerificationCase,
  catalogPath: string,
  errors: string[]
): string[] {
  const parsed: string[] = [];
  for (const item of entry.sections.entry.items) {
    const match = item.match(/^`([^`\r\n]+)`$/u);
    const value = match?.[1]?.trim() ?? "";
    if (value.length === 0) {
      errors.push(
        `${catalogPath}:${entry.line} ${entry.id} Entry item must be one `
        + `non-empty backticked implementation locator: ${item}`
      );
      continue;
    }
    parsed.push(value);
  }
  const duplicates = duplicateValues(parsed);
  for (const duplicate of duplicates.sort()) {
    errors.push(
      `${catalogPath}:${entry.line} ${entry.id} duplicates Entry: ${duplicate}`
    );
  }
  return [...new Set(parsed)];
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
