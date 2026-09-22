import type {
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import type { DecisionId, DecisionSource } from "./types.ts";

/**
 * Selects which pending paths one stage transaction writes: the derived index
 * projection and the formal Decision Markdown together (`all`, the default),
 * only the index projection (`index`), or only the formal Markdown while the
 * pending index stays byte-identical (`domain`).
 */
export type DecisionStageScope = "all" | "index" | "domain";

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
