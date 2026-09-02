import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { isFileSystemError } from "../../../shared/src/node/filesystem.ts";
import {
  isStrictlyAscendingLexical,
  sha256Fingerprint
} from "./canonicalization.ts";
import {
  createTestEvidenceDiagnostic,
  formatTestEvidenceValidationIssues,
  testEvidenceErrorText
} from "./diagnostics.ts";
import {
  testEntityIdSchema,
  testEvidenceCaseIdPatternSource,
  testEvidenceLedgerPath,
  testEvidenceLedgerCaseSchema,
  testEvidenceTagSchema,
  type TestEvidenceDiagnostic,
  type TestEvidenceLedgerCase
} from "./schemas.ts";
import { decodeLedgerUtf8Text, type LedgerTextSource } from "./text-source.ts";

export type IdentifiedLedgerCaseSource = LedgerTextSource & {
  fingerprint: string;
  id: string;
  normalizedMarkdown: string;
  title: string;
};

export type ParsedLedgerCaseSource = IdentifiedLedgerCaseSource & {
  case: TestEvidenceLedgerCase;
};

export type LedgerCaseSourceResult<Value> =
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
const ledgerCaseSourcePathPattern = /^cases\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;

export function identifyLedgerCaseSource(
  source: LedgerTextSource
): LedgerCaseSourceResult<IdentifiedLedgerCaseSource> {
  const normalizedMarkdown = normalizeLedgerCaseMarkdown(source.text);
  const firstLine = normalizedMarkdown.split("\n", 1)[0] ?? "";
  const heading = caseHeadingPattern.exec(firstLine);
  if (heading === null) {
    return failedCaseSource({
      code: "case.heading-invalid",
      line: 1,
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
      line: 1,
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

export function parseLedgerCaseSource(
  source: LedgerTextSource
): LedgerCaseSourceResult<ParsedLedgerCaseSource> {
  const identified = identifyLedgerCaseSource(source);
  if (identified.value === null) {
    return identified;
  }

  const diagnostics: TestEvidenceDiagnostic[] = [];
  const sections = parseCaseSections(identified.value, diagnostics);
  if (sections.nextIndex < sections.lineCount) {
    diagnostics.push(
      createTestEvidenceDiagnostic({
        caseId: identified.value.id,
        category: "case",
        code: "case.content-unsupported",
        line: sections.nextIndex + 1,
        message: `${source.path} contains content outside Tests, optional Tags, Contract, and Proves`,
        path: source.path,
        severity: "error"
      })
    );
  }

  validateOrderedUniqueTestIds(sections.tests, identified.value, diagnostics);
  validateOrderedUniqueTags(sections.tags, identified.value, diagnostics);

  if (diagnostics.length > 0) {
    return { diagnostics, value: null };
  }

  const validated = v.safeParse(testEvidenceLedgerCaseSchema, {
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
      message:
        `${source.path} is invalid: ` +
        formatTestEvidenceValidationIssues(validated.issues),
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

export async function readLedgerCaseSource(
  workspaceRoot: string,
  sourcePath: string
): Promise<LedgerCaseSourceResult<ParsedLedgerCaseSource>> {
  if (!ledgerCaseSourcePathPattern.test(sourcePath)) {
    return failedCaseSource({
      code: "case.source-path-invalid",
      message: `${sourcePath} must be cases/<semantic-slug>.md`,
      path: sourcePath
    });
  }
  const relativePath = `${testEvidenceLedgerPath}/${sourcePath}`;
  const absolutePath = path.join(
    path.resolve(workspaceRoot),
    ...relativePath.split("/")
  );
  try {
    const stats = await fs.lstat(absolutePath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      return failedCaseSource({
        code: "case.path-invalid",
        message: `${relativePath} must be a regular file, not a symbolic link`,
        path: relativePath
      });
    }
    const data = await fs.readFile(absolutePath);
    let text: string;
    try {
      text = decodeLedgerUtf8Text(data);
    } catch {
      return failedCaseSource({
        code: "case.encoding-invalid",
        message: `${relativePath} must contain valid UTF-8 text`,
        path: relativePath
      });
    }
    return parseLedgerCaseSource({
      path: sourcePath,
      text
    });
  } catch (error) {
    return failedCaseSource({
      code: isFileSystemError(error, "ENOENT")
        ? "case.missing"
        : "case.read-failed",
      message: isFileSystemError(error, "ENOENT")
        ? `${relativePath} does not exist`
        : `${relativePath} could not be read: ${testEvidenceErrorText(error)}`,
      path: relativePath
    });
  }
}

export function normalizeLedgerCaseMarkdown(value: string): string {
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
  source: IdentifiedLedgerCaseSource,
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
  return createTestEvidenceDiagnostic({
    caseId: options.caseId,
    category: "case",
    code: "case.section-invalid",
    line: options.startIndex + 1,
    message: `${options.sourcePath} must declare ${options.header} in the fixed section order`,
    path: options.sourcePath,
    severity: "error"
  });
}

function invalidSectionItemDiagnostic(
  options: ParseSectionOptions,
  index: number
): TestEvidenceDiagnostic {
  return createTestEvidenceDiagnostic({
    caseId: options.caseId,
    category: options.itemKind === "test" ? "relation" : "case",
    code:
      options.itemKind === "test"
        ? "relation.test-item-invalid"
        : `case.${options.itemKind}-item-invalid`,
    line: index + 1,
    message: `${options.sourcePath}:${index + 1} contains an invalid ${options.header} item`,
    path: options.sourcePath,
    severity: "error"
  });
}

function emptySectionDiagnostic(
  options: ParseSectionOptions
): TestEvidenceDiagnostic {
  return createTestEvidenceDiagnostic({
    caseId: options.caseId,
    category: options.itemKind === "test" ? "relation" : "case",
    code:
      options.itemKind === "test"
        ? "relation.tests-empty"
        : `case.${options.itemKind}s-empty`,
    line: options.startIndex + 1,
    message: `${options.sourcePath} ${options.header} must include at least one item`,
    path: options.sourcePath,
    severity: "error"
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
    itemKind === "test" ? testEntityIdSchema : testEvidenceTagSchema;
  return v.safeParse(schema, value).success ? value : null;
}

function validateOrderedUniqueTestIds(
  testIds: readonly string[],
  source: IdentifiedLedgerCaseSource,
  diagnostics: TestEvidenceDiagnostic[]
): void {
  const seen = new Set<string>();
  for (const testId of testIds) {
    if (seen.has(testId)) {
      diagnostics.push(
        createTestEvidenceDiagnostic({
          caseId: source.id,
          category: "relation",
          code: "relation.duplicate",
          message: `${source.path} repeats the ${source.id} -> ${testId} relation`,
          path: source.path,
          severity: "error",
          testId
        })
      );
    }
    seen.add(testId);
  }
  if (!isStrictlyAscendingLexical(testIds)) {
    diagnostics.push(
      createTestEvidenceDiagnostic({
        caseId: source.id,
        category: "case",
        code: "case.tests-unsorted",
        message: `${source.path} Tests must be sorted in ascending lexical order`,
        path: source.path,
        severity: "error"
      })
    );
  }
}

function validateOrderedUniqueTags(
  tags: readonly string[],
  source: IdentifiedLedgerCaseSource,
  diagnostics: TestEvidenceDiagnostic[]
): void {
  if (new Set(tags).size !== tags.length) {
    diagnostics.push(
      createTestEvidenceDiagnostic({
        caseId: source.id,
        category: "case",
        code: "case.tags-duplicate",
        message: `${source.path} Tags must be unique`,
        path: source.path,
        severity: "error"
      })
    );
  }
  if (!isStrictlyAscendingLexical(tags)) {
    diagnostics.push(
      createTestEvidenceDiagnostic({
        caseId: source.id,
        category: "case",
        code: "case.tags-unsorted",
        message: `${source.path} Tags must be sorted in ascending lexical order`,
        path: source.path,
        severity: "error"
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
}): LedgerCaseSourceResult<never> {
  return {
    diagnostics: [
      createTestEvidenceDiagnostic({
        caseId: details.caseId,
        category: "case",
        code: details.code,
        line: details.line,
        message: details.message,
        path: details.path,
        severity: "error"
      })
    ],
    value: null
  };
}
