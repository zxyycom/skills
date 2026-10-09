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

export type VersionControlPathChange = Readonly<{
  /** Null counts identify a binary path whose line counts Git cannot provide. */
  addedLineCount: number | null;
  deletedLineCount: number | null;
  path: string;
}>;

export type VersionControlRevisionChange = Readonly<{
  changes: readonly VersionControlPathChange[];
  revision: RevisionId;
}>;

export type VersionControlFileKind = "regular" | "executable" | "symlink";

export type VersionControlFile = Readonly<{
  data: Uint8Array;
  kind: VersionControlFileKind;
  path: string;
}>;

export type ReplacePendingFilesOptions = Readonly<{
  /** Exact pending file set that must still exist when the replacement lock is held. */
  expectedFiles?: readonly VersionControlFile[];
  /** Revision that must still be current when the replacement lock is held. */
  expectedRevision: RevisionId | null;
  /** Exact pending file set that must remain within the literal scope. */
  files: readonly VersionControlFile[];
  /** Literal repository-relative file or directory scope. */
  pathScope: string;
}>;

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
  /** Reads a regular workspace file with its effective executable representation. */
  readWorkspaceFile: (filePath: string) => Promise<VersionControlFile | null>;
  replacePendingFiles: (
    options: ReplacePendingFilesOptions
  ) => Promise<ReplacePendingFilesResult>;
  readRevisionFile: (
    revision: RevisionId,
    filePath: string
  ) => Promise<VersionControlFile | null>;
  resolveRevision: (revision: string) => Promise<RevisionId>;
};
