import * as v from "valibot";
import {
  testEvidenceCaseSchema,
  testEvidenceTagSchema,
  testEvidenceTestIdSchema,
  type TestEvidenceDiagnostic
} from "./core-schemas.ts";
import {
  diagnostic,
  failedCaseSource,
  identifyCaseSource
} from "./case-source-identity.ts";
import type {
  CaseSourceResult,
  CaseTextSource,
  IdentifiedCaseSource,
  ParsedCaseSource
} from "./case-source-types.ts";

type CaseSectionName = "contract" | "proves" | "tags" | "tests";
type ParsedSection = { items: string[]; nextIndex: number };
type ParsedCaseSections = Record<CaseSectionName, string[]> & {
  lineCount: number;
  nextIndex: number;
};
type SectionContract = Readonly<{
  header: "Tests:" | "Tags:" | "Contract:" | "Proves:";
  itemKind: "test" | "tag" | "text";
  name: CaseSectionName;
  optional?: true;
}>;
type ParseSectionOptions = {
  caseId: string;
  diagnostics: TestEvidenceDiagnostic[];
  header: SectionContract["header"];
  itemKind: SectionContract["itemKind"];
  lines: readonly string[];
  sourcePath: string;
  startIndex: number;
};

const sectionContracts: readonly SectionContract[] = [
  { header: "Tests:", itemKind: "test", name: "tests" },
  { header: "Tags:", itemKind: "tag", name: "tags", optional: true },
  { header: "Contract:", itemKind: "text", name: "contract" },
  { header: "Proves:", itemKind: "text", name: "proves" }
];

export function parseCaseSource(
  source: CaseTextSource
): CaseSourceResult<ParsedCaseSource> {
  const identified = identifyCaseSource(source);
  if (identified.value === null) return identified;
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const sections = parseCaseSections(identified.value, diagnostics);
  if (sections.nextIndex < sections.lineCount)
    diagnostics.push(
      diagnostic({
        caseId: identified.value.id,
        category: "case",
        code: "case.content-unsupported",
        message: `${source.path} contains content outside Tests, optional Tags, Contract, and Proves`,
        path: source.path
      })
    );
  validateOrderedUnique("tests", sections.tests, identified.value, diagnostics);
  validateOrderedUnique("tags", sections.tags, identified.value, diagnostics);
  if (diagnostics.length > 0) return { diagnostics, value: null };
  const validated = v.safeParse(testEvidenceCaseSchema, {
    contract: sections.contract,
    id: identified.value.id,
    proves: sections.proves,
    sourcePath: identified.value.path,
    tags: sections.tags,
    testIds: sections.tests,
    title: identified.value.title
  });
  if (!validated.success)
    return failedCaseSource({
      caseId: identified.value.id,
      code: "case.schema-invalid",
      message: `${source.path} is invalid: invalid Case fields`,
      path: source.path
    });
  return {
    diagnostics: [],
    value: { ...identified.value, case: validated.output }
  };
}

function parseCaseSections(
  source: IdentifiedCaseSource,
  diagnostics: TestEvidenceDiagnostic[]
): ParsedCaseSections {
  const lines = source.normalizedMarkdown.split("\n");
  let index = skipBlankLines(lines, 1);
  const items: Record<CaseSectionName, string[]> = {
    contract: [],
    proves: [],
    tags: [],
    tests: []
  };
  for (const contract of sectionContracts) {
    if (contract.optional && lines[index] !== contract.header) continue;
    const parsed = parseSection({
      caseId: source.id,
      diagnostics,
      header: contract.header,
      itemKind: contract.itemKind,
      lines,
      sourcePath: source.path,
      startIndex: index
    });
    items[contract.name] = parsed.items;
    index = skipBlankLines(lines, parsed.nextIndex);
  }
  return { ...items, lineCount: lines.length, nextIndex: index };
}

