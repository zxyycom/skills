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

export type DecisionStageSource = Readonly<{
  file: VersionControlFile;
  source: DecisionSource;
}>;

export type FilesystemDecisionCandidates = Readonly<{
  paths: ReadonlyMap<
    string,
    Readonly<{ source: DecisionStageSource }> | Readonly<{ error: unknown }>
  >;
  duplicateIds: ReadonlySet<DecisionId>;
  sources: ReadonlyMap<DecisionId, DecisionStageSource>;
}>;

export type SelectedFilesystemSource = Readonly<{
  decisionId: DecisionId;
  source: DecisionStageSource | null;
}>;

export type DecisionStageTarget = Readonly<{
  revision: RevisionId | null;
  selectedIds: readonly DecisionId[];
  selectedSources: readonly SelectedFilesystemSource[];
  sourceFiles: readonly VersionControlFile[];
  sources: readonly DecisionSource[];
}>;

export type DecisionStageTargetOptions = Readonly<{
  decisionsDirectory: string;
  decisionScope: string;
  repository: VersionControlRepository;
  revision: RevisionId | null;
  selectedSelectors: readonly string[];
}>;
