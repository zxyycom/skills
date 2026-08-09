import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import type {
  InvestigationReportEntryProjection,
  InvestigationReportProjection,
  ParsedInvestigationReport
} from "./types.ts";
import { investigationResourceIdFromLinkTarget } from "./resources.ts";

type RootHeading = {
  depth: number;
  lineIndex: number;
  title: string;
};

type ReportMetadataProjection = {
  formedAt: string | null;
  resourceIds: string[];
};

const reportInfoFieldLabels = ["核心问题", "状态", "最新报告时间"] as const;
const requiredReportSectionTitles = [
  "形成时背景",
  "调查目的",
  "调查范围与依据",
  "调查结果与边界"
] as const;

function normalizeNewlines(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n");
}

function plainMarkdownText(markdown: string): string {
  return toString(fromMarkdown(markdown)).trim().replace(/\s+/gu, " ");
}

function hasSemanticContent(markdown: string): boolean {
  return fromMarkdown(markdown).children.some((node) => (
    node.type !== "heading" && toString(node).trim().length > 0
  ));
}

function rootHeadings(markdown: string): RootHeading[] {
  return fromMarkdown(markdown).children.flatMap((node) => {
    if (node.type !== "heading" || node.position === undefined) {
      return [];
    }
    return [{
      depth: node.depth,
      lineIndex: node.position.start.line - 1,
      title: toString(node).trim().replace(/\s+/gu, " ")
    }];
  });
}

function fieldMap(
  fields: Array<{ label: string; line: number; value: string }>,
  labels: readonly string[],
  relativePath: string,
  errors: string[]
): Map<string, string> {
  const allowed = new Set(labels);
  const values = new Map<string, string>();
  const actualOrder: string[] = [];

  for (const field of fields) {
    if (!allowed.has(field.label)) {
      errors.push(
        `${relativePath}:${field.line} has unsupported field "${field.label}"`
      );
      continue;
    }
    actualOrder.push(field.label);
    if (values.has(field.label)) {
      errors.push(
        `${relativePath}:${field.line} field "${field.label}" must appear exactly once`
      );
      continue;
    }
    const value = plainMarkdownText(field.value);
    if (value.length === 0) {
      errors.push(`${relativePath}:${field.line} field "${field.label}" must not be empty`);
      values.set(field.label, "");
      continue;
    }
    values.set(field.label, value);
  }

  for (const label of labels) {
    if (!values.has(label)) {
      errors.push(`${relativePath} is missing field "${label}"`);
    }
  }
  if (
    actualOrder.length === labels.length
    && actualOrder.some((label, index) => label !== labels[index])
  ) {
    errors.push(`${relativePath} fields must use order: ${labels.join(", ")}`);
  }

  return values;
}

function parseInvestigationReportEntries(
  lines: readonly string[],
  headings: readonly RootHeading[],
  section: RootHeading,
  relativePath: string,
  errors: string[]
): InvestigationReportEntryProjection[] {
  const nextH2 = headings.find((heading) => (
    heading.depth === 2 && heading.lineIndex > section.lineIndex
  ));
  const sectionEnd = nextH2?.lineIndex ?? lines.length;
  const reportHeadings = headings.filter((heading) => (
    heading.depth === 3
    && heading.lineIndex > section.lineIndex
    && heading.lineIndex < sectionEnd
  ));
  if (reportHeadings.length === 0) {
    errors.push(`${relativePath} "## 调查报告" must contain at least one H3 report`);
  }

  return reportHeadings.map((heading) => {
    if (heading.title.length === 0) {
      errors.push(`${relativePath}:${heading.lineIndex + 1} report title must not be empty`);
    }
    const nextBoundary = headings.find((candidate) => (
      candidate.lineIndex > heading.lineIndex
      && candidate.lineIndex < sectionEnd
      && candidate.depth <= 3
    ));
    const reportEnd = nextBoundary?.lineIndex ?? sectionEnd;
    const reportSections = headings.filter((candidate) => (
      candidate.depth === 4
      && candidate.lineIndex > heading.lineIndex
      && candidate.lineIndex < reportEnd
    ));
    const metadataEnd = reportSections[0]?.lineIndex ?? reportEnd;
    const metadata = parseReportMetadata(
      lines.slice(heading.lineIndex + 1, metadataEnd).join("\n"),
      heading.lineIndex + 2,
      relativePath,
      errors
    );
    for (const reportSection of reportSections) {
      if (reportSection.title.length === 0) {
        errors.push(
          `${relativePath}:${reportSection.lineIndex + 1} report section title must not be empty`
        );
      }
    }
    for (const requiredTitle of requiredReportSectionTitles) {
      const matches = reportSections.filter((candidate) => candidate.title === requiredTitle);
      if (matches.length === 0) {
        errors.push(
          `${relativePath}:${heading.lineIndex + 1} report is missing "#### ${requiredTitle}"`
        );
        continue;
      }
      if (matches.length > 1) {
        errors.push(
          `${relativePath}:${heading.lineIndex + 1} report must contain exactly one "#### ${requiredTitle}"`
        );
      }
      const requiredSection = matches[0];
      const nextSection = headings.find((candidate) => (
        candidate.lineIndex > requiredSection.lineIndex
        && candidate.lineIndex < reportEnd
        && candidate.depth <= 4
      ));
      const contentEnd = nextSection?.lineIndex ?? reportEnd;
      if (!hasSemanticContent(lines.slice(requiredSection.lineIndex + 1, contentEnd).join("\n"))) {
        errors.push(
          `${relativePath}:${requiredSection.lineIndex + 1} report section "${requiredTitle}" must not be empty`
        );
      }
    }
    if (
      reportSections.length < requiredReportSectionTitles.length
      || requiredReportSectionTitles.some((title, index) => reportSections[index]?.title !== title)
    ) {
      errors.push(
        `${relativePath}:${heading.lineIndex + 1} report H4 sections must start with: ${requiredReportSectionTitles.join(", ")}`
      );
    }

    return {
      formedAt: metadata.formedAt,
      line: heading.lineIndex + 1,
      resourceIds: metadata.resourceIds,
      title: heading.title
    };
  });
}

