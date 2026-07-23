export const changePlanArtifactNames = [
  "proposal.md",
  "design.md",
  "tasks.md"
] as const;

export type ChangePlanArtifactName = typeof changePlanArtifactNames[number];

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

export type ArtifactStructureContract = {
  file: ChangePlanArtifactName;
  h1: string;
  requiredSections: readonly string[];
  taskSections?: readonly string[];
};

export type ArtifactValidationResult = {
  completedTaskCount: number;
  diagnostics: ChangePlanDiagnostic[];
  taskCount: number;
};
