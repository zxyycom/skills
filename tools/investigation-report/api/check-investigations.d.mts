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
  warnings: string[];
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
  warnings: string[];
};

export type InvestigationIndexStageOptions = {
  investigationsDir?: string;
  topicIds: readonly string[];
  workspaceRoot: string;
};

export type InvestigationIndexStageDiagnostic = {
  code: string;
  message: string;
  path: string | null;
  stateId: string | null;
};

type InvestigationIndexStageBase = {
  diagnostics: InvestigationIndexStageDiagnostic[];
  indexPath: string;
  namespace: string;
  selectedIds: string[];
};

export type InvestigationIndexStageResult =
  | (InvestigationIndexStageBase & {
      changed: true;
      state: "staged";
      status: "ok";
    })
  | (InvestigationIndexStageBase & {
      changed: false;
      state: "unchanged";
      status: "ok";
    })
  | (InvestigationIndexStageBase & {
      changed: false;
      state:
        | "collection-changed"
        | "definition-invalid"
        | "index-path-invalid"
        | "operation-aborted"
        | "pending-conflict"
        | "pending-write-failed"
        | "revision-index-invalid"
        | "revision-read-failed"
        | "selection-invalid"
        | "target-invalid"
        | "workspace-index-invalid";
      status: "error";
    })
  | (InvestigationIndexStageBase & {
      changed: null;
      state: "pending-recovery-failed";
      status: "error";
    });

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

export declare function runInvestigationReportCheckCli(
  argv?: readonly string[]
): Promise<number>;

export declare function synchronizeInvestigationIndex(
  options: InvestigationIndexSyncOptions
): Promise<InvestigationIndexSyncResult>;

export declare function stageInvestigationIndex(
  options: InvestigationIndexStageOptions
): Promise<InvestigationIndexStageResult>;

export declare function queryInvestigationIndex(
  options: InvestigationIndexQueryOptions
): Promise<InvestigationIndexQueryResult>;

export declare function validateInvestigationReports(
  options: InvestigationReportCheckOptions
): Promise<InvestigationReportCheckResult>;
