export const decisionStatuses = [
  "active",
  "amended",
  "superseded",
  "invalidated"
] as const;

export type DecisionStatus = typeof decisionStatuses[number];

export const decisionStatusSet: ReadonlySet<string> = new Set(decisionStatuses);

export type DecisionRecord = {
  archived: boolean;
  areaId: string;
  bodyStatus: string | null;
  datePrefix: string;
  decisionPath: string;
  fileName: string;
  fileStatus: string | undefined;
  fullDate: string | null;
  relativePath: string;
  title: string;
};

export type DecisionScanOptions = {
  decisionsDir?: string;
  workspaceRoot?: string;
};

export type DecisionScan = {
  areaIds: Set<string>;
  decisionsDirectory: string;
  errors: string[];
  index: string;
  indexPath: string;
  indexRelativePath: string;
  records: DecisionRecord[];
  workspaceRoot: string;
};

export type DecisionValidationResult = {
  activeCount: number;
  archivedCount: number;
  areaCount: number;
  decisionCount: number;
  errors: string[];
  scan: DecisionScan;
};

export type ExpectedIndex = {
  errors: string[];
  text: string | null;
};

export type MarkdownLink = {
  label: string;
  target: string;
};

export type MarkdownSection = {
  content: string;
  heading: string;
  index: number;
};
