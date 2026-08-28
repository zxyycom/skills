import { investigationResourceIdFromLinkTarget } from "./resource-reference.ts";
import { isInvestigationId, isInvestigationTag } from "./report-path.ts";
import {
  investigationRelationTypes,
  type InvestigationRelation,
  type InvestigationRelationType,
  type ParsedInvestigationReport,
  type ParsedInvestigationReportDocument
} from "./types.ts";

const requiredSectionTitles = [
  "形成时背景",
  "调查目的",
  "调查范围与依据",
  "调查结果与边界"
] as const;
const relationTypeOrder = new Map(
  investigationRelationTypes.map((type, index) => [type, index])
);

type ParsedFrontmatter = Readonly<{
  endLine: number;
  formedAt: string;
  question: string;
  relations: InvestigationRelation[];
  relationsEndLine: number;
  relationsStartLine: number;
  tags: string[];
  title: string;
}>;

export function parseInvestigationReport(
  markdown: string,
  id: string
): ParsedInvestigationReport {
  const text = normalizeNewlines(markdown);
  const lines = text.split("\n");
  const errors: string[] = [];
  if (!isInvestigationId(id)) {
    errors.push(`${id || "<empty>"} must use a valid Investigation ID`);
  }
  const frontmatter = parseFrontmatter(lines, id, errors);
  validateBody(lines, frontmatter?.endLine ?? 0, id, errors);
  const resourceIds =
    frontmatter === null
      ? []
      : resourceIdsFromBody(lines, frontmatter.endLine, id, errors);
  return {
    errors: uniqueSorted(errors),
    report:
      frontmatter === null
        ? null
        : {
            formedAt: frontmatter.formedAt,
            frontmatter: {
              endLine: frontmatter.endLine,
              relationsEndLine: frontmatter.relationsEndLine,
              relationsStartLine: frontmatter.relationsStartLine
            },
            question: frontmatter.question,
            relations: frontmatter.relations,
            resourceIds,
            tags: frontmatter.tags,
            title: frontmatter.title
          }
  };
}

export function replaceInvestigationReportRelations(
  markdown: string,
  parsed: ParsedInvestigationReportDocument,
  relations: readonly InvestigationRelation[]
): string {
  const lines = normalizeNewlines(markdown).split("\n");
  const replacement =
    relations.length === 0
      ? ["relations: []"]
      : ["relations:", ...serializeRelations(relations)];
  lines.splice(
    parsed.frontmatter.relationsStartLine,
    parsed.frontmatter.relationsEndLine - parsed.frontmatter.relationsStartLine,
    ...replacement
  );
  return lines.join("\n");
}

export function serializeInvestigationReportFrontmatter(input: {
  formedAt: string;
  question: string;
  relations: readonly InvestigationRelation[];
  tags: readonly string[];
  title: string;
}): string {
  return [
    "---",
    `title: ${quoteScalar(input.title)}`,
    `formedAt: ${quoteScalar(input.formedAt)}`,
    `question: ${quoteScalar(input.question)}`,
    "tags:",
    ...input.tags.map((tag) => `  - ${quoteScalar(tag)}`),
    ...(input.relations.length === 0
      ? ["relations: []"]
      : ["relations:", ...serializeRelations(input.relations)]),
    "---"
  ].join("\n");
}

function parseFrontmatter(
  lines: readonly string[],
  id: string,
  errors: string[]
): ParsedFrontmatter | null {
  if (lines[0] !== "---") {
    errors.push(
      `${id}:1 report must start with YAML frontmatter delimiter ---`
    );
    return null;
  }
  const endLine = lines.findIndex((line, index) => index > 0 && line === "---");
  if (endLine < 0) {
    errors.push(`${id}:1 frontmatter must end with delimiter ---`);
    return null;
  }
  const cursor = new FrontmatterCursor(lines, 1, endLine, id, errors);
  const title = cursor.requiredScalar("title");
  const formedAt = cursor.requiredScalar("formedAt");
  const question = cursor.requiredScalar("question");
  const tags = cursor.tags();
  const relations = cursor.relations();
  if (cursor.index !== endLine) {
    for (let index = cursor.index; index < endLine; index += 1) {
      errors.push(
        `${id}:${index + 1} frontmatter has an unknown or misplaced key`
      );
    }
  }
  if (
    title === null ||
    formedAt === null ||
    question === null ||
    tags === null ||
    relations === null
  ) {
    return null;
  }
  return {
    endLine,
    formedAt,
    question,
    relations: relations.values,
    relationsEndLine: relations.endLine,
    relationsStartLine: relations.startLine,
    tags,
    title
  };
}

class FrontmatterCursor {
  public index: number;

  public constructor(
    private readonly lines: readonly string[],
    start: number,
    private readonly end: number,
    private readonly id: string,
    private readonly errors: string[]
  ) {
    this.index = start;
  }

