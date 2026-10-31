import type { VersionControlFile } from "../../../shared/src/version-control/index.ts";
import type { DecisionId, DecisionSource } from "../types.ts";

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
  duplicateIds: ReadonlySet<DecisionId>;
  sources: ReadonlyMap<DecisionId, DecisionStageSource>;
}>;
