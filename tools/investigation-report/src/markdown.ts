import {
  investigationIdFromFrontmatter,
  parseInvestigationFrontmatter,
  serializeInvestigationRelations,
  serializeInvestigationReportFrontmatter
} from "./markdown-frontmatter.ts";
import {
  resourceIdsFromInvestigationBody,
  type InvestigationReportParseOptions,
  validateInvestigationBody
} from "./markdown-body.ts";
import {
  normalizeMarkdownNewlines,
  uniqueSortedInvestigationText
} from "./markdown-values.ts";
import type {
  InvestigationRelation,
  ParsedInvestigationReport,
  ParsedInvestigationReportDocument
} from "./types.ts";

export { compareInvestigationRelations } from "./markdown-frontmatter.ts";
export type { InvestigationReportParseOptions } from "./markdown-body.ts";

export function parseInvestigationReport(
  markdown: string,
  id: string,
  options: InvestigationReportParseOptions = {}
): ParsedInvestigationReport {
  const lines = normalizeMarkdownNewlines(markdown).split("\n");
  const frontmatterErrors: string[] = [];
  const frontmatter = parseInvestigationFrontmatter(
    lines,
    id,
    frontmatterErrors
  );
  const bodyErrors = validateReportBody(lines, frontmatter, id, options);
  const resourceErrors: string[] = [];
  const resourceIds = collectReportResourceIds(
    lines,
    frontmatter,
    id,
    resourceErrors
  );
  return parsedInvestigationReport({
    bodyErrors,
    frontmatter,
    frontmatterErrors,
    resourceErrors,
    resourceIds
  });
}

type ParsedReportSections = Readonly<{
  bodyErrors: readonly string[];
  frontmatter: ReturnType<typeof parseInvestigationFrontmatter>;
  frontmatterErrors: readonly string[];
  resourceErrors: readonly string[];
  resourceIds: readonly string[];
}>;

function validateReportBody(
  lines: readonly string[],
  frontmatter: ReturnType<typeof parseInvestigationFrontmatter>,
  id: string,
  options: InvestigationReportParseOptions
): string[] {
  const bodyErrors: string[] = [];
  validateInvestigationBody(
    lines,
    frontmatter?.endLine ?? 0,
    id,
    bodyErrors,
    options
  );
  return bodyErrors;
}

function collectReportResourceIds(
  lines: readonly string[],
  frontmatter: ReturnType<typeof parseInvestigationFrontmatter>,
  id: string,
  resourceErrors: string[]
): readonly string[] {
  if (frontmatter === null) return [];
  return resourceIdsFromInvestigationBody(
    lines,
    frontmatter.endLine,
    id,
    resourceErrors
  );
}

function parsedInvestigationReport(
  sections: ParsedReportSections
): ParsedInvestigationReport {
  return {
    bodyErrors: uniqueSortedInvestigationText(sections.bodyErrors),
    errors: allReportErrors(sections),
    frontmatterErrors: uniqueSortedInvestigationText(
      sections.frontmatterErrors
    ),
    report: reportFromFrontmatter(sections.frontmatter, sections.resourceIds),
    resourceErrors: uniqueSortedInvestigationText(sections.resourceErrors)
  };
}

function allReportErrors(sections: ParsedReportSections): string[] {
  return uniqueSortedInvestigationText([
    ...sections.frontmatterErrors,
    ...sections.bodyErrors,
    ...sections.resourceErrors
  ]);
}

function reportFromFrontmatter(
  frontmatter: ReturnType<typeof parseInvestigationFrontmatter>,
  resourceIds: readonly string[]
): ParsedInvestigationReport["report"] {
  if (frontmatter === null) return null;
  return {
    formedAt: frontmatter.formedAt,
    id: frontmatter.id,
    frontmatter: {
      endLine: frontmatter.endLine,
      relationsEndLine: frontmatter.relationsEndLine,
      relationsStartLine: frontmatter.relationsStartLine
    },
    question: frontmatter.question,
    relations: frontmatter.relations,
    resourceIds: [...resourceIds],
    tags: frontmatter.tags,
    title: frontmatter.title
  };
}

/** Reads the declared identity before full report validation during scanning. */
export function investigationIdFromMarkdown(markdown: string): string | null {
  return investigationIdFromFrontmatter(
    normalizeMarkdownNewlines(markdown).split("\n")
  );
}

export function replaceInvestigationReportRelations(
  markdown: string,
  parsed: ParsedInvestigationReportDocument,
  relations: readonly InvestigationRelation[]
): string {
  const lines = normalizeMarkdownNewlines(markdown).split("\n");
  const replacement =
    relations.length === 0
      ? ["relations: []"]
      : ["relations:", ...serializeInvestigationRelations(relations)];
  lines.splice(
    parsed.frontmatter.relationsStartLine,
    parsed.frontmatter.relationsEndLine - parsed.frontmatter.relationsStartLine,
    ...replacement
  );
  return lines.join("\n");
}

/** Rewrites persisted identity fields without changing unrelated prose. */
export function replaceInvestigationReportIdentity(
  markdown: string,
  parsed: ParsedInvestigationReportDocument,
  oldId: string,
  nextId: string
): string {
  const relations = parsed.relations.map((relation) => ({
    ...relation,
    target: relation.target === oldId ? nextId : relation.target
  }));
  const withRelations = replaceInvestigationReportRelations(
    markdown,
    parsed,
    relations
  );
  const lines = normalizeMarkdownNewlines(withRelations).split("\n");
  if (parsed.id === oldId) lines[2] = `id: ${JSON.stringify(nextId)}`;
  return lines
    .join("\n")
    .replaceAll(`](./_resources/${oldId}/`, `](./_resources/${nextId}/`);
}

export { serializeInvestigationReportFrontmatter };
