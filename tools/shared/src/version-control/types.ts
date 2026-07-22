export type RevisionId = string;

/** An immutable committed revision or the mutable content prepared for the next revision. */
export type VersionControlSnapshot =
  | { kind: "pending" }
  | { kind: "revision"; revision: RevisionId };

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
  fileExists: (
    snapshot: VersionControlSnapshot,
    repositoryPath: string
  ) => Promise<boolean>;
  getCurrentRevision: () => Promise<RevisionId | null>;
  /** Returns the primary parent; the Git implementation uses the first parent. */
  getParentRevision: (revision: RevisionId) => Promise<RevisionId | null>;
  listChangedPaths: (options: ListChangedPathsOptions) => Promise<string[]>;
  listFiles: (
    snapshot: VersionControlSnapshot,
    options?: ListVersionControlFilesOptions
  ) => Promise<string[]>;
  listWorkspaceChangedPaths: () => Promise<string[]>;
  listWorkspaceFiles: () => Promise<string[]>;
  readFile: (
    snapshot: VersionControlSnapshot,
    repositoryPath: string
  ) => Promise<Uint8Array | null>;
  readFiles: (
    snapshot: VersionControlSnapshot,
    options?: ListVersionControlFilesOptions
  ) => Promise<VersionControlFile[]>;
  resolveRevision: (revision: string) => Promise<RevisionId>;
};
