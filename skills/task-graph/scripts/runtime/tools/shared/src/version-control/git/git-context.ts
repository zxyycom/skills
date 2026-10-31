/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/version-control/git/git-context.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/version-control/git/git-context.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/version-control/git/git-context.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/task-graph
 * Rebuild: bun run sync:task-graph-cli
 */
import type { SimpleGit } from "simple-git";

export type PendingReplacementHooks = Readonly<{
  afterPendingWrite?: () => Promise<void> | void;
  beforePendingRecovery?: () => Promise<void> | void;
  beforePendingWrite?: () => Promise<void> | void;
}>;

export type GitRepositoryContext = Readonly<{
  git: SimpleGit;
  hooks: PendingReplacementHooks;
  rootDirectory: string;
}>;
