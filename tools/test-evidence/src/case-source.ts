import { createHash } from "node:crypto";
import * as v from "valibot";
import {
  testEvidenceCaseIdPatternSource,
  testEvidenceCaseSchema,
  testEvidenceTagSchema,
  testEvidenceTestIdSchema,
  type TestEvidenceCase,
  type TestEvidenceDiagnostic
} from "./core-schemas.ts";

type CaseTextSource = Readonly<{ path: string; text: string }>;
const diagnostic = (
  input: Omit<TestEvidenceDiagnostic, "blocking">
): TestEvidenceDiagnostic => ({ blocking: true, ...input });
const isStrictlyAscendingLexical = (values: readonly string[]): boolean =>
  values.every(
    (value, index) => index === 0 || (values[index - 1] ?? "") < value
  );
const sha256Fingerprint = (value: string): string =>
  `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;

export type IdentifiedCaseSource = CaseTextSource & {
  fingerprint: string;
  id: string;
  normalizedMarkdown: string;
  title: string;
};

export type ParsedCaseSource = IdentifiedCaseSource & {
  case: TestEvidenceCase;
};

export type CaseSourceResult<Value> =
  | {
      diagnostics: [];
      value: Value;
    }
  | {
      diagnostics: TestEvidenceDiagnostic[];
      value: null;
    };

const caseHeadingPattern = new RegExp(
  `^### Case (${testEvidenceCaseIdPatternSource.slice(1, -1)}): (.+)$`,
  "u"
);
export function identifyCaseSource(
  source: CaseTextSource
): CaseSourceResult<IdentifiedCaseSource> {
  const normalizedMarkdown = normalizeCaseMarkdown(source.text);
  const firstLine = normalizedMarkdown.split("\n", 1)[0] ?? "";
  const heading = caseHeadingPattern.exec(firstLine);
  if (heading === null) {
    return failedCaseSource({
      code: "case.heading-invalid",
      message: `${source.path} must begin with ### Case <CASE-ID>: <title>`,
      path: source.path
    });
  }
  const id = heading[1] ?? "";
  const title = heading[2] ?? "";
  if (title.trim() !== title || title.length === 0) {
    return failedCaseSource({
      caseId: id,
      code: "case.heading-invalid",
      message: `${source.path} Case title must be non-empty and trimmed`,
      path: source.path
    });
  }
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

export function parseCaseSource(
  source: CaseTextSource
): CaseSourceResult<ParsedCaseSource> {
  const identified = identifyCaseSource(source);
  if (identified.value === null) {
    return identified;
  }

  const diagnostics: TestEvidenceDiagnostic[] = [];
  const sections = parseCaseSections(identified.value, diagnostics);
  if (sections.nextIndex < sections.lineCount) {
    diagnostics.push(
      diagnostic({
        caseId: identified.value.id,
        category: "case",
        code: "case.content-unsupported",
        message: `${source.path} contains content outside Tests, optional Tags, Contract, and Proves`,
        path: source.path
      })
    );
  }

  validateOrderedUniqueTestIds(sections.tests, identified.value, diagnostics);
  validateOrderedUniqueTags(sections.tags, identified.value, diagnostics);

  if (diagnostics.length > 0) {
    return { diagnostics, value: null };
  }

  const validated = v.safeParse(testEvidenceCaseSchema, {
    contract: sections.contract,
    id: identified.value.id,
    proves: sections.proves,
    sourcePath: identified.value.path,
    tags: sections.tags,
    testIds: sections.tests,
    title: identified.value.title
  });
  if (!validated.success) {
    return failedCaseSource({
      caseId: identified.value.id,
      code: "case.schema-invalid",
      message: `${source.path} is invalid: ` + "invalid Case fields",
      path: source.path
    });
  }
  return {
    diagnostics: [],
    value: {
      ...identified.value,
      case: validated.output
    }
  };
}

export function normalizeCaseMarkdown(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

export function caseSourceFingerprint(
  sourcePath: string,
  normalizedMarkdown: string
): string {
  return sha256Fingerprint(JSON.stringify([sourcePath, normalizedMarkdown]));
}

type ParsedSection = {
  items: string[];
  nextIndex: number;
};

type CaseSectionName = "contract" | "proves" | "tags" | "tests";

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

const sectionContracts: readonly SectionContract[] = [
  { header: "Tests:", itemKind: "test", name: "tests" },
  { header: "Tags:", itemKind: "tag", name: "tags", optional: true },
  { header: "Contract:", itemKind: "text", name: "contract" },
  { header: "Proves:", itemKind: "text", name: "proves" }
];

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
    if (contract.optional && lines[index] !== contract.header) {
      continue;
    }
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

function parseSection(options: {
  caseId: string;
  diagnostics: TestEvidenceDiagnostic[];
  header: "Tests:" | "Tags:" | "Contract:" | "Proves:";
  itemKind: "test" | "tag" | "text";
  lines: readonly string[];
  sourcePath: string;
  startIndex: number;
}): ParsedSection {
  let index = options.startIndex;
  if (options.lines[index] !== options.header) {
    options.diagnostics.push(missingSectionDiagnostic(options));
    return { items: [], nextIndex: index };
  }
  index += 1;

  const items: string[] = [];
  while (index < options.lines.length) {
    const line = options.lines[index] ?? "";
    if (line.length === 0 || !line.startsWith("- ")) {
      break;
    }
    const parsed = parseSectionItem(line, options.itemKind);
    if (parsed === null) {
      options.diagnostics.push(invalidSectionItemDiagnostic(options, index));
    } else {
      items.push(parsed);
    }
    index += 1;
  }
  if (items.length === 0) {
    options.diagnostics.push(emptySectionDiagnostic(options));
  }
  return { items, nextIndex: index };
}

type ParseSectionOptions = Parameters<typeof parseSection>[0];

function missingSectionDiagnostic(
  options: ParseSectionOptions
): TestEvidenceDiagnostic {
  return diagnostic({
    caseId: options.caseId,
    category: "case",
    code: "case.section-invalid",
    message: `${options.sourcePath} must declare ${options.header} in the fixed section order`,
    path: options.sourcePath
  });
}

function invalidSectionItemDiagnostic(
  options: ParseSectionOptions,
  index: number
): TestEvidenceDiagnostic {
  return diagnostic({
    caseId: options.caseId,
    category: "case",
    code:
      options.itemKind === "test"
        ? "case.test-item-invalid"
        : `case.${options.itemKind}-item-invalid`,
    message: `${options.sourcePath}:${index + 1} contains an invalid ${options.header} item`,
    path: options.sourcePath
  });
}

function emptySectionDiagnostic(
  options: ParseSectionOptions
): TestEvidenceDiagnostic {
  return diagnostic({
    caseId: options.caseId,
    category: "case",
    code:
      options.itemKind === "test"
        ? "case.tests-empty"
        : `case.${options.itemKind}s-empty`,
    message: `${options.sourcePath} ${options.header} must include at least one item`,
    path: options.sourcePath
  });
}

function parseSectionItem(
  line: string,
  itemKind: "test" | "tag" | "text"
): string | null {
  if (itemKind === "text") {
    const value = line.slice(2);
    return value.length > 0 && value.trim() === value ? value : null;
  }
  const matched = /^- `([^`]+)`$/u.exec(line);
  if (matched === null) {
    return null;
  }
  const value = matched[1] ?? "";
  const schema =
    itemKind === "test" ? testEvidenceTestIdSchema : testEvidenceTagSchema;
  return v.safeParse(schema, value).success ? value : null;
}

function validateOrderedUniqueTestIds(
  testIds: readonly string[],
  source: IdentifiedCaseSource,
  diagnostics: TestEvidenceDiagnostic[]
): void {
  const seen = new Set<string>();
  for (const testId of testIds) {
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
  if (!isStrictlyAscendingLexical(testIds)) {
    diagnostics.push(
      diagnostic({
        caseId: source.id,
        category: "case",
        code: "case.tests-unsorted",
        message: `${source.path} Tests must be sorted in ascending lexical order`,
        path: source.path
      })
    );
  }
}

function validateOrderedUniqueTags(
  tags: readonly string[],
  source: IdentifiedCaseSource,
  diagnostics: TestEvidenceDiagnostic[]
): void {
  if (new Set(tags).size !== tags.length) {
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
  if (!isStrictlyAscendingLexical(tags)) {
    diagnostics.push(
      diagnostic({
        caseId: source.id,
        category: "case",
        code: "case.tags-unsorted",
        message: `${source.path} Tags must be sorted in ascending lexical order`,
        path: source.path
      })
    );
  }
}

function skipBlankLines(lines: readonly string[], startIndex: number): number {
  let index = startIndex;
  while (index < lines.length && lines[index] === "") {
    index += 1;
  }
  return index;
}

function failedCaseSource(details: {
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
