import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import fastGlob from "fast-glob";
import {
  isFileSystemError,
  isPathWithinDirectory
} from "../../shared/src/node/filesystem.ts";
import {
  parseInvestigationIndex,
  parseInvestigationReport
} from "./markdown.ts";
import {
  investigationReportStatuses,
  type InvestigationIndexEntry,
  type InvestigationReportCheckOptions,
  type InvestigationReportCheckResult,
  type InvestigationReportEntryProjection,
  type InvestigationReportProjection,
  type ScopedInvestigationError
} from "./types.ts";

const defaultInvestigationsDirectory = "docs/investigations";
const indexFileName = "investigation-index.md";
const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

type Selection = {
  active: boolean;
  reports: Set<string>;
  topics: Set<string>;
};

async function statOrNull(targetPath: string): Promise<Stats | null> {
  try {
    return await fs.stat(targetPath);
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return null;
    }
    throw error;
  }
}

function normalizeReportFilterPath(value: string): string {
  return value.trim().replace(/\\/gu, "/").replace(/^\.\//u, "");
}

function topicOf(relativePath: string): string | null {
  const parts = relativePath.split("/");
  return parts.length > 0 && parts[0].length > 0 ? parts[0] : null;
}

function selectionFromOptions(
  options: InvestigationReportCheckOptions,
  errors: string[]
): Selection {
  const topics = new Set((options.topics ?? []).map((value) => value.trim()));
  const reports = new Set((options.reports ?? []).map(normalizeReportFilterPath));

  for (const topic of topics) {
    if (!kebabCasePattern.test(topic)) {
      errors.push(`topic filter must use kebab-case: ${topic || "<empty>"}`);
    }
  }
  for (const report of reports) {
    if (!isSafeRelativeReportPath(report)) {
      errors.push(`report filter must be a relative POSIX markdown path: ${report || "<empty>"}`);
    }
  }

  return {
    active: topics.size > 0 || reports.size > 0,
    reports,
    topics
  };
}

function isSafeRelativeReportPath(relativePath: string): boolean {
  if (
    relativePath.length === 0
    || path.posix.isAbsolute(relativePath)
    || path.win32.isAbsolute(relativePath)
    || relativePath.includes("?")
    || relativePath.includes("#")
  ) {
    return false;
  }
  const parts = relativePath.split("/");
  return !parts.some((part) => part.length === 0 || part === "." || part === "..");
}

function selectionMatches(selection: Selection, relativePath: string): boolean {
  const topic = topicOf(relativePath);
  return (selection.topics.size === 0 || (topic !== null && selection.topics.has(topic)))
    && (selection.reports.size === 0 || selection.reports.has(relativePath));
}

function scopedErrorMatches(selection: Selection, error: ScopedInvestigationError): boolean {
  if (!selection.active) {
    return true;
  }
  if (error.scope === "global") {
    return true;
  }
  if (error.scope === "report") {
    return selectionMatches(selection, error.path);
  }
  return selection.reports.size === 0
    && (selection.topics.size === 0 || selection.topics.has(error.topic));
}

function validateReportPath(relativePath: string, errors: string[]): void {
  if (!isSafeRelativeReportPath(relativePath)) {
    errors.push(`${relativePath} must be a safe relative POSIX path`);
    return;
  }
  const parts = relativePath.split("/");
  if (parts.length !== 2) {
    errors.push(`${relativePath} must use <topic-id>/<semantic-slug>.md`);
    return;
  }
  const [topic, fileName] = parts;
  const extension = path.posix.extname(fileName);
  const slug = path.posix.basename(fileName, extension);
  if (!kebabCasePattern.test(topic)) {
    errors.push(`${relativePath} topic must use kebab-case`);
  }
  if (extension !== ".md" || !kebabCasePattern.test(slug)) {
    errors.push(`${relativePath} filename must use a kebab-case semantic slug with .md`);
  }
}

function isCalendarDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function timestampMilliseconds(value: string): number | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})$/u
  );
  if (match === null) {
    return null;
  }
  const datePart = `${match[1]}-${match[2]}-${match[3]}`;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    !isCalendarDate(datePart)
    || hour > 23
    || minute > 59
    || second > 59
  ) {
    return null;
  }
  if (match[7] !== "Z") {
    const offsetHour = Number(match[7].slice(1, 3));
    const offsetMinute = Number(match[7].slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) {
      return null;
    }
  }
  const milliseconds = Date.parse(value);
  return Number.isNaN(milliseconds) ? null : milliseconds;
}

