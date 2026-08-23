export type RevisionId = string;

export type ListVersionControlFilesOptions = {
  /** Literal repository-relative file or directory scopes. */
  pathScopes?: readonly string[];
};

export type ListChangedPathsOptions = {
  from: RevisionId;
  to?: RevisionId;
};

export type ListPendingChangedPathsOptions = {
  from: RevisionId;
  /** Literal repository-relative file or directory scopes. */
  pathScopes?: readonly string[];
};

export type ListFirstParentRevisionChangesOptions = {
  /** Excluded revision at the start of the first-parent range. */
  from: RevisionId;
  /** Included revision at the end of the range; defaults to the current revision. */
  to?: RevisionId;
};

export type VersionControlPathChange = {
  /** Null counts identify a binary path whose line counts Git cannot provide. */
  addedLineCount: number | null;
  deletedLineCount: number | null;
  path: string;
};

export type VersionControlRevisionChange = {
  changes: VersionControlPathChange[];
  revision: RevisionId;
};

export type VersionControlFile = {
  data: Uint8Array;
  path: string;
};

export type ReplacePendingFilesOptions = {
  /** Exact pending file set that must still exist when the replacement lock is held. */
  expectedFiles?: readonly VersionControlFile[];
  /** Revision that must still be current when the replacement lock is held. */
  expectedRevision: RevisionId | null;
  /** Exact pending file set that must remain within the literal scope. */
  files: readonly VersionControlFile[];
  /** Literal repository-relative file or directory scope. */
  pathScope: string;
};

export type ReplacePendingFilesResult = {
  pathScope: string;
  pendingPaths: string[];
  previousPaths: string[];
};

export type VersionControlRepository = {
  readonly rootDirectory: string;
  getCurrentRevision: () => Promise<RevisionId | null>;
  listChangedPaths: (options: ListChangedPathsOptions) => Promise<string[]>;
  listPendingChangedPaths: (
    options: ListPendingChangedPathsOptions
  ) => Promise<string[]>;
  listRevisionFiles: (
    revision: RevisionId,
    options?: ListVersionControlFilesOptions
  ) => Promise<string[]>;
  readRevisionFiles: (
    revision: RevisionId,
    options?: ListVersionControlFilesOptions
  ) => Promise<VersionControlFile[]>;
  listWorkspaceChangedPaths: () => Promise<string[]>;
  listWorkspaceFiles: (
    options?: ListVersionControlFilesOptions
  ) => Promise<string[]>;
  readPendingFiles: (
    options?: ListVersionControlFilesOptions
  ) => Promise<VersionControlFile[]>;
  replacePendingFiles: (
    options: ReplacePendingFilesOptions
  ) => Promise<ReplacePendingFilesResult>;
  readRevisionFile: (
    revision: RevisionId,
    filePath: string
  ) => Promise<VersionControlFile | null>;
  resolveRevision: (revision: string) => Promise<RevisionId>;
};
