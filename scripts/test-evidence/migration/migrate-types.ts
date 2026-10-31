export type ExpectedSource = Readonly<{
  projectId: string;
  revision: string;
  scopeId: string;
}>;

export type SnapshotEntity = Readonly<{
  id: string;
  locators: readonly string[];
  name: string;
}>;

export type Snapshot = Readonly<{
  completeness: "complete" | "partial";
  entities: readonly SnapshotEntity[];
  schemaVersion: 2;
  source: ExpectedSource;
}>;

export type ConvertedCase = Readonly<{
  id: string;
  sourcePath: string;
  text: string;
  title: string;
}>;

export type SourceFile = Readonly<{
  bytes: Uint8Array;
  dev: number;
  ino: number;
  mode: number;
  path: string;
}>;

export type MigrationIndex = Readonly<{
  definitionVersion: 6;
  entries: Readonly<
    Record<
      string,
      Readonly<{
        sourcePath: string;
        tags: readonly string[];
        testIds: readonly string[];
        title: string;
      }>
    >
  >;
  metadata: Readonly<Record<string, never>>;
  namespace: "test-evidence";
  schemaVersion: 4;
  sourceRevision: Readonly<{
    entries: Readonly<Record<string, string>>;
    metadata: string;
  }>;
}>;

export type MigrationPlan = Readonly<{
  addedPaths: readonly string[];
  cases: readonly ConvertedCase[];
  index: MigrationIndex;
  legacyCaseCount: number;
  legacyFingerprints: Readonly<Record<string, string>>;
  removedPaths: readonly string[];
  snapshotFingerprint: string;
}>;

export class MigrationError extends Error {}
