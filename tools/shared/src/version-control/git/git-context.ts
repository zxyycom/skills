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