  public requiredScalar(key: "title" | "formedAt" | "question"): string | null {
    const line = this.lines[this.index];
    const prefix = `${key}: `;
    if (line === undefined || !line.startsWith(prefix)) {
      this.errors.push(
        `${this.id}:${this.index + 1} frontmatter must provide ${key} in fixed order`
      );
      return null;
    }
    this.index += 1;
    const value = parseQuotedScalar(line.slice(prefix.length));
    if (
      value === null ||
      value.trim().length === 0 ||
      hasC0ControlCharacter(value)
    ) {
      this.errors.push(
        `${this.id}:${this.index} ${key} must be a non-empty JSON-compatible quoted single-line string`
      );
      return null;
    }
    return value;
  }

  public tags(): string[] | null {
    if (this.lines[this.index] !== "tags:") {
      this.errors.push(
        `${this.id}:${this.index + 1} frontmatter must provide tags after question`
      );
      return null;
    }
    this.index += 1;
    const tags: string[] = [];
    while (
      this.index < this.end &&
      this.lines[this.index]?.startsWith("  - ") === true
    ) {
      const value = parseQuotedScalar(this.lines[this.index]!.slice(4));
      if (value === null || !isInvestigationTag(value)) {
        this.errors.push(
          `${this.id}:${this.index + 1} tag must use a JSON-compatible quoted kebab-case token`
        );
      } else {
        tags.push(value);
      }
      this.index += 1;
    }
    if (tags.length === 0) {
      this.errors.push(`${this.id} tags must contain at least one tag`);
    }
    if (!isStrictlySorted(tags)) {
      this.errors.push(`${this.id} tags must be unique and sorted lexically`);
    }
    return tags;
  }

  public relations(): {
    endLine: number;
    startLine: number;
    values: InvestigationRelation[];
  } | null {
    const startLine = this.index;
    if (this.lines[this.index] === "relations: []") {
      this.index += 1;
      return { endLine: this.index, startLine, values: [] };
    }
    if (this.lines[this.index] !== "relations:") {
      this.errors.push(
        `${this.id}:${this.index + 1} frontmatter must provide relations after tags`
      );
      return null;
    }
    this.index += 1;
    const relations: InvestigationRelation[] = [];
    while (
      this.index < this.end &&
      this.lines[this.index]?.startsWith("  - type: ") === true
    ) {
      const type = parseQuotedScalar(
        this.lines[this.index]!.slice("  - type: ".length)
      );
      const targetLine = this.lines[this.index + 1];
      const targetPrefix = "    target: ";
      if (targetLine === undefined || !targetLine.startsWith(targetPrefix)) {
        this.errors.push(
          `${this.id}:${this.index + 2} relation must provide target after type`
        );
        this.index += 1;
        continue;
      }
      const target = parseQuotedScalar(targetLine.slice(targetPrefix.length));
      if (
        !isRelationType(type) ||
        target === null ||
        !isInvestigationId(target)
      ) {
        this.errors.push(
          `${this.id}:${this.index + 1} relation must use a known type and a valid Investigation ID target`
        );
      } else {
        relations.push({ target, type });
      }
      this.index += 2;
    }
    if (!isCanonicalRelations(relations)) {
      this.errors.push(
        `${this.id} relations must be unique and sorted by type then target`
      );
    }
    if (
      new Set(relations.map((relation) => relation.target)).size !==
      relations.length
    ) {
      this.errors.push(`${this.id} relations must not repeat a target`);
    }
    if (relations.length === 0) {
      this.errors.push(
        `${this.id} empty relations must use the canonical relations: [] form`
      );
    }
    return { endLine: this.index, startLine, values: relations };
  }
}

function validateBody(
  lines: readonly string[],
  frontmatterEndLine: number,
  id: string,
  errors: string[]
): void {
  const { h1Indexes, headings } = scanBodyHeadings(lines);
  if (h1Indexes.some((index) => index > frontmatterEndLine)) {
    errors.push(`${id} body must not repeat an H1`);
  }
  if (headings.length < requiredSectionTitles.length) {
    errors.push(`${id} body must begin with the four fixed H2 sections`);
    return;
  }
  for (const [index, title] of requiredSectionTitles.entries()) {
    if (headings[index]?.title !== title) {
      const headingLine = headings[index]?.index ?? frontmatterEndLine + 1;
      errors.push(
        `${id}:${headingLine + 1} H2 section ${index + 1} must be "${title}"`
      );
    }
    if (headings.filter((heading) => heading.title === title).length !== 1) {
      errors.push(`${id} must contain exactly one "## ${title}" section`);
    }
  }
  const resources = headings.filter((heading) => heading.title === "随附资源");
  const nonCanonicalResourceHeadings = headings.filter(
    (heading) =>
      heading.title !== "随附资源" && heading.title.trim() === "随附资源"
  );
  for (const heading of nonCanonicalResourceHeadings) {
    errors.push(
      `${id}:${heading.index + 1} resource heading must be exactly "## 随附资源"`
    );
  }
  if (resources.length > 1) {
    errors.push(`${id} must contain at most one "## 随附资源" section`);
  }
  if (resources.length === 1 && headings[4]?.title !== "随附资源") {
    errors.push(
      `${id} "## 随附资源" must immediately follow the four fixed core sections`
    );
  }
  for (const [index, heading] of headings.entries()) {
    const end = headings[index + 1]?.index ?? lines.length;
    if (!hasSemanticContent(lines, heading.index + 1, end)) {
      errors.push(
        `${id}:${heading.index + 1} section "${heading.title}" must not be empty`
      );
    }
  }
  const firstHeading = headings[0];
  if (
    firstHeading !== undefined &&
    hasSemanticContent(lines, frontmatterEndLine + 1, firstHeading.index)
  ) {
    errors.push(
      `${id} body must start with the fixed H2 sections after frontmatter`
    );
  }
}

