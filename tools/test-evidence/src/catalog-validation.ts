import type {
  CatalogSectionName,
  ParsedTestEvidenceCase
} from "./catalog.ts";

export type TestEvidenceCase = {
  entries: string[];
  id: string;
  line: number;
};

export type CatalogValidationResult = {
  case: TestEvidenceCase | null;
  errors: string[];
};

const sectionLabels: Record<CatalogSectionName, string> = {
  contract: "Contract",
  entry: "Entry",
  proves: "Proves"
};

export function validateTestEvidenceCase(
  entry: ParsedTestEvidenceCase,
  catalogPath: string
): CatalogValidationResult {
  const errors: string[] = [];
  const initialErrorCount = errors.length;
  const location = `${catalogPath}:${entry.line} ${entry.id}`;
  if (!entry.headingFormatIsValid) {
    errors.push(
      `${catalogPath}:${entry.line} case heading must use exactly: `
      + "### Case <CASE-ID>: <title>"
    );
    return { case: null, errors };
  }
  if (!entry.caseIdIsValid) {
    errors.push(`${location} must include a valid case ID`);
    return { case: null, errors };
  }
  if (entry.legacyVerificationDeclarations !== 0) {
    errors.push(
      `${location} must not declare Verification; every catalog case is a test`
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
    || implementationEntries.length === 0
  ) {
    return { case: null, errors };
  }
  return {
    case: {
      entries: implementationEntries,
      id: entry.id,
      line: entry.line
    },
    errors
  };
}

function requireListSections(
  entry: ParsedTestEvidenceCase,
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
  entry: ParsedTestEvidenceCase,
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
