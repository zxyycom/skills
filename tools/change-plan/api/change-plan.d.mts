export type ChangePlanArtifactName =
  | "proposal.md"
  | "design.md"
  | "tasks.md";

export type ChangePlanDiagnosticCode =
  | "change-directory-not-found"
  | "change-path-not-directory"
  | "duplicate-section"
  | "duplicate-task-id"
  | "empty-introduction"
  | "empty-section"
  | "file-read-failed"
  | "invalid-change-name"
  | "invalid-h1"
  | "invalid-task-syntax"
  | "missing-required-file"
  | "missing-section"
  | "missing-task"
  | "required-path-not-file"
  | "section-order"
  | "task-outside-required-section";

export type ChangePlanDiagnostic = {
  code: ChangePlanDiagnosticCode;
  file: ChangePlanArtifactName | null;
  line?: number;
  message: string;
};

export type ChangePlanCheckResult = {
  changeDirectory: string;
  changeName: string;
  completedTaskCount: number;
  diagnostics: ChangePlanDiagnostic[];
  taskCount: number;
  valid: boolean;
};

export declare function checkChangePlanDirectory(
  changeDirectory: string
): Promise<ChangePlanCheckResult>;

export declare function runChangePlanCli(
  argv?: readonly string[]
): Promise<number>;
