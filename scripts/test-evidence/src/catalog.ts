import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import {
  caseStatuses,
  reviewResults,
  type CaseStatus,
  type ReviewResult,
  type VerificationMode,
  verificationModes
} from "./types.ts";
import { normalizeWorkspaceRelative } from "./workspace-path.ts";

type MarkdownRoot = ReturnType<typeof fromMarkdown>;
type MarkdownRootContent = MarkdownRoot["children"][number];
type MarkdownHeading = Extract<MarkdownRootContent, { type: "heading" }>;
type MarkdownCode = Extract<MarkdownRootContent, { type: "code" }>;

export type CatalogSectionName =
  | "contract"
  | "proves"
  | "reason"
  | "review"
  | "risk"
  | "scope";

export type CatalogSection = {
  declarations: number;
  items: string[];
};

export type ParsedCatalogCase = {
  caseIdIsValid: boolean;
  codeDeclarations: number;
  codePath: string | null;
  headingFormatIsValid: boolean;
  id: string;
  invalidCode: boolean;
  line: number;
  reviewResult: ReviewResult | null;
  reviewResultDeclarations: number;
  reviewedAt: string | null;
  reviewedAtDeclarations: number;
  reviewedCommit: string | null;
  reviewedCommitDeclarations: number;
  sections: Record<CatalogSectionName, CatalogSection>;
  status: CaseStatus | null;
  statusDeclarations: number;
  title: string;
  verification: VerificationMode | null;
  verificationDeclarations: number;
};

const caseHeadingPattern = /^### Case\s+([^\s:]+):\s+(\S.*)$/u;
const statusPattern = /^Status:\s+(\S+)\s*$/u;
const statusPrefixPattern = /^Status:/u;
const verificationPattern = /^Verification:\s+(\S+)\s*$/u;
const verificationPrefixPattern = /^Verification:/u;
const codePattern = /^Code:\s+`([^`]+)`\s*$/u;
const codePrefixPattern = /^Code:/u;
const reviewResultPattern = /^Review-Result:\s+(\S+)\s*$/u;
const reviewResultPrefixPattern = /^Review-Result:/u;
const reviewedAtPattern = /^Reviewed-At:\s+(\S+)\s*$/u;
const reviewedAtPrefixPattern = /^Reviewed-At:/u;
const reviewedCommitPattern = /^Reviewed-Commit:\s+(\S+)\s*$/u;
const reviewedCommitPrefixPattern = /^Reviewed-Commit:/u;
const sectionPattern = /^(Contract|Proves|Scope|Risk|Reason|Review):\s*$/u;

const sectionNames: Record<string, CatalogSectionName> = {
  Contract: "contract",
  Proves: "proves",
  Reason: "reason",
  Review: "review",
  Risk: "risk",
  Scope: "scope"
};

export function collectCatalogCases(
  text: string,
  caseIdPattern: RegExp
): ParsedCatalogCase[] {
  const tree = fromMarkdown(text);
  const lines = text.split(/\r?\n/u);
  const ignoredLines = collectCodeLines(tree.children);
  const headings = tree.children.filter(
    (node): node is MarkdownHeading => node.type === "heading" && node.depth <= 3
  );
  const entries: ParsedCatalogCase[] = [];

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
    const candidateId = match?.[1] ?? headingText.split(/\s+/u)[1] ?? "<invalid>";
    const entry = createCase({
      caseIdIsValid: match !== null && caseIdPattern.test(candidateId),
      headingFormatIsValid: match !== null,
      id: candidateId,
      line: heading.position?.start.line ?? 1,
      title: match?.[2] ?? ""
    });
    const startLine = (heading.position?.end.line ?? entry.line) + 1;
    const nextHeading = headings.slice(index + 1).find((candidate) =>
      (candidate.position?.start.line ?? Number.POSITIVE_INFINITY) > entry.line
    );
    const endLine = (nextHeading?.position?.start.line ?? lines.length + 1) - 1;
    parseCaseBody(entry, lines, startLine, endLine, ignoredLines);
    entries.push(entry);
  }

  return entries;
}

function parseCaseBody(
  entry: ParsedCatalogCase,
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
    if (statusPrefixPattern.test(line)) {
      entry.statusDeclarations += 1;
      const status = line.match(statusPattern);
      entry.status = status === null ? null : parseStatus(status[1] ?? "");
      collectingSection = null;
      continue;
    }
    if (verificationPrefixPattern.test(line)) {
      entry.verificationDeclarations += 1;
      const verification = line.match(verificationPattern);
      entry.verification = verification === null
        ? null
        : parseVerification(verification[1] ?? "");
      collectingSection = null;
      continue;
    }
    if (codePrefixPattern.test(line)) {
      entry.codeDeclarations += 1;
      const code = line.match(codePattern);
      if (code === null) {
        entry.invalidCode = true;
      } else {
        const codePath = normalizeWorkspaceRelative(code[1] ?? "");
        if (codePath === null) {
          entry.invalidCode = true;
        } else if (entry.codePath === null) {
          entry.codePath = codePath;
        }
      }
      collectingSection = null;
      continue;
    }
    if (reviewResultPrefixPattern.test(line)) {
      entry.reviewResultDeclarations += 1;
      const result = line.match(reviewResultPattern);
      entry.reviewResult = result === null
        ? null
        : parseReviewResult(result[1] ?? "");
      collectingSection = null;
      continue;
    }
    if (reviewedAtPrefixPattern.test(line)) {
      entry.reviewedAtDeclarations += 1;
      const reviewedAt = line.match(reviewedAtPattern);
      entry.reviewedAt = reviewedAt?.[1] ?? null;
      collectingSection = null;
      continue;
    }
    if (reviewedCommitPrefixPattern.test(line)) {
      entry.reviewedCommitDeclarations += 1;
      const reviewedCommit = line.match(reviewedCommitPattern);
      entry.reviewedCommit = reviewedCommit?.[1] ?? null;
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
  headingFormatIsValid: boolean;
  id: string;
  line: number;
  title: string;
}): ParsedCatalogCase {
  return {
    ...input,
    codeDeclarations: 0,
    codePath: null,
    invalidCode: false,
    reviewResult: null,
    reviewResultDeclarations: 0,
    reviewedAt: null,
    reviewedAtDeclarations: 0,
    reviewedCommit: null,
    reviewedCommitDeclarations: 0,
    sections: createSections(),
    status: null,
    statusDeclarations: 0,
    verification: null,
    verificationDeclarations: 0
  };
}

function parseStatus(value: string): CaseStatus | null {
  return caseStatuses.find((status) => status === value) ?? null;
}

function parseVerification(value: string): VerificationMode | null {
  return verificationModes.find((verification) => verification === value) ?? null;
}

function parseReviewResult(value: string): ReviewResult | null {
  return reviewResults.find((result) => result === value) ?? null;
}

function createSections(): Record<CatalogSectionName, CatalogSection> {
  return {
    contract: { declarations: 0, items: [] },
    proves: { declarations: 0, items: [] },
    reason: { declarations: 0, items: [] },
    review: { declarations: 0, items: [] },
    risk: { declarations: 0, items: [] },
    scope: { declarations: 0, items: [] }
  };
}

function collectCodeLines(nodes: readonly MarkdownRootContent[]): ReadonlySet<number> {
  const ignored = new Set<number>();
  for (const node of nodes) {
    if (node.type !== "code") {
      continue;
    }
    markNodeLines(node, ignored);
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