function parseSection(options: ParseSectionOptions): ParsedSection {
  let index = options.startIndex;
  if (!hasExpectedHeader(options)) return invalidSection(options);
  const items: string[] = [];
  for (index += 1; index < options.lines.length; index += 1) {
    const line = options.lines[index] ?? "";
    if (line.length === 0 || !line.startsWith("- ")) break;
    const item = parseSectionItem(line, options.itemKind);
    addSectionItem(options, items, item, index);
  }
  requireSectionItems(options, items);
  return { items, nextIndex: index };
}
function hasExpectedHeader(options: ParseSectionOptions): boolean {
  return options.lines[options.startIndex] === options.header;
}
function invalidSection(options: ParseSectionOptions): ParsedSection {
  options.diagnostics.push(
    sectionDiagnostic(
      options,
      "case.section-invalid",
      `${options.sourcePath} must declare ${options.header} in the fixed section order`
    )
  );
  return { items: [], nextIndex: options.startIndex };
}
function addSectionItem(
  options: ParseSectionOptions,
  items: string[],
  item: string | null,
  index: number
): void {
  if (item !== null) {
    items.push(item);
    return;
  }
  options.diagnostics.push(
    sectionDiagnostic(
      options,
      invalidItemCode(options.itemKind),
      `${options.sourcePath}:${index + 1} contains an invalid ${options.header} item`
    )
  );
}
function invalidItemCode(itemKind: SectionContract["itemKind"]): string {
  return itemKind === "test"
    ? "case.test-item-invalid"
    : `case.${itemKind}-item-invalid`;
}
function requireSectionItems(
  options: ParseSectionOptions,
  items: readonly string[]
): void {
  if (items.length > 0) return;
  options.diagnostics.push(
    sectionDiagnostic(
      options,
      options.itemKind === "test"
        ? "case.tests-empty"
        : `case.${options.itemKind}s-empty`,
      `${options.sourcePath} ${options.header} must include at least one item`
    )
  );
}

function sectionDiagnostic(
  options: ParseSectionOptions,
  code: string,
  message: string
): TestEvidenceDiagnostic {
  return diagnostic({
    caseId: options.caseId,
    category: "case",
    code,
    message,
    path: options.sourcePath
  });
}

function parseSectionItem(
  line: string,
  itemKind: SectionContract["itemKind"]
): string | null {
  if (itemKind === "text") {
    const value = line.slice(2);
    return value.length > 0 && value.trim() === value ? value : null;
  }
  const value = /^- `([^`]+)`$/u.exec(line)?.[1] ?? null;
  if (value === null) return null;
  return v.safeParse(
    itemKind === "test" ? testEvidenceTestIdSchema : testEvidenceTagSchema,
    value
  ).success
    ? value
    : null;
}

function validateOrderedUnique(
  kind: "tests" | "tags",
  values: readonly string[],
  source: IdentifiedCaseSource,
  diagnostics: TestEvidenceDiagnostic[]
): void {
  if (kind === "tests") {
    const seen = new Set<string>();
    for (const testId of values) {
      if (seen.has(testId)) {
        diagnostics.push(
          diagnostic({
            caseId: source.id,
            category: "case",
            code: "case.tests-duplicate",
            message: `${source.path} repeats the ${source.id} -> ${testId} relation`,
            path: source.path,
            testId
          })
        );
      }
      seen.add(testId);
    }
  } else if (new Set(values).size !== values.length) {
    diagnostics.push(
      diagnostic({
        caseId: source.id,
        category: "case",
        code: "case.tags-duplicate",
        message: `${source.path} Tags must be unique`,
        path: source.path
      })
    );
  }
  const sorted = values.every(
    (value, index) => index === 0 || (values[index - 1] ?? "") < value
  );
  if (!sorted) {
    diagnostics.push(
      diagnostic({
        caseId: source.id,
        category: "case",
        code: kind === "tests" ? "case.tests-unsorted" : "case.tags-unsorted",
        message: `${source.path} ${kind === "tests" ? "Tests" : "Tags"} must be sorted in ascending lexical order`,
        path: source.path
      })
    );
  }
}

function skipBlankLines(lines: readonly string[], startIndex: number): number {
  let index = startIndex;
  while (index < lines.length && lines[index] === "") index += 1;
  return index;
}
