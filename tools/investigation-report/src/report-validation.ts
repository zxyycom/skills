import { validateInvestigationTopicPath } from "./report-path.ts";
import { investigationTimestampMilliseconds } from "./timestamp.ts";
import {
  investigationReportStatuses,
  type InvestigationIndexState,
  type InvestigationReportEntryProjection,
  type ParsedInvestigationReport
} from "./types.ts";

export type InvestigationTopicStateBuildResult = {
  errors: string[];
  state: InvestigationIndexState | null;
};

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
    errors.push(
      `${source} status must be one of: ${investigationReportStatuses.join(", ")}`
    );
  }
  if (
    latestReportAt !== null
    && investigationTimestampMilliseconds(latestReportAt) === null
  ) {
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
    const formedMilliseconds = investigationTimestampMilliseconds(report.formedAt);
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
    errors.push(
      `${source} latest report time must exactly match the last report formed time`
    );
  }
}

export function buildInvestigationTopicState(
  relativePath: string,
  report: ParsedInvestigationReport
): InvestigationTopicStateBuildResult {
  const errors = [
    ...validateInvestigationTopicPath(relativePath),
    ...report.errors
  ];
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

  const { latestReportAt, question, status, title } = report.projection;
  if (
    errors.length > 0
    || latestReportAt === null
    || question === null
    || status === null
    || title === null
    || !(investigationReportStatuses as readonly string[]).includes(status)
  ) {
    return {
      errors: [...new Set(errors)],
      state: null
    };
  }

  return {
    errors: [],
    state: {
      latestReportAt,
      path: relativePath,
      question,
      reportCount: report.reports.length,
      reportTitles: report.reports.map((entry) => entry.title),
      status: status as InvestigationIndexState["status"],
      title
    }
  };
}
