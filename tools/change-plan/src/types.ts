import type { ChangePlanMetadata } from "./metadata.ts";

export const changePlanArtifactNames = [
  "proposal.md",
  "design.md",
  "tasks.md"
] as const;

export const changePlanMetadataName = ".change-plan.json" as const;

export type ChangePlanArtifactName = (typeof changePlanArtifactNames)[number];

export type ChangePlanMetadataName = typeof changePlanMetadataName;

export type ChangePlanFileName =
  | ChangePlanArtifactName
  | ChangePlanMetadataName;

export type ChangePlanStage = ChangePlanMetadata["stage"];

export type { ChangePlanMetadata } from "./metadata.ts";

export type GitDistanceEvidence = {
  baseCommit: string;
  changedLines: number;
  commitCount: number;
  headCommit: string;
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

export type ChangePlanArtifactSubheading =
  | "Intended Change"
  | "Resulting Impacts";

export type ChangePlanArtifactSubsectionOwner = "Decisions" | "Scope";

export type ArtifactSubsectionContract = {
  ownerSection: ChangePlanArtifactSubsectionOwner;
  requiredSubsections: readonly ChangePlanArtifactSubheading[];
};

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
  | "base-commit-unavailable"
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
  changeDirectory: string;
  changeName: string;
  completedTaskCount: number;
  diagnostics: ChangePlanDiagnostic[];
  distance: GitDistanceEvidence | null;
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

export type ChangePlanLifecycleAction = "plan";

export type ChangePlanLifecycleErrorCode =
  | "artifact-check-failed"
  | "base-commit-unavailable"
  | "invalid-source-stage"
  | "metadata-write-failed"
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

export type ChangePlanArchiveResult = ChangePlanArchiveResultBase &
  (
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
  subsectionContracts?: readonly ArtifactSubsectionContract[];
  taskSections?: readonly ChangePlanTaskHeading[];
};

export type ArtifactValidationResult = {
  completedTaskCount: number;
  diagnostics: ChangePlanDiagnostic[];
  taskCount: number;
  taskProgress: ChangePlanTaskProgress;
};
