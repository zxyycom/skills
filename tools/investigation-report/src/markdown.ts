import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import type {
  InvestigationReportEntryProjection,
  InvestigationReportProjection,
  ParsedInvestigationReport
} from "./types.ts";

type RootHeading = {
  depth: number;
  lineIndex: number;
  title: string;
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
    let firstContentLine = heading.lineIndex + 1;
    while (
      firstContentLine < reportEnd
      && lines[firstContentLine].trim().length === 0
    ) {
      firstContentLine += 1;
    }

    const line = lines[firstContentLine];
    const match = line?.match(/^- 形成时间:\s*(.*?)\s*$/u) ?? null;
    if (match === null || match[1].trim().length === 0) {
      errors.push(
        `${relativePath}:${heading.lineIndex + 1} report must start with a non-empty "- 形成时间: <timestamp>" field`
      );
    }

    const reportSections = headings.filter((candidate) => (
      candidate.depth === 4
      && candidate.lineIndex > heading.lineIndex
      && candidate.lineIndex < reportEnd
    ));
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
      formedAt: match === null || match[1].trim().length === 0
        ? null
        : match[1].trim(),
      line: heading.lineIndex + 1,
      title: heading.title
    };
  });
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