function parseReportMetadata(
  markdown: string,
  firstLine: number,
  relativePath: string,
  errors: string[]
): ReportMetadataProjection {
  const root = fromMarkdown(markdown);
  const list = root.children.length === 1 && root.children[0]?.type === "list"
    ? root.children[0]
    : null;
  const formedItem = list?.ordered === false ? list.children[0] : undefined;
  const formedParagraph = formedItem?.children.length === 1
    && formedItem.children[0]?.type === "paragraph"
    ? formedItem.children[0]
    : null;
  const formedText = formedParagraph?.children.length === 1
    && formedParagraph.children[0]?.type === "text"
    ? formedParagraph.children[0].value
    : null;
  const formedMatch = formedText?.match(/^形成时间:\s*(.*?)\s*$/u) ?? null;
  if (formedMatch === null || formedMatch[1].trim().length === 0) {
    errors.push(
      `${relativePath}:${firstLine - 1} report must start with a non-empty "- 形成时间: <timestamp>" field`
    );
  }

  if (list === null || list.ordered || list.children.length > 2) {
    errors.push(
      `${relativePath}:${firstLine} report metadata must contain only "形成时间" and optional "随附资源" fields`
    );
    return {
      formedAt: formedMatch?.[1].trim() || null,
      resourceIds: []
    };
  }

  const resourceItem = list.children[1];
  if (resourceItem === undefined) {
    return {
      formedAt: formedMatch?.[1].trim() || null,
      resourceIds: []
    };
  }

  const resourceLine = firstLine + (resourceItem.position?.start.line ?? 1) - 1;
  const resourceLabel = resourceItem.children[0];
  const resourceList = resourceItem.children[1];
  const validLabel = resourceLabel?.type === "paragraph"
    && resourceLabel.children.length === 1
    && resourceLabel.children[0]?.type === "text"
    && resourceLabel.children[0].value === "随附资源:";
  if (validLabel && resourceItem.children.length === 1) {
    errors.push(
      `${relativePath}:${resourceLine} field "随附资源" must contain at least one resource link`
    );
    return {
      formedAt: formedMatch?.[1].trim() || null,
      resourceIds: []
    };
  }
  if (
    !validLabel
    || resourceItem.children.length !== 2
    || resourceList?.type !== "list"
    || resourceList.ordered
  ) {
    errors.push(
      `${relativePath}:${resourceLine} field "随附资源" must contain only a nested unordered list of local Markdown links`
    );
    return {
      formedAt: formedMatch?.[1].trim() || null,
      resourceIds: []
    };
  }
  const resourceIds: string[] = [];
  for (const item of resourceList.children) {
    const itemLine = firstLine + (item.position?.start.line ?? 1) - 1;
    const paragraph = item.children.length === 1
      && item.children[0]?.type === "paragraph"
      ? item.children[0]
      : null;
    const link = paragraph?.children.length === 1
      && paragraph.children[0]?.type === "link"
      ? paragraph.children[0]
      : null;
    if (
      link === null
      || link.title !== null
      || toString(link).trim().length === 0
    ) {
      errors.push(
        `${relativePath}:${itemLine} each "随附资源" item must contain exactly one local Markdown link with non-empty display text`
      );
      continue;
    }
    const linkEnd = link.position?.end.offset;
    const labelEnd = link.children.at(-1)?.position?.end.offset;
    const rawSuffix = linkEnd === undefined || labelEnd === undefined
      ? null
      : markdown.slice(labelEnd, linkEnd);
    const rawTarget = rawSuffix?.startsWith("](") === true
      && rawSuffix.endsWith(")")
      ? rawSuffix.slice(2, -1)
      : null;
    if (rawTarget === null || rawTarget !== link.url) {
      errors.push(
        `${relativePath}:${itemLine} resource link target must be written literally as `
        + "../_resources/<resource-id> without Markdown escapes or character references"
      );
      continue;
    }
    const parsed = investigationResourceIdFromLinkTarget(rawTarget);
    if (parsed.error !== null) {
      errors.push(`${relativePath}:${itemLine} ${parsed.error}`);
      continue;
    }
    if (resourceIds.includes(parsed.id)) {
      errors.push(
        `${relativePath}:${itemLine} report must not reference resource ${parsed.id} more than once`
      );
      continue;
    }
    resourceIds.push(parsed.id);
  }

  return {
    formedAt: formedMatch?.[1].trim() || null,
    resourceIds
  };
}

