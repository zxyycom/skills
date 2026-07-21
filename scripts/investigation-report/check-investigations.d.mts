export type InvestigationReportStatus = "调查中" | "暂停" | "已结束";

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

export declare function runInvestigationReportCheckCli(
  argv?: readonly string[]
): Promise<number>;

export declare function validateInvestigationReports(
  options: InvestigationReportCheckOptions
): Promise<InvestigationReportCheckResult>;
