import type { ChangePlanMetadata } from "./metadata.ts";

export const changePlanArtifactNames = [
  "proposal.md",
  "design.md",
  "tasks.md"
] as const;

export const changePlanMetadataName = ".change-plan.json" as const;

export type ChangePlanArtifactName = typeof changePlanArtifactNames[number];

export type ChangePlanMetadataName = typeof changePlanMetadataName;

export type ChangePlanFileName = ChangePlanArtifactName | ChangePlanMetadataName;

export type ChangePlanStage =
  | "draft"
  | "plan"
  | "implementation"
  | "shelved";

export type { ChangePlanMetadata } from "./metadata.ts";

export type ChangePlanAssessment =
  | {
    assessment: "not-applicable";
  }
  | {
    assessment: "plan-review-required";
    baseCommit: string | null;
    headCommit: string | null;
    reason: "base-unavailable";
  }
  | {
    assessment: "current" | "shelve-candidate";
    baseCommit: string;
    changedLines: number;
    commitCount: number;
    headCommit: string;
    policy: "git-distance-v1";
  };

export type ChangePlanTaskSection =
  | "readiness"
  | "implementation"
  | "verification";

export type ChangePlanTaskHeading =
  | "Readiness"
  | "Implementation"
  | "Verification";

export type ChangePlanArtifactHeading =
  | "Why"
  | "Outcome"
  | "Scope"
  | "Success Criteria"
  | "Affected Owners"
  | "Context"
  | "Goals / Non-Goals"
  | "Decisions"
  | "Risks / Trade-offs"
  | "Open Questions"
  | ChangePlanTaskHeading;

export type ChangePlanArtifactTitle = "Proposal" | "Design" | "Tasks";

export type ChangePlanTaskSectionProgress = {
  completedTaskCount: number;
  taskCount: number;
};

export type ChangePlanTaskProgress = Record<
  ChangePlanTaskSection,
  ChangePlanTaskSectionProgress
>;

export type ChangePlanDiagnosticCode =
  | "change-directory-not-found"
  | "change-directory-read-failed"
  | "change-path-not-directory"
  | "duplicate-section"
  | "duplicate-task-id"
  | "empty-introduction"
  | "empty-section"
  | "file-read-failed"
  | "invalid-change-name"
  | "invalid-h1"
  | "invalid-metadata"
  | "invalid-task-syntax"
  | "missing-required-file"
  | "missing-section"
  | "missing-task"
  | "plan-review-required"
  | "required-path-not-file"
  | "section-order"
  | "task-outside-required-section"
  | "version-control-failed";

export type ChangePlanDiagnostic = {
  code: ChangePlanDiagnosticCode;
  file: ChangePlanFileName | null;
  line?: number;
  message: string;
};

export type ChangePlanCheckResult = {
  assessment: ChangePlanAssessment | null;
  changeDirectory: string;
  changeName: string;
  completedTaskCount: number;
  diagnostics: ChangePlanDiagnostic[];
  metadata: ChangePlanMetadata | null;
  stage: ChangePlanStage | null;
  taskCount: number;
  taskProgress: ChangePlanTaskProgress;
  valid: boolean;
};

export type ChangePlanStatus = "active" | "archived";

export type ChangePlanCollectionSelection = ChangePlanStatus | "all";

export type ChangePlanCollectionOptions = {
  changeRoot?: string;
  status?: ChangePlanCollectionSelection;
};

export type ChangePlanListOptions = ChangePlanCollectionOptions & {
  stage?: ChangePlanStage;
};

export type ChangePlanListEntry = ChangePlanCheckResult & {
  status: ChangePlanStatus;
};

export type ChangePlanListResult = {
  changeRoot: string;
  entries: ChangePlanListEntry[];
  errors: string[];
  status: ChangePlanCollectionSelection;
};

export type ChangePlanCollectionCheckResult = ChangePlanListResult & {
  checkedCount: number;
  invalidCount: number;
  valid: boolean;
  validCount: number;
};

export type ChangePlanArtifactContents = Record<
  ChangePlanArtifactName,
  string | null
>;

export type ChangePlanShowResult = {
  artifacts: ChangePlanArtifactContents;
  check: ChangePlanCheckResult;
  status: ChangePlanStatus;
};

export type ChangePlanLifecycleAction =
  | "plan"
  | "implement"
  | "shelve"
  | "reconcile"
  | "resume";

export type ChangePlanLifecycleErrorCode =
  | "artifact-check-failed"
  | "base-commit-unavailable"
  | "change-check-failed"
  | "delivery-already-started"
  | "invalid-assessment"
  | "invalid-source-stage"
  | "metadata-write-failed"
  | "readiness-incomplete"
  | "reason-required"
  | "version-control-failed";

export type ChangePlanLifecycleSuccess = {
  action: ChangePlanLifecycleAction;
  fromStage: ChangePlanStage;
  metadata: ChangePlanMetadata;
  success: true;
};

export type ChangePlanLifecycleFailure = {
  action: ChangePlanLifecycleAction;
  diagnostics: ChangePlanDiagnostic[];
  error: string;
  errorCode: ChangePlanLifecycleErrorCode;
  fromStage: ChangePlanStage | null;
  success: false;
};

export type ChangePlanLifecycleResult =
  | ChangePlanLifecycleSuccess
  | ChangePlanLifecycleFailure;

type ChangePlanArchiveResultBase = {
  archiveDirectory: string;
  archivedDirectory: string;
  sourceDirectory: string;
};

export type ChangePlanArchiveResult = ChangePlanArchiveResultBase & (
  | {
    archived: true;
    check: ChangePlanCheckResult;
    error: null;
  }
  | {
    archived: false;
    check: ChangePlanCheckResult | null;
    error: string;
  }
);

export type ArtifactStructureContract = {
  file: ChangePlanArtifactName;
  h1: ChangePlanArtifactTitle;
  requiredSections: readonly ChangePlanArtifactHeading[];
  taskSections?: readonly ChangePlanTaskHeading[];
};

export type ArtifactValidationResult = {
  completedTaskCount: number;
  diagnostics: ChangePlanDiagnostic[];
  taskCount: number;
  taskProgress: ChangePlanTaskProgress;
};
