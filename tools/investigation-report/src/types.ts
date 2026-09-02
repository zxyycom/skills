import type {
  StateIndexDiagnostic,
  StateIndexEntryStageResult
} from "../../index-runtime/src/index.ts";
import type {
  InvestigationDiagnostic,
  InvestigationMutationDiagnostic
} from "./diagnostics.ts";

export const investigationRelationTypes = [
  "补充",
  "复查",
  "修正",
  "推翻",
  "归并",
  "拆分"
] as const;

export type InvestigationRelationType =
  (typeof investigationRelationTypes)[number];

export type InvestigationRelation = Readonly<{
  target: string;
  type: InvestigationRelationType;
}>;

export type InvestigationCandidateReadiness = Readonly<{
  bodyReady: boolean;
  resourceReady: boolean;
  scaffoldValid: boolean;
}>;

export type InvestigationCandidate = Readonly<{
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  id: string;
  markdown: string | null;
  path: string;
  readiness: InvestigationCandidateReadiness;
  warnings: string[];
}>;

export type InvestigationCandidateCreateOptions = Readonly<{
  formedAt: string;
  id: string;
  investigationsDir?: string;
  question: string;
  relations: readonly InvestigationRelation[];
  tags: readonly string[];
  title: string;
  workspaceRoot: string;
}>;

export type InvestigationCandidateCreateResult =
  | Readonly<{
      candidate: InvestigationCandidate;
      changed: true;
      diagnostics: InvestigationDiagnostic[];
      errors: [];
      status: "ok";
      warnings: string[];
    }>
  | Readonly<{
      candidate: null;
      changed: false;
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "invalid-options" | "error";
      warnings: string[];
    }>;

export type InvestigationCandidateListOptions = Readonly<{
  investigationsDir?: string;
  workspaceRoot: string;
}>;

export type InvestigationCandidateListResult =
  | Readonly<{
      candidates: InvestigationCandidate[];
      diagnostics: InvestigationDiagnostic[];
      errors: [];
      status: "ok";
      warnings: string[];
    }>
  | Readonly<{
      candidates: InvestigationCandidate[];
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
      warnings: string[];
    }>;

export type InvestigationCandidateShowOptions = Readonly<{
  id: string;
  investigationsDir?: string;
  workspaceRoot: string;
}>;

export type InvestigationCandidateShowResult =
  | Readonly<{
      candidate: InvestigationCandidate;
      diagnostics: InvestigationDiagnostic[];
      errors: [];
      status: "ok";
      warnings: string[];
    }>
  | Readonly<{
      candidate: null;
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
      warnings: string[];
    }>;

export type InvestigationCandidatePublishOptions = Readonly<{
  ids: readonly string[];
  investigationsDir?: string;
  preflight?: boolean;
  workspaceRoot: string;
}>;

export type InvestigationCandidatePublishResult = Readonly<{
  changed: boolean;
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  ids: string[];
  indexPath: string;
  mutation?: InvestigationMutationDiagnostic;
  preflight: boolean;
  warnings: string[];
}>;

export type InvestigationCandidateDiscardOptions = Readonly<{
  deleteOwnedResources?: boolean;
  deleteRecordedCandidate?: boolean;
  id: string;
  investigationsDir?: string;
  workspaceRoot: string;
}>;

export type InvestigationCandidateDiscardResult = Readonly<{
  changed: boolean;
  deletedResourceIds: string[];
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  id: string;
  mutation?: InvestigationMutationDiagnostic;
  requiresRecordedDeletionConfirmation: boolean;
}>;

export type InvestigationReportCheckOptions = {
  ids?: readonly string[];
  investigationsDir?: string;
  workspaceRoot: string;
};

export type InvestigationReportCheckResult = {
  availableReportCount: number;
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  indexChecked: boolean;
  indexPath: string;
  selectedReportCount: number;
  warnings: string[];
};

export type InvestigationIndexSyncOptions = {
  investigationsDir?: string;
  workspaceRoot: string;
};

export type InvestigationIndexSyncResult = {
  changed: boolean;
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  indexPath: string;
  mutation?: InvestigationMutationDiagnostic;
  reportCount: number;
  warnings: string[];
};

