import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import {
  collectTestEvidenceCases,
  type ParsedTestEvidenceCase
} from "./catalog.ts";
import {
  validateTestEvidenceCase,
  type TestEvidenceCase
} from "./catalog-validation.ts";
import { createDiagnostic } from "./diagnostics.ts";
import {
  testEvidenceCaseIdPatternSource,
  testEvidenceCatalogPath,
  testEvidenceIndexPath,
  type TestEvidenceDiagnostic,
  type TestEvidenceTopicCatalog
} from "./schemas.ts";
import { loadTestEvidenceTopicCatalog } from "./topic-catalog.ts";
import {
  isTestEvidenceCaseFileName,
  testEvidenceTopicCatalogFileName
} from "./topic.ts";
import { workspaceRelativePathsAreDistinct } from "./workspace-path.ts";

export type TestEvidenceCatalogSource = {
  path: string;
  text: string;
};

export type LoadedTestEvidenceCatalogCase = {
  parsed: ParsedTestEvidenceCase;
  source: TestEvidenceCatalogSource;
  validated: TestEvidenceCase;
};

export type TestEvidenceCatalogSourceResult = {
  diagnostics: TestEvidenceDiagnostic[];
  sources: TestEvidenceCatalogSource[];
  topicCatalog: TestEvidenceTopicCatalog | null;
};

export type LoadedTestEvidenceCatalog = TestEvidenceCatalogSourceResult & {
  cases: LoadedTestEvidenceCatalogCase[];
};

type CatalogCaseLocation = Readonly<{ line: number; sourcePath: string }>;
type CatalogCaseLocations = ReadonlyMap<string, readonly CatalogCaseLocation[]>;

type CatalogLoadContext = Readonly<{
  cases: LoadedTestEvidenceCatalogCase[];
  diagnostics: TestEvidenceDiagnostic[];
  parsedById: Map<string, CatalogCaseLocation[]>;
}>;

export async function loadTestEvidenceCatalog(
  workspaceRoot: string
): Promise<LoadedTestEvidenceCatalog> {
  const sourceResult = await readTestEvidenceCatalogSources(workspaceRoot);
  const diagnostics = [...sourceResult.diagnostics];
  const cases: LoadedTestEvidenceCatalogCase[] = [];
  const parsedById = new Map<string, CatalogCaseLocation[]>();
  const caseIdPattern = new RegExp(testEvidenceCaseIdPatternSource, "u");

  for (const source of sourceResult.sources) {
    loadCatalogSource(source, caseIdPattern, {
      cases,
      diagnostics,
      parsedById
    });
  }
  diagnostics.push(...duplicateCaseIdDiagnostics(parsedById));

  return {
    cases,
    diagnostics,
    sources: sourceResult.sources,
    topicCatalog: sourceResult.topicCatalog
  };
}

function loadCatalogSource(
  source: TestEvidenceCatalogSource,
  caseIdPattern: RegExp,
  context: CatalogLoadContext
): void {
  const parsedCases = collectTestEvidenceCases(source.text, caseIdPattern);
  const startsWithValidCaseHeading = validOpeningCaseHeading(parsedCases[0]);
  if (!startsWithValidCaseHeading) {
    context.diagnostics.push(
      catalogDiagnostic(
        source.path,
        "catalog.invalid",
        `${source.path} must start on line 1 with ### Case <CASE-ID>: <title>`
      )
    );
  }
  recordCaseLocations(parsedCases, source.path, context.parsedById);
  if (parsedCases.length !== 1) {
    context.diagnostics.push(
      catalogDiagnostic(
        source.path,
        "catalog.case-count-invalid",
        `${source.path} must contain exactly one test evidence case; found ${parsedCases.length}`
      )
    );
    return;
  }

  const parsed = parsedCases[0];
  if (parsed === undefined) {
    return;
  }
  const validated = validateTestEvidenceCase(parsed, source.path);
  context.diagnostics.push(
    ...validated.errors.map((message) =>
      catalogDiagnostic(source.path, "catalog.invalid", message)
    )
  );
  if (validated.case !== null && startsWithValidCaseHeading) {
    context.cases.push({ parsed, source, validated: validated.case });
  }
}

