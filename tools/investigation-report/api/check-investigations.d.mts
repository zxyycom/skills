export type InvestigationReportStatus = "调查中" | "暂停" | "已结束";

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

export type InvestigationIndexState = {
  latestReportAt: string;
  path: string;
  question: string;
  reportCount: number;
  reportTitles: string[];
  status: InvestigationReportStatus;
  title: string;
};

export declare function runInvestigationReportCheckCli(
  argv?: readonly string[]
): Promise<number>;

export declare function synchronizeInvestigationIndex(
  options: InvestigationIndexSyncOptions
): Promise<InvestigationIndexSyncResult>;

export declare function queryInvestigationIndex(
  options: InvestigationIndexQueryOptions
): Promise<InvestigationIndexQueryResult>;

export declare function validateInvestigationReports(
  options: InvestigationReportCheckOptions
): Promise<InvestigationReportCheckResult>;