export type InvestigationIndexStageOptions = {
  investigationsDir?: string;
  reportIds: readonly string[];
  workspaceRoot: string;
};

export type InvestigationIndexStageDiagnostic = StateIndexDiagnostic;

export type InvestigationIndexStageResult = StateIndexEntryStageResult;

export type InvestigationIndexQueryOptions = {
  formedAtFrom?: string;
  formedAtTo?: string;
  investigationsDir?: string;
  limit?: number;
  offset?: number;
  relationType?: InvestigationRelationType;
  tags?: readonly string[];
  text?: string;
  workspaceRoot: string;
};

export type InvestigationIndexQueryEntry = Readonly<{
  id: string;
  state: InvestigationIndexState;
}>;

export type InvestigationIndexQueryResult = {
  diagnostics: InvestigationDiagnostic[];
  entries: InvestigationIndexQueryEntry[];
  errors: string[];
  indexPath: string;
  limit: number;
  offset: number;
  total: number;
};

export type InvestigationReportShowOptions = {
  id: string;
  investigationsDir?: string;
  workspaceRoot: string;
};

export type InvestigationReportShowResult =
  | Readonly<{
      errors: string[];
      diagnostics: InvestigationDiagnostic[];
      id: string;
      indexPath: string;
      markdown: string;
      state: InvestigationIndexState;
      status: "ok";
    }>
  | Readonly<{
      errors: string[];
      diagnostics: InvestigationDiagnostic[];
      id: string;
      indexPath: string;
      markdown: null;
      state: null;
      status: "error";
    }>;

export type InvestigationTraceDirection =
  | "predecessors"
  | "successors"
  | "both";

export type InvestigationReportTraceOptions = {
  direction?: InvestigationTraceDirection;
  id: string;
  investigationsDir?: string;
  maxDepth?: number;
  workspaceRoot: string;
};

export type InvestigationRelationEdge = Readonly<{
  source: string;
  target: string;
  type: InvestigationRelationType;
}>;

export type InvestigationReportTraceResult =
  | Readonly<{
      edges: InvestigationRelationEdge[];
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      id: string;
      indexPath: string;
      reportIds: string[];
      status: "ok";
    }>
  | Readonly<{
      edges: InvestigationRelationEdge[];
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      id: string;
      indexPath: string;
      reportIds: string[];
      status: "error";
    }>;

export type InvestigationRelationReplacement = Readonly<{
  relations: readonly InvestigationRelation[];
  source: string;
}>;

export type InvestigationRelationSetOptions = {
  investigationsDir?: string;
  replacements: readonly InvestigationRelationReplacement[];
  workspaceRoot: string;
};

export type InvestigationRelationSetResult = Readonly<{
  changed: boolean;
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  indexPath: string;
  mutation?: InvestigationMutationDiagnostic;
  sourceIds: string[];
}>;

export type InvestigationReportDiscardOptions = {
  deleteOwnedResources?: boolean;
  deleteRecordedReport?: boolean;
  id: string;
  investigationsDir?: string;
  workspaceRoot: string;
};

export type InvestigationReportDiscardResult = Readonly<{
  changed: boolean;
  deletedResourceIds: string[];
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  id: string;
  indexPath: string;
  mutation?: InvestigationMutationDiagnostic;
  requiresRecordedDeletionConfirmation: boolean;
}>;

export type InvestigationIndexMetadata = Record<string, never>;

export type InvestigationIndexState = Readonly<{
  formedAt: string;
  question: string;
  relations: InvestigationRelation[];
  resourceIds: string[];
  tags: string[];
  title: string;
}>;

export type InvestigationSource = Readonly<{
  id: string;
  text: string;
}>;

export type ParsedInvestigationReport = Readonly<{
  bodyErrors: string[];
  errors: string[];
  frontmatterErrors: string[];
  report: ParsedInvestigationReportDocument | null;
  resourceErrors: string[];
}>;

export type ParsedInvestigationReportDocument = Readonly<{
  formedAt: string;
  frontmatter: Readonly<{
    endLine: number;
    relationsEndLine: number;
    relationsStartLine: number;
  }>;
  question: string;
  relations: InvestigationRelation[];
  resourceIds: string[];
  tags: string[];
  title: string;
}>;
