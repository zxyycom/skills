/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/staging/decision-stage-contracts.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/staging/decision-stage-contracts.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/staging/decision-stage-contracts.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
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
