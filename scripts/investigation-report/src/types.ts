export const investigationReportStatuses = ["调查中", "暂停", "已结束"] as const;

export type InvestigationReportStatus = typeof investigationReportStatuses[number];

export type InvestigationReportCheckOptions = {
  investigationsDir?: string;
  reports?: readonly string[];
  topics?: readonly string[];
  workspaceRoot: string;
};

export type InvestigationReportCheckResult = {
  availableReportCount: number;
  errors: string[];
  indexPath: string;
  selectedReportCount: number;
  topicCount: number;
};

export type InvestigationReportProjection = {
  currentUnderstanding: string | null;
  firstFormedAt: string | null;
  origin: string | null;
  question: string | null;
  scope: string | null;
  status: string | null;
  title: string | null;
  updatedAt: string | null;
};

export type InvestigationRecordProjection = {
  formedAt: string | null;
  line: number;
  title: string;
};

export type InvestigationIndexEntry = {
  line: number;
  path: string | null;
  question: string | null;
  status: string | null;
  title: string | null;
  topic: string | null;
  updatedAt: string | null;
};

export type ScopedInvestigationError =
  | { message: string; scope: "global" }
  | { message: string; scope: "topic"; topic: string }
  | { message: string; path: string; scope: "report" };

export type ParsedInvestigationIndex = {
  entries: InvestigationIndexEntry[];
  errors: ScopedInvestigationError[];
};

export type ParsedInvestigationReport = {
  errors: string[];
  projection: InvestigationReportProjection;
  records: InvestigationRecordProjection[];
};