function resourceIdsFromBody(
  lines: readonly string[],
  frontmatterEndLine: number,
  id: string,
  errors: string[]
): string[] {
  const headings = scanBodyHeadings(lines).headings;
  const resourceHeading = headings.find(
    (heading) =>
      heading.index > frontmatterEndLine && heading.title === "随附资源"
  );
  if (resourceHeading === undefined) {
    return [];
  }
  const nextHeading = headings.find(
    (heading) => heading.index > resourceHeading.index
  );
  const end = nextHeading?.index ?? lines.length;
  const resourceIds: string[] = [];
  for (let index = resourceHeading.index + 1; index < end; index += 1) {
    const line = lines[index]!;
    if (line.trim().length === 0) {
      continue;
    }
    const match = line.match(/^- \[([^\]]+)\]\((.+)\)$/u);
    if (match === null) {
      errors.push(
        `${id}:${index + 1} each attached resource must be one local Markdown inline link`
      );
      continue;
    }
    const parsed = investigationResourceIdFromLinkTarget(match[2]!);
    if (parsed.status === "invalid") {
      errors.push(`${id}:${index + 1} ${parsed.error}`);
      continue;
    }
    resourceIds.push(parsed.id);
  }
  if (resourceIds.length === 0) {
    errors.push(
      `${id}:${resourceHeading.index + 1} "随附资源" must contain at least one resource link`
    );
  }
  if (!isStrictlySorted(resourceIds)) {
    errors.push(
      `${id} attached resource IDs must be unique and sorted lexically`
    );
  }
  return resourceIds;
}

function serializeRelations(
  relations: readonly InvestigationRelation[]
): string[] {
  return relations.flatMap((relation) => [
    `  - type: ${quoteScalar(relation.type)}`,
    `    target: ${quoteScalar(relation.target)}`
  ]);
}

function parseQuotedScalar(value: string): string | null {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function hasC0ControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 0x1f) return true;
  }
  return false;
}

function scanBodyHeadings(lines: readonly string[]): {
  h1Indexes: number[];
  headings: Array<{ index: number; title: string }>;
} {
  const h1Indexes: number[] = [];
  const headings: Array<{ index: number; title: string }> = [];
  let fence: string | null = null;
  for (const [index, line] of lines.entries()) {
    const fenceMatch = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/u);
    if (fence !== null) {
      if (
        fenceMatch !== null &&
        fenceMatch[1]![0] === fence[0] &&
        fenceMatch[1]!.length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch !== null) {
      fence = fenceMatch[1]!;
      continue;
    }
    if (/^#(?: |$)/u.test(line)) {
      h1Indexes.push(index);
      continue;
    }
    const heading = line.match(/^## (.+)$/u);
    if (heading !== null) headings.push({ index, title: heading[1]! });
  }
  return { h1Indexes, headings };
}

function quoteScalar(value: string): string {
  return JSON.stringify(value);
}

function hasSemanticContent(
  lines: readonly string[],
  start: number,
  end: number
): boolean {
  return lines.slice(start, end).some((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !/^#{1,6}(?:\s|$)/u.test(trimmed);
  });
}

function isRelationType(
  value: string | null
): value is InvestigationRelationType {
  return (
    value !== null && relationTypeOrder.has(value as InvestigationRelationType)
  );
}

export function compareInvestigationRelations(
  left: InvestigationRelation,
  right: InvestigationRelation
): number {
  return (
    (relationTypeOrder.get(left.type) ?? Number.POSITIVE_INFINITY) -
      (relationTypeOrder.get(right.type) ?? Number.POSITIVE_INFINITY) ||
    compareText(left.target, right.target)
  );
}

function isCanonicalRelations(
  relations: readonly InvestigationRelation[]
): boolean {
  return relations.every((relation, index) => {
    const previous = relations[index - 1];
    return (
      previous === undefined ||
      compareInvestigationRelations(previous, relation) < 0
    );
  });
}

function isStrictlySorted(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || compareText(values[index - 1]!, value) < 0
  );
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/gu, "\n");
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
