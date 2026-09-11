import type {
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import type { DecisionId, DecisionSource } from "./types.ts";

export type DecisionStageSource = {
  file: VersionControlFile;
  source: DecisionSource;
};

export type FilesystemDecisionCandidates = Readonly<{
  duplicateIds: ReadonlySet<DecisionId>;
  sources: ReadonlyMap<DecisionId, DecisionStageSource>;
}>;

export type SelectedFilesystemSource = {
  decisionId: DecisionId;
  source: DecisionStageSource | null;
};

export type DecisionStageTarget = {
  revision: RevisionId | null;
  selectedIds: DecisionId[];
  selectedSources: SelectedFilesystemSource[];
  sourceFiles: VersionControlFile[];
  sources: DecisionSource[];
};

export type DecisionStageTargetOptions = Readonly<{
  decisionsDirectory: string;
  decisionScope: string;
  repository: VersionControlRepository;
  revision: RevisionId | null;
  selectedSelectors: readonly string[];
}>;