function validateStatusAndLatestReportTime(
  source: string,
  status: string | null,
  latestReportAt: string | null,
  errors: string[]
): void {
  if (
    status !== null
    && !(investigationReportStatuses as readonly string[]).includes(status)
  ) {
    errors.push(`${source} status must be one of: ${investigationReportStatuses.join(", ")}`);
  }
  if (latestReportAt !== null && timestampMilliseconds(latestReportAt) === null) {
    errors.push(
      `${source} latest report time must use an RFC 3339 timestamp with timezone and second precision`
    );
  }
}

function validateReportEntryTimestamps(
  source: string,
  reports: readonly InvestigationReportEntryProjection[],
  latestReportAt: string | null,
  errors: string[]
): void {
  let previousFormedMilliseconds: number | null = null;
  for (const report of reports) {
    if (report.formedAt === null) {
      continue;
    }
    const formedMilliseconds = timestampMilliseconds(report.formedAt);
    if (formedMilliseconds === null) {
      errors.push(
        `${source}:${report.line} report formed time must use an RFC 3339 timestamp with timezone and second precision`
      );
      continue;
    }
    if (
      previousFormedMilliseconds !== null
      && formedMilliseconds < previousFormedMilliseconds
    ) {
      errors.push(
        `${source}:${report.line} report formed time must not be earlier than the previous report`
      );
    }
    previousFormedMilliseconds = formedMilliseconds;
  }
  const lastReport = reports.at(-1);
  if (
    latestReportAt !== null
    && lastReport?.formedAt !== null
    && lastReport?.formedAt !== undefined
    && latestReportAt !== lastReport.formedAt
  ) {
    errors.push(`${source} latest report time must exactly match the last report formed time`);
  }
}

function compareProjection(
  relativePath: string,
  report: InvestigationReportProjection,
  entry: InvestigationIndexEntry,
  errors: string[]
): void {
  const comparisons = [
    ["title", report.title, entry.title],
    ["核心问题", report.question, entry.question],
    ["状态", report.status, entry.status],
    ["最新报告时间", report.latestReportAt, entry.latestReportAt]
  ] as const;
  for (const [label, reportValue, indexValue] of comparisons) {
    if (reportValue !== null && indexValue !== null && reportValue !== indexValue) {
      errors.push(
        `${relativePath} ${label} does not match investigation-index.md projection`
      );
    }
  }
}

function validateIndexEntry(
  entry: InvestigationIndexEntry,
  relativePath: string,
  errors: string[]
): void {
  if (entry.topic === null) {
    errors.push(`investigation-index.md:${entry.line} entry must belong to a topic`);
  } else if (!kebabCasePattern.test(entry.topic)) {
    errors.push(`investigation-index.md:${entry.line} topic must use kebab-case`);
  }
  const pathTopic = topicOf(relativePath);
  if (entry.topic !== null && pathTopic !== null && entry.topic !== pathTopic) {
    errors.push(
      `investigation-index.md:${entry.line} topic ${entry.topic} does not match ${relativePath}`
    );
  }
  validateStatusAndLatestReportTime(
    `investigation-index.md:${entry.line}`,
    entry.status,
    entry.latestReportAt,
    errors
  );
}