function validOpeningCaseHeading(
  parsed: ParsedTestEvidenceCase | undefined
): boolean {
  return (
    parsed?.line === 1 && parsed.headingFormatIsValid && parsed.caseIdIsValid
  );
}

function recordCaseLocations(
  cases: readonly ParsedTestEvidenceCase[],
  sourcePath: string,
  parsedById: Map<string, CatalogCaseLocation[]>
): void {
  for (const entry of cases) {
    if (!entry.headingFormatIsValid || !entry.caseIdIsValid) {
      continue;
    }
    const locations = parsedById.get(entry.id) ?? [];
    locations.push({ line: entry.line, sourcePath });
    parsedById.set(entry.id, locations);
  }
}

function duplicateCaseIdDiagnostics(
  parsedById: CatalogCaseLocations
): TestEvidenceDiagnostic[] {
  const diagnostics: TestEvidenceDiagnostic[] = [];
  for (const [caseId, locations] of parsedById) {
    if (locations.length > 1) {
      diagnostics.push(
        createDiagnostic({
          caseId,
          category: "catalog",
          code: "catalog.case-id-duplicate",
          message: `duplicate case ID across catalog: ${caseId} (${formatCaseLocations(
            locations
          )})`,
          path: testEvidenceCatalogPath,
          severity: "error"
        })
      );
    }
  }
  return diagnostics;
}

function formatCaseLocations(
  locations: readonly CatalogCaseLocation[]
): string {
  const formatted: string[] = [];
  for (const entry of locations) {
    formatted.push(`${entry.sourcePath}:${entry.line}`);
  }
  return formatted.join(", ");
}

function catalogDiagnostic(
  sourcePath: string,
  code: string,
  message: string
): TestEvidenceDiagnostic {
  return createDiagnostic({
    category: "catalog",
    code,
    message,
    path: sourcePath,
    severity: "error"
  });
}

export async function readTestEvidenceCatalogSources(
  workspaceRoot: string
): Promise<TestEvidenceCatalogSourceResult> {
  const catalogDirectory = path.join(
    workspaceRoot,
    ...testEvidenceCatalogPath.split("/")
  );
  const rootDiagnostic = await inspectCatalogRoot(
    catalogDirectory,
    testEvidenceCatalogPath
  );
  if (rootDiagnostic !== null) {
    return {
      diagnostics: [rootDiagnostic],
      sources: [],
      topicCatalog: null
    };
  }

  const loadedTopics = await loadTestEvidenceTopicCatalog(workspaceRoot);
  const diagnostics = [...loadedTopics.diagnostics];
  const topicCatalog = loadedTopics.catalog;
  if (topicCatalog === null) {
    return { diagnostics, sources: [], topicCatalog: null };
  }

  const topicIds = new Set(topicCatalog.topics.map((topic) => topic.id));
  const allowedRootFiles = new Set([
    testEvidenceTopicCatalogFileName,
    path.posix.basename(testEvidenceIndexPath)
  ]);

  const rootEntries = await readCatalogDirectoryEntries(catalogDirectory);
  if (rootEntries.entries === null) {
    diagnostics.push(rootEntries.diagnostic);
    return { diagnostics, sources: [], topicCatalog };
  }

  const collected = await collectCatalogDirectorySources(
    catalogDirectory,
    rootEntries.entries,
    allowedRootFiles,
    topicIds
  );
  diagnostics.push(...collected.diagnostics);

  return await finalizeCatalogSources({
    diagnostics,
    sources: collected.sources,
    topicCatalog,
    workspaceRoot
  });
}

