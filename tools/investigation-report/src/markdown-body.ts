import { investigationResourceIdFromLinkTarget } from "./resource-reference.ts";
import { isStrictlySorted } from "./markdown-values.ts";

const requiredSectionTitles = [
  "形成时背景",
  "调查目的",
  "调查范围与依据",
  "调查结果与边界"
] as const;
const markdownFencePattern = new RegExp("^[ \\t]{0,3}(`{3,}|~{3,})", "u");

type BodyHeading = Readonly<{ index: number; title: string }>;
type HeadingScan = Readonly<{ h1Indexes: number[]; headings: BodyHeading[] }>;

export type InvestigationReportParseOptions = Readonly<{
  allowEmptyCoreSections?: boolean;
}>;

export function validateInvestigationBody(
  lines: readonly string[],
  frontmatterEndLine: number,
  id: string,
  errors: string[],
  options: InvestigationReportParseOptions
): void {
  const { h1Indexes, headings } = scanBodyHeadings(lines);
  if (h1Indexes.some((index) => index > frontmatterEndLine))
    errors.push(`${id} body must not repeat an H1`);
  validateCoreHeadings(headings, frontmatterEndLine, id, errors);
  validateResourceHeadings(headings, id, errors);
  validateSectionContent(lines, headings, id, errors, options);
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

export function resourceIdsFromInvestigationBody(
  lines: readonly string[],
  frontmatterEndLine: number,
  id: string,
  errors: string[]
): string[] {
  const resourceRange = attachedResourceRange(lines, frontmatterEndLine);
  if (resourceRange === null) return [];
  const resourceIds = collectResourceIds(lines, resourceRange, id, errors);
  validateResourceIds(resourceIds, resourceRange.start, id, errors);
  return resourceIds;
}

type BodyRange = Readonly<{ end: number; start: number }>;

function attachedResourceRange(
  lines: readonly string[],
  frontmatterEndLine: number
): BodyRange | null {
  const headings = scanBodyHeadings(lines).headings;
  const resourceHeading = headings.find(
    (heading) =>
      heading.index > frontmatterEndLine && heading.title === "随附资源"
  );
  if (resourceHeading === undefined) return null;
  const nextHeading = headings.find(
    (heading) => heading.index > resourceHeading.index
  );
  return {
    end: nextHeading?.index ?? lines.length,
    start: resourceHeading.index
  };
}

function collectResourceIds(
  lines: readonly string[],
  range: BodyRange,
  id: string,
  errors: string[]
): string[] {
  const resourceIds: string[] = [];
  for (let index = range.start + 1; index < range.end; index += 1) {
    const resourceId = resourceIdFromBodyLine(lines[index]!, id, index, errors);
    if (resourceId !== null) resourceIds.push(resourceId);
  }
  return resourceIds;
}

function resourceIdFromBodyLine(
  line: string,
  id: string,
  index: number,
  errors: string[]
): string | null {
  if (line.trim().length === 0) return null;
  const match = line.match(/^- \[([^\]]+)\]\((.+)\)$/u);
  if (match === null) {
    errors.push(
      `${id}:${index + 1} each attached resource must be one local Markdown inline link`
    );
    return null;
  }
  const parsed = investigationResourceIdFromLinkTarget(match[2]!);
  if (parsed.status === "invalid") {
    errors.push(`${id}:${index + 1} ${parsed.error}`);
    return null;
  }
  return parsed.id;
}

function validateResourceIds(
  resourceIds: readonly string[],
  resourceHeadingIndex: number,
  id: string,
  errors: string[]
): void {
  if (resourceIds.length === 0)
    errors.push(
      `${id}:${resourceHeadingIndex + 1} "随附资源" must contain at least one resource link`
    );
  if (!isStrictlySorted(resourceIds))
    errors.push(
      `${id} attached resource IDs must be unique and sorted lexically`
    );
}

