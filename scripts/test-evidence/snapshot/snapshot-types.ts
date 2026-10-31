export type RepositoryTestSource = Readonly<{
  projectId: string;
  revision: string;
  scopeId: string;
}>;

export type RepositoryTestEntity = Readonly<{
  id: string;
  locators: readonly string[];
  name: string;
}>;

export type RepositoryTestSnapshot = Readonly<{
  completeness: "complete";
  entities: readonly RepositoryTestEntity[];
  schemaVersion: 2;
  source: RepositoryTestSource;
}>;

export type TestCommand = Readonly<{
  files: readonly string[];
  original: string;
  runner: "bun" | "node";
  scriptName: string;
}>;

export type RegisteredTest = Readonly<{
  file: string;
  line: string | null;
  name: string;
}>;

export type CommandResult = Readonly<{
  exitCode: number | null;
  output: string;
}>;

export type AstGrepMatch = Readonly<{
  sourcePath: string;
  variables: Readonly<Record<string, string>>;
}>;

export type SnapshotOptions = Readonly<{
  expectedSource?: RepositoryTestSource;
  outputPath?: string;
  workspaceRoot: string;
}>;

export const repositoryTestProjectId = "skills-workspace";
export const repositoryTestScopeId = "repository-native-tests-v1";
export const repositoryAstGrepVersion = "0.45.1";