async function collectCatalogDirectorySources(
  catalogDirectory: string,
  entries: readonly Dirent[],
  allowedRootFiles: ReadonlySet<string>,
  topicIds: ReadonlySet<string>
): Promise<Pick<TestEvidenceCatalogSourceResult, "diagnostics" | "sources">> {
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const sources: TestEvidenceCatalogSource[] = [];
  for (const entry of entries) {
    const entryDiagnostic = catalogRootEntryDiagnostic(
      entry,
      allowedRootFiles,
      topicIds
    );
    if (entryDiagnostic !== null) {
      diagnostics.push(entryDiagnostic);
    }
    if (!entry.isDirectory() || !topicIds.has(entry.name)) {
      continue;
    }
    const topicSources = await readTopicDirectory({
      catalogDirectory,
      catalogPath: testEvidenceCatalogPath,
      topicId: entry.name
    });
    diagnostics.push(...topicSources.diagnostics);
    sources.push(...topicSources.sources);
  }

  return { diagnostics, sources };
}

async function finalizeCatalogSources(options: {
  diagnostics: TestEvidenceDiagnostic[];
  sources: TestEvidenceCatalogSource[];
  topicCatalog: TestEvidenceTopicCatalog;
  workspaceRoot: string;
}): Promise<TestEvidenceCatalogSourceResult> {
  options.diagnostics.push(
    ...(await indexIdentityDiagnostics({
      sources: options.sources,
      workspaceRoot: options.workspaceRoot
    }))
  );
  options.sources.sort((left, right) => compareText(left.path, right.path));
  return {
    diagnostics: options.diagnostics,
    sources: options.sources,
    topicCatalog: options.topicCatalog
  };
}

async function readCatalogDirectoryEntries(
  catalogDirectory: string
): Promise<
  | { diagnostic: null; entries: Dirent[] }
  | { diagnostic: TestEvidenceDiagnostic; entries: null }
> {
  try {
    const entries = await fs.readdir(catalogDirectory, { withFileTypes: true });
    entries.sort((left, right) => compareText(left.name, right.name));
    return { diagnostic: null, entries };
  } catch (error) {
    return {
      diagnostic: createDiagnostic({
        category: "catalog",
        code: "catalog.read-failed",
        message: `${testEvidenceCatalogPath} could not be read: ${errorText(error)}`,
        path: testEvidenceCatalogPath,
        severity: "error"
      }),
      entries: null
    };
  }
}

function catalogRootEntryDiagnostic(
  entry: Dirent,
  allowedRootFiles: ReadonlySet<string>,
  topicIds: ReadonlySet<string>
): TestEvidenceDiagnostic | null {
  const entryPath = path.posix.join(testEvidenceCatalogPath, entry.name);
  if (entry.isFile()) {
    return allowedRootFiles.has(entry.name)
      ? null
      : catalogDiagnostic(
          entryPath,
          "catalog.root-file-unsupported",
          `${testEvidenceCatalogPath} root contains unsupported file ${entry.name}`
        );
  }
  if (!entry.isDirectory()) {
    return catalogDiagnostic(
      entryPath,
      "catalog.root-entry-unsupported",
      `${testEvidenceCatalogPath} contains unsupported entry ${entry.name}`
    );
  }
  return topicIds.has(entry.name)
    ? null
    : catalogDiagnostic(
        entryPath,
        "catalog.topic-unknown",
        `topic directory is not defined in ${testEvidenceTopicCatalogFileName}: ${entry.name}`
      );
}

async function inspectCatalogRoot(
  catalogDirectory: string,
  catalogPath: string
): Promise<TestEvidenceDiagnostic | null> {
  try {
    const stats = await fs.lstat(catalogDirectory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      return createDiagnostic({
        category: "catalog",
        code: "catalog.not-directory",
        message: `${catalogPath} must be a regular test-evidence directory`,
        path: catalogPath,
        severity: "error"
      });
    }
    return null;
  } catch (error) {
    return createDiagnostic({
      category: "catalog",
      code: "catalog.read-failed",
      message: `${catalogPath} could not be inspected: ${errorText(error)}`,
      path: catalogPath,
      severity: "error"
    });
  }
}