export async function validateInvestigationReports(
  options: InvestigationReportCheckOptions
): Promise<InvestigationReportCheckResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const errors: string[] = [];
  const selection = selectionFromOptions(options, errors);
  const investigationsDirOption = options.investigationsDir
    ?? defaultInvestigationsDirectory;
  const indexPathFallback = path.join(
    workspaceRoot,
    investigationsDirOption,
    indexFileName
  );

  if (path.isAbsolute(investigationsDirOption)) {
    errors.push("investigations directory must be relative to the workspace root");
    return {
      availableReportCount: 0,
      errors,
      indexPath: indexPathFallback,
      selectedReportCount: 0,
      topicCount: 0
    };
  }

  const investigationRoot = path.resolve(workspaceRoot, investigationsDirOption);
  const indexPath = path.join(investigationRoot, indexFileName);
  if (!isPathWithinDirectory(investigationRoot, workspaceRoot)) {
    errors.push("investigations directory must stay within the workspace root");
    return {
      availableReportCount: 0,
      errors,
      indexPath,
      selectedReportCount: 0,
      topicCount: 0
    };
  }

  const rootStat = await statOrNull(investigationRoot);
  if (rootStat === null) {
    errors.push(`${investigationsDirOption.replace(/\\/gu, "/")} does not exist`);
    return {
      availableReportCount: 0,
      errors,
      indexPath,
      selectedReportCount: 0,
      topicCount: 0
    };
  }
  if (!rootStat.isDirectory()) {
    errors.push(`${investigationsDirOption.replace(/\\/gu, "/")} must be a directory`);
    return {
      availableReportCount: 0,
      errors,
      indexPath,
      selectedReportCount: 0,
      topicCount: 0
    };
  }

  const indexStat = await statOrNull(indexPath);
  if (indexStat === null || !indexStat.isFile()) {
    errors.push(`${indexFileName} is required in the investigation root`);
    return {
      availableReportCount: 0,
      errors,
      indexPath,
      selectedReportCount: 0,
      topicCount: 0
    };
  }

  const index = parseInvestigationIndex(
    await fs.readFile(indexPath, "utf8"),
    indexFileName
  );
  errors.push(
    ...index.errors
      .filter((error) => scopedErrorMatches(selection, error))
      .map((error) => error.message)
  );

  const discoveredFiles = (await fastGlob("**/*.md", {
    cwd: investigationRoot,
    dot: false,
    followSymbolicLinks: false,
    onlyFiles: true
  }))
    .map((relativePath) => relativePath.replace(/\\/gu, "/"))
    .filter((relativePath) => relativePath !== indexFileName)
    .sort((left, right) => left.localeCompare(right));
  const fileSet = new Set(discoveredFiles);
  const entryPaths = index.entries.flatMap((entry) => (
    entry.path === null ? [] : [entry.path]
  ));
  const candidatePaths = new Set([...discoveredFiles, ...entryPaths, ...selection.reports]);
  const selectedPaths = [...candidatePaths]
    .filter((relativePath) => selectionMatches(selection, relativePath))
    .sort((left, right) => left.localeCompare(right));

  if (selection.active && selectedPaths.length === 0) {
    errors.push("no investigation topic files matched the requested filters");
  }

  const entriesByPath = new Map<string, InvestigationIndexEntry[]>();
  for (const entry of index.entries) {
    if (entry.path === null) {
      continue;
    }
    const relativePath = entry.path;
    const entries = entriesByPath.get(relativePath) ?? [];
    entries.push(entry);
    entriesByPath.set(relativePath, entries);
  }

  for (const relativePath of selectedPaths) {
    validateReportPath(relativePath, errors);
    const entries = entriesByPath.get(relativePath) ?? [];
    if (entries.length === 0) {
      errors.push(`${relativePath} must appear exactly once in ${indexFileName}`);
    } else if (entries.length > 1) {
      errors.push(`${relativePath} appears more than once in ${indexFileName}`);
    }
    for (const entry of entries) {
      validateIndexEntry(entry, relativePath, errors);
    }

    if (!fileSet.has(relativePath)) {
      errors.push(`${relativePath} topic file does not exist`);
      continue;
    }
    const reportPath = path.join(investigationRoot, ...relativePath.split("/"));
    const report = parseInvestigationReport(
      await fs.readFile(reportPath, "utf8"),
      relativePath
    );
    errors.push(...report.errors);
    validateStatusAndLatestReportTime(
      relativePath,
      report.projection.status,
      report.projection.latestReportAt,
      errors
    );
    validateReportEntryTimestamps(
      relativePath,
      report.reports,
      report.projection.latestReportAt,
      errors
    );
    if (entries.length === 1) {
      compareProjection(relativePath, report.projection, entries[0], errors);
    }
  }

  const selectedTopics = new Set(
    selectedPaths.flatMap((relativePath) => {
      const topic = topicOf(relativePath);
      return topic === null ? [] : [topic];
    })
  );
  return {
    availableReportCount: discoveredFiles.length,
    errors: [...new Set(errors)].sort((left, right) => left.localeCompare(right)),
    indexPath,
    selectedReportCount: selectedPaths.length,
    topicCount: selectedTopics.size
  };
}
