export type RevisionId = string;

export type ListVersionControlFilesOptions = {
  /** Literal repository-relative file or directory scopes. */
  pathScopes?: readonly string[];
};

export type ListChangedPathsOptions = {
  from: RevisionId;
  to?: RevisionId;
};

export type VersionControlFile = {
  data: Uint8Array;
  path: string;
};

export type VersionControlRepository = {
  readonly rootDirectory: string;
  getCurrentRevision: () => Promise<RevisionId | null>;
  listChangedPaths: (options: ListChangedPathsOptions) => Promise<string[]>;
  listRevisionFiles: (
    revision: RevisionId,
    options?: ListVersionControlFilesOptions
  ) => Promise<string[]>;
  listWorkspaceChangedPaths: () => Promise<string[]>;
  listWorkspaceFiles: () => Promise<string[]>;
  readPendingFiles: (
    options?: ListVersionControlFilesOptions
  ) => Promise<VersionControlFile[]>;
};