async function readTopicDirectory(options: {
  catalogDirectory: string;
  catalogPath: string;
  topicId: string;
}): Promise<{
  diagnostics: TestEvidenceDiagnostic[];
  sources: TestEvidenceCatalogSource[];
}> {
  const topicDirectory = path.join(options.catalogDirectory, options.topicId);
  const topicPath = path.posix.join(options.catalogPath, options.topicId);
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const topicEntries = await readTopicEntries(topicDirectory, topicPath);
  if (topicEntries.entries === null) {
    return { diagnostics: [topicEntries.diagnostic], sources: [] };
  }

  const sources: TestEvidenceCatalogSource[] = [];
  for (const entry of topicEntries.entries) {
    const read = await readTopicEntry(options, topicDirectory, entry);
    if (read.source === null) {
      diagnostics.push(read.diagnostic);
    } else {
      sources.push(read.source);
    }
  }

  if (sources.length === 0) {
    diagnostics.push(
      createDiagnostic({
        category: "catalog",
        code: "catalog.topic-directory-empty",
        message: `${topicPath} must contain at least one direct case Markdown`,
        path: topicPath,
        severity: "error"
      })
    );
  }
  return { diagnostics, sources };
}

async function readTopicEntries(
  topicDirectory: string,
  topicPath: string
): Promise<
  | { diagnostic: null; entries: Dirent[] }
  | { diagnostic: TestEvidenceDiagnostic; entries: null }
> {
  try {
    const entries = await fs.readdir(topicDirectory, { withFileTypes: true });
    entries.sort((left, right) => compareText(left.name, right.name));
    return { diagnostic: null, entries };
  } catch (error) {
    return {
      diagnostic: catalogDiagnostic(
        topicPath,
        "catalog.topic-read-failed",
        `${topicPath} could not be read: ${errorText(error)}`
      ),
      entries: null
    };
  }
}

async function readTopicEntry(
  options: {
    catalogDirectory: string;
    catalogPath: string;
    topicId: string;
  },
  topicDirectory: string,
  entry: Dirent
): Promise<
  | { diagnostic: null; source: TestEvidenceCatalogSource }
  | { diagnostic: TestEvidenceDiagnostic; source: null }
> {
  const sourcePath = path.posix.join(options.topicId, entry.name);
  const catalogSourcePath = path.posix.join(options.catalogPath, sourcePath);
  if (!entry.isFile() || !isTestEvidenceCaseFileName(entry.name)) {
    return {
      diagnostic: catalogDiagnostic(
        catalogSourcePath,
        "catalog.topic-entry-unsupported",
        `${sourcePath} must be a direct semantic-slug.md case file`
      ),
      source: null
    };
  }
  try {
    return {
      diagnostic: null,
      source: {
        path: sourcePath,
        text: await fs.readFile(path.join(topicDirectory, entry.name), "utf8")
      }
    };
  } catch (error) {
    return {
      diagnostic: catalogDiagnostic(
        catalogSourcePath,
        "catalog.read-failed",
        `${sourcePath} could not be read: ${errorText(error)}`
      ),
      source: null
    };
  }
}

async function indexIdentityDiagnostics(options: {
  sources: readonly TestEvidenceCatalogSource[];
  workspaceRoot: string;
}): Promise<TestEvidenceDiagnostic[]> {
  const candidates = [
    path.posix.join(testEvidenceCatalogPath, testEvidenceTopicCatalogFileName),
    ...options.sources.map((source) =>
      path.posix.join(testEvidenceCatalogPath, source.path)
    )
  ];
  const conflicts: string[] = [];
  try {
    for (const candidate of candidates) {
      if (
        !(await workspaceRelativePathsAreDistinct(options.workspaceRoot, [
          testEvidenceIndexPath,
          candidate
        ]))
      ) {
        conflicts.push(candidate);
      }
    }
  } catch (error) {
    return [
      createDiagnostic({
        category: "catalog",
        code: "catalog.index-identity-inspection-failed",
        message: `The fixed index file identity could not be inspected: ${errorText(
          error
        )}`,
        path: testEvidenceIndexPath,
        severity: "error"
      })
    ];
  }
  return conflicts.length === 0
    ? []
    : [
        createDiagnostic({
          category: "catalog",
          code: "catalog.index-file-conflict",
          message: `The fixed index file must not share a filesystem identity with: ${conflicts.join(
            ", "
          )}`,
          path: testEvidenceIndexPath,
          severity: "error"
        })
      ];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