function validateCoreHeadings(
  headings: readonly BodyHeading[],
  frontmatterEndLine: number,
  id: string,
  errors: string[]
): void {
  if (headings.length < requiredSectionTitles.length) {
    errors.push(`${id} body must begin with the four fixed H2 sections`);
    return;
  }
  const context: CoreHeadingValidationContext = {
    errors,
    frontmatterEndLine,
    headings,
    id
  };
  requiredSectionTitles.forEach((title, index) =>
    validateCoreHeading(context, index, title)
  );
}

type CoreHeadingValidationContext = Readonly<{
  errors: string[];
  frontmatterEndLine: number;
  headings: readonly BodyHeading[];
  id: string;
}>;

function validateCoreHeading(
  context: CoreHeadingValidationContext,
  index: number,
  title: string
): void {
  const heading = context.headings[index];
  if (heading?.title !== title) {
    const headingLine = heading?.index ?? context.frontmatterEndLine + 1;
    context.errors.push(
      `${context.id}:${headingLine + 1} H2 section ${index + 1} must be "${title}"`
    );
  }
  validateSingleCoreHeading(
    context.headings,
    context.id,
    context.errors,
    title
  );
}

function validateSingleCoreHeading(
  headings: readonly BodyHeading[],
  id: string,
  errors: string[],
  title: string
): void {
  if (headings.filter((heading) => heading.title === title).length !== 1)
    errors.push(`${id} must contain exactly one "## ${title}" section`);
}

function validateResourceHeadings(
  headings: readonly BodyHeading[],
  id: string,
  errors: string[]
): void {
  const resources = headings.filter((heading) => heading.title === "随附资源");
  for (const heading of headings.filter(
    (heading) =>
      heading.title !== "随附资源" && heading.title.trim() === "随附资源"
  )) {
    errors.push(
      `${id}:${heading.index + 1} resource heading must be exactly "## 随附资源"`
    );
  }
  if (resources.length > 1)
    errors.push(`${id} must contain at most one "## 随附资源" section`);
  if (resources.length === 1 && headings[4]?.title !== "随附资源")
    errors.push(
      `${id} "## 随附资源" must immediately follow the four fixed core sections`
    );
}

function validateSectionContent(
  lines: readonly string[],
  headings: readonly BodyHeading[],
  id: string,
  errors: string[],
  options: InvestigationReportParseOptions
): void {
  for (const [index, heading] of headings.entries()) {
    const end = headings[index + 1]?.index ?? lines.length;
    const isCoreHeading = requiredSectionTitles.includes(
      heading.title as (typeof requiredSectionTitles)[number]
    );
    if (
      (!options.allowEmptyCoreSections || !isCoreHeading) &&
      !hasSemanticContent(lines, heading.index + 1, end)
    ) {
      errors.push(
        `${id}:${heading.index + 1} section "${heading.title}" must not be empty`
      );
    }
  }
}

function scanBodyHeadings(lines: readonly string[]): HeadingScan {
  const h1Indexes: number[] = [];
  const headings: BodyHeading[] = [];
  let fence: string | null = null;
  for (const [index, line] of lines.entries()) {
    const fenceState = scanFenceBoundary(line, fence);
    fence = fenceState.fence;
    if (fenceState.skip) continue;
    if (/^#(?: |$)/u.test(line)) {
      h1Indexes.push(index);
      continue;
    }
    const heading = line.match(/^## (.+)$/u);
    if (heading !== null) headings.push({ index, title: heading[1]! });
  }
  return { h1Indexes, headings };
}

function scanFenceBoundary(
  line: string,
  fence: string | null
): { fence: string | null; skip: boolean } {
  const fenceMatch = line.match(markdownFencePattern);
  if (fence !== null) {
    const closesFence =
      fenceMatch !== null &&
      fenceMatch[1]![0] === fence[0] &&
      fenceMatch[1]!.length >= fence.length;
    return { fence: closesFence ? null : fence, skip: true };
  }
  return fenceMatch === null
    ? { fence: null, skip: false }
    : { fence: fenceMatch[1]!, skip: true };
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
