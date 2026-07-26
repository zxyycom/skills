import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
type MarkdownRoot = ReturnType<typeof fromMarkdown>;
type MarkdownRootContent = MarkdownRoot["children"][number];
type MarkdownHeading = Extract<MarkdownRootContent, { type: "heading" }>;
type MarkdownCode = Extract<MarkdownRootContent, { type: "code" }>;

export type CatalogSectionName = "contract" | "entry" | "proves";

export type CatalogSection = {
  declarations: number;
  items: string[];
};

export type ParsedTestEvidenceCase = {
  caseIdIsValid: boolean;
  endLine: number;
  headingFormatIsValid: boolean;
  id: string;
  line: number;
  sections: Record<CatalogSectionName, CatalogSection>;
  title: string;
  legacyVerificationDeclarations: number;
};

const caseHeadingPattern = /^### Case\s+([^\s:]+):\s+(\S.*)$/u;
const verificationPrefixPattern = /^Verification:/u;
const sectionPattern = /^(Entry|Contract|Proves):\s*$/u;

const sectionNames: Record<string, CatalogSectionName> = {
  Contract: "contract",
  Entry: "entry",
  Proves: "proves"
};

export function collectTestEvidenceCases(
  text: string,
  caseIdPattern: RegExp
): ParsedTestEvidenceCase[] {
  const tree = fromMarkdown(text);
  const lines = text.split(/\r?\n/u);
  const ignoredLines = collectCodeLines(tree.children);
  const headings = tree.children.filter(
    (node): node is MarkdownHeading => node.type === "heading" && node.depth <= 3
  );
  const entries: ParsedTestEvidenceCase[] = [];

  for (const [index, heading] of headings.entries()) {
    if (heading.depth !== 3) {
      continue;
    }
    const headingText = toString(heading);
    if (!/^Case(?:\s|:|$)/u.test(headingText)) {
      continue;
    }

    const headingLine = lines[(heading.position?.start.line ?? 1) - 1] ?? "";
    const match = headingLine.match(caseHeadingPattern);
    const candidateId = match?.[1]
      ?? headingText.split(/\s+/u)[1]
      ?? "<invalid>";
    const line = heading.position?.start.line ?? 1;
    const nextHeading = headings.slice(index + 1).find((candidate) =>
      (candidate.position?.start.line ?? Number.POSITIVE_INFINITY) > line
    );
    const endLine = (nextHeading?.position?.start.line ?? lines.length + 1) - 1;
    const entry = createCase({
      caseIdIsValid: match !== null && caseIdPattern.test(candidateId),
      endLine,
      headingFormatIsValid: match !== null,
      id: candidateId,
      line,
      title: match?.[2] ?? ""
    });
    const startLine = (heading.position?.end.line ?? entry.line) + 1;
    parseCaseBody(entry, lines, startLine, endLine, ignoredLines);
    entries.push(entry);
  }

  return entries;
}

function parseCaseBody(
  entry: ParsedTestEvidenceCase,
  lines: readonly string[],
  startLine: number,
  endLine: number,
  ignoredLines: ReadonlySet<number>
): void {
  let collectingSection: CatalogSectionName | null = null;
  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
    if (ignoredLines.has(lineNumber)) {
      collectingSection = null;
      continue;
    }
    const line = lines[lineNumber - 1] ?? "";
    if (/^#{1,6}\s+/u.test(line)) {
      collectingSection = null;
      continue;
    }
    if (verificationPrefixPattern.test(line)) {
      entry.legacyVerificationDeclarations += 1;
      collectingSection = null;
      continue;
    }

    const section = line.match(sectionPattern);
    if (section !== null) {
      collectingSection = sectionNames[section[1] ?? ""] ?? null;
      if (collectingSection !== null) {
        entry.sections[collectingSection].declarations += 1;
      }
      continue;
    }

    if (collectingSection === null) {
      continue;
    }
    const listItem = line.trim().match(/^(?:[-*]|\d+\.)\s+(\S.*)$/u);
    if (listItem !== null) {
      entry.sections[collectingSection].items.push(listItem[1] ?? "");
      continue;
    }
    if (line.trim().length > 0) {
      collectingSection = null;
    }
  }
}

function createCase(input: {
  caseIdIsValid: boolean;
  endLine: number;
  headingFormatIsValid: boolean;
  id: string;
  line: number;
  title: string;
}): ParsedTestEvidenceCase {
  return {
    ...input,
    sections: createSections(),
    legacyVerificationDeclarations: 0
  };
}

function createSections(): Record<CatalogSectionName, CatalogSection> {
  return {
    contract: { declarations: 0, items: [] },
    entry: { declarations: 0, items: [] },
    proves: { declarations: 0, items: [] }
  };
}

function collectCodeLines(
  nodes: readonly MarkdownRootContent[]
): ReadonlySet<number> {
  const ignored = new Set<number>();
  for (const node of nodes) {
    if (node.type === "code") {
      markNodeLines(node, ignored);
    }
  }
  return ignored;
}

function markNodeLines(node: MarkdownCode, ignored: Set<number>): void {
  const start = node.position?.start.line;
  const end = node.position?.end.line;
  if (start === undefined || end === undefined) {
    return;
  }
  for (let line = start; line <= end; line += 1) {
    ignored.add(line);
  }
}
