import type {
  StateIndexDiagnostic,
  StateIndexEntryStageResult
} from "../../index-runtime/src/index.ts";

export const investigationReportStatuses = ["调查中", "暂停", "已结束"] as const;

export type InvestigationReportStatus = typeof investigationReportStatuses[number];

export function isInvestigationReportStatus(
  value: string
): value is InvestigationReportStatus {
  return investigationReportStatuses.some((status) => status === value);
}

export type InvestigationReportCheckOptions = {
  categories?: readonly string[];
  investigationsDir?: string;
  paths?: readonly string[];
  workspaceRoot: string;
};

export type InvestigationReportCheckResult = {
  availableTopicCount: number;
  categoryCount: number;
  errors: string[];
  indexChecked: boolean;
  indexPath: string;
  selectedTopicCount: number;
};

export type InvestigationIndexSyncOptions = {
  investigationsDir?: string;
  workspaceRoot: string;
};

export type InvestigationIndexSyncResult = {
  categoryCount: number;
  changed: boolean;
  errors: string[];
  indexPath: string;
  topicCount: number;
};

export type InvestigationIndexStageOptions = {
  investigationsDir?: string;
  topicIds: readonly string[];
  workspaceRoot: string;
};

export type InvestigationIndexStageDiagnostic = StateIndexDiagnostic;

export type InvestigationIndexStageResult = StateIndexEntryStageResult;

export type InvestigationIndexQueryOptions = {
  categories?: readonly string[];
  investigationsDir?: string;
  latestReportAtFrom?: string;
  latestReportAtTo?: string;
  limit?: number;
  offset?: number;
  paths?: readonly string[];
  statuses?: readonly InvestigationReportStatus[];
  text?: string;
  workspaceRoot: string;
};

export type InvestigationIndexQueryResult = {
  entries: InvestigationIndexState[];
  errors: string[];
  indexPath: string;
  limit: number;
  offset: number;
  total: number;
};

export type InvestigationResourceMetadata = {
  id: string;
  sha256: string;
};

export type InvestigationIndexMetadata = {
  resources: InvestigationResourceMetadata[];
};

export type InvestigationResourceReference = {
  reportIndex: number;
  resourceIds: string[];
};

export type InvestigationIndexState = {
  latestReportAt: string;
  path: string;
  question: string;
  reportCount: number;
  reportTitles: string[];
  resourceReferences: InvestigationResourceReference[];
  status: InvestigationReportStatus;
  title: string;
};

export type InvestigationSource = Readonly<{
  path: string;
  text: string;
}>;

export type InvestigationResourceSource = Readonly<{
  bytes: Uint8Array;
  id: string;
}>;

export type InvestigationReportProjection = {
  latestReportAt: string | null;
  question: string | null;
  status: string | null;
  title: string | null;
};

export type InvestigationReportEntryProjection = {
  formedAt: string | null;
  line: number;
  resourceIds: string[];
  title: string;
};

export type ParsedInvestigationReport = {
  errors: string[];
  projection: InvestigationReportProjection;
  reports: InvestigationReportEntryProjection[];
};