export function parseInvestigationReport(
  markdown: string,
  relativePath: string
): ParsedInvestigationReport {
  const normalized = normalizeNewlines(markdown);
  const lines = normalized.split("\n");
  const errors: string[] = [];
  const firstNonEmptyLine = lines.findIndex((line) => line.trim().length > 0);
  const headings = rootHeadings(normalized);
  const h1 = headings.filter((heading) => heading.depth === 1);
  if (firstNonEmptyLine < 0 || h1[0]?.lineIndex !== firstNonEmptyLine) {
    errors.push(`${relativePath}:1 first non-empty line must be the report H1`);
  }
  if (h1.length !== 1) {
    errors.push(`${relativePath} must contain exactly one H1`);
  }
  if (h1[0]?.title.length === 0) {
    errors.push(`${relativePath}:${h1[0].lineIndex + 1} report H1 must not be empty`);
  }

  const h2 = headings.filter((heading) => heading.depth === 2);
  if (h2.length === 0 || h2[0].title !== "调查信息") {
    errors.push(`${relativePath} first H2 must be "调查信息"`);
  }
  const infoSections = h2.filter((section) => section.title === "调查信息");
  if (infoSections.length !== 1) {
    errors.push(`${relativePath} must contain exactly one "## 调查信息" section`);
  }
  if (h2.length < 2 || h2[1].title !== "调查报告") {
    errors.push(`${relativePath} second H2 must be "调查报告"`);
  }
  const reportSections = h2.filter((section) => section.title === "调查报告");
  if (reportSections.length !== 1) {
    errors.push(`${relativePath} must contain exactly one "## 调查报告" section`);
  }

  const fields: Array<{ label: string; line: number; value: string }> = [];
  const info = infoSections[0];
  if (info !== undefined) {
    const nextH2 = h2.find((section) => section.lineIndex > info.lineIndex);
    const contentEnd = nextH2?.lineIndex ?? lines.length;
    for (let index = info.lineIndex + 1; index < contentEnd; index += 1) {
      const line = lines[index];
      if (line.trim().length === 0) {
        continue;
      }
      const match = line.match(/^- ([^:]+):\s*(.*?)\s*$/u);
      if (match === null) {
        errors.push(
          `${relativePath}:${index + 1} investigation info must contain only single-line fields`
        );
        continue;
      }
      fields.push({ label: match[1].trim(), line: index + 1, value: match[2] });
    }
  }

  const values = fieldMap(fields, reportInfoFieldLabels, relativePath, errors);
  const reports = reportSections[0] === undefined
    ? []
    : parseInvestigationReportEntries(
      lines,
      headings,
      reportSections[0],
      relativePath,
      errors
    );
  const projection: InvestigationReportProjection = {
    latestReportAt: values.get("最新报告时间") ?? null,
    question: values.get("核心问题") ?? null,
    status: values.get("状态") ?? null,
    title: h1[0]?.title ?? null
  };

  return { errors, projection, reports };
}
