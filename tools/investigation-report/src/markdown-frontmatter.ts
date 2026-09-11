import { isInvestigationId, isInvestigationTag } from "./report-path.ts";
import { isInvestigationRelationSummary } from "./relation-summary.ts";
import {
  compareInvestigationText,
  hasC0ControlCharacter,
  isStrictlySorted,
  parseQuotedScalar,
  quoteScalar
} from "./markdown-values.ts";
import {
  investigationRelationTypes,
  type InvestigationRelation,
  type InvestigationRelationType
} from "./types.ts";

const relationTypeOrder = new Map(
  investigationRelationTypes.map((type, index) => [type, index])
);

export type ParsedInvestigationFrontmatter = Readonly<{
  endLine: number;
  formedAt: string;
  id: string;
  question: string;
  relations: InvestigationRelation[];
  relationsEndLine: number;
  relationsStartLine: number;
  tags: string[];
  title: string;
}>;

export function parseInvestigationFrontmatter(
  lines: readonly string[],
  id: string,
  errors: string[]
): ParsedInvestigationFrontmatter | null {
  const endLine = frontmatterEndLine(lines, id, errors);
  if (endLine === null) return null;
  const cursor = new FrontmatterCursor(lines, 1, endLine, id, errors);
  const fields = requiredFrontmatterFields(cursor);
  const tags = cursor.tags();
  const relations = cursor.relations();
  reportUnknownFrontmatterLines(cursor, endLine, id, errors);
  if (fields === null || tags === null || relations === null) return null;
  validateDeclaredInvestigationId(fields.id, id, errors);
  return {
    endLine,
    formedAt: fields.formedAt,
    id: fields.id,
    question: fields.question,
    relations: relations.values,
    relationsEndLine: relations.endLine,
    relationsStartLine: relations.startLine,
    tags,
    title: fields.title
  };
}

type RequiredFrontmatterFields = Readonly<{
  formedAt: string;
  id: string;
  question: string;
  title: string;
}>;

function frontmatterEndLine(
  lines: readonly string[],
  id: string,
  errors: string[]
): number | null {
  if (lines[0] !== "---") {
    errors.push(
      `${id}:1 report must start with YAML frontmatter delimiter ---`
    );
    return null;
  }
  const endLine = lines.findIndex((line, index) => index > 0 && line === "---");
  if (endLine >= 0) return endLine;
  errors.push(`${id}:1 frontmatter must end with delimiter ---`);
  return null;
}

function requiredFrontmatterFields(
  cursor: FrontmatterCursor
): RequiredFrontmatterFields | null {
  const title = cursor.requiredScalar("title");
  const id = cursor.requiredScalar("id");
  const formedAt = cursor.requiredScalar("formedAt");
  const question = cursor.requiredScalar("question");
  if (title === null || id === null || formedAt === null || question === null)
    return null;
  return { formedAt, id, question, title };
}

function reportUnknownFrontmatterLines(
  cursor: FrontmatterCursor,
  endLine: number,
  id: string,
  errors: string[]
): void {
  for (let index = cursor.index; index < endLine; index += 1)
    errors.push(
      `${id}:${index + 1} frontmatter has an unknown or misplaced key`
    );
}

function validateDeclaredInvestigationId(
  declaredId: string,
  expectedId: string,
  errors: string[]
): void {
  if (!isInvestigationId(declaredId))
    errors.push(
      `${expectedId} frontmatter id must use a valid Investigation ID`
    );
  if (declaredId !== expectedId)
    errors.push(
      `${expectedId} frontmatter id does not match the expected Investigation ID`
    );
}

export function investigationIdFromFrontmatter(
  lines: readonly string[]
): string | null {
  const id = declaredFrontmatterIdentity(lines);
  if (id === null) return null;
  return isInvestigationId(id) ? id : null;
}

function declaredFrontmatterIdentity(lines: readonly string[]): string | null {
  if (lines[0] !== "---" || !lines[1]?.startsWith("title: ")) return null;
  const idLine = lines[2];
  if (idLine === undefined || !idLine.startsWith("id: ")) return null;
  return parseQuotedScalar(idLine.slice("id: ".length));
}

export function serializeInvestigationRelations(
  relations: readonly InvestigationRelation[]
): string[] {
  return relations.flatMap((relation) => [
    `  - type: ${quoteScalar(relation.type)}`,
    `    target: ${quoteScalar(relation.target)}`,
    ...(relation.summary === undefined
      ? []
      : [`    summary: ${quoteScalar(relation.summary)}`])
  ]);
}

export function serializeInvestigationReportFrontmatter(input: {
  formedAt: string;
  id: string;
  question: string;
  relations: readonly InvestigationRelation[];
  tags: readonly string[];
  title: string;
}): string {
  return [
    "---",
    `title: ${quoteScalar(input.title)}`,
    `id: ${quoteScalar(input.id)}`,
    `formedAt: ${quoteScalar(input.formedAt)}`,
    `question: ${quoteScalar(input.question)}`,
    "tags:",
    ...input.tags.map((tag) => `  - ${quoteScalar(tag)}`),
    ...(input.relations.length === 0
      ? ["relations: []"]
      : ["relations:", ...serializeInvestigationRelations(input.relations)]),
    "---"
  ].join("\n");
}

export function compareInvestigationRelations(
  left: InvestigationRelation,
  right: InvestigationRelation
): number {
  return (
    (relationTypeOrder.get(left.type) ?? Number.POSITIVE_INFINITY) -
      (relationTypeOrder.get(right.type) ?? Number.POSITIVE_INFINITY) ||
    compareInvestigationText(left.target, right.target)
  );
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

  public requiredScalar(
    key: "title" | "id" | "formedAt" | "question"
  ): string | null {
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
      } else tags.push(value);
      this.index += 1;
    }
    if (tags.length === 0)
      this.errors.push(`${this.id} tags must contain at least one tag`);
    if (!isStrictlySorted(tags))
      this.errors.push(`${this.id} tags must be unique and sorted lexically`);
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
      const summaryLine = this.lines[this.index + 2];
      const summaryPrefix = "    summary: ";
      const hasSummary = summaryLine?.startsWith(summaryPrefix) === true;
      const summary = hasSummary
        ? parseQuotedScalar(summaryLine!.slice(summaryPrefix.length))
        : undefined;
      if (
        !isRelationType(type) ||
        target === null ||
        !isInvestigationId(target) ||
        (summary !== undefined &&
          (summary === null || !isInvestigationRelationSummary(summary)))
      ) {
        this.errors.push(
          `${this.id}:${this.index + 1} relation must use a known type, a valid Investigation ID target, and an optional normalized single-line summary of at most 40 Unicode code points`
        );
      } else
        relations.push({
          type,
          target,
          ...(summary === undefined || summary === null ? {} : { summary })
        });
      this.index += hasSummary ? 3 : 2;
    }
    if (!isCanonicalRelations(relations))
      this.errors.push(
        `${this.id} relations must be unique and sorted by type then target`
      );
    if (
      new Set(relations.map((relation) => relation.target)).size !==
      relations.length
    )
      this.errors.push(`${this.id} relations must not repeat a target`);
    if (relations.length === 0)
      this.errors.push(
        `${this.id} empty relations must use the canonical relations: [] form`
      );
    return { endLine: this.index, startLine, values: relations };
  }
}

function isRelationType(
  value: string | null
): value is InvestigationRelationType {
  return (
    value !== null && relationTypeOrder.has(value as InvestigationRelationType)
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
