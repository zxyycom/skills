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
  defaultTestEvidenceConfigPath,
  type TestEvidenceConfig,
  type TestEvidenceDiagnostic,
  type TestEvidenceTopicCatalog
} from "./schemas.ts";
import {
  loadTestEvidenceTopicCatalog
} from "./topic-catalog.ts";
import {
  catalogRelativeIndexPath,
  isTestEvidenceCaseFileName,
  testEvidenceCatalogReadmeFileName,
  testEvidenceTopicCatalogFileName
} from "./topic.ts";
import {
  workspaceRelativePathsAreDistinct
} from "./workspace-path.ts";

export type TestEvidenceCatalogSource = {
  path: string;
  text: string;
};

export type LoadedTestEvidenceCatalogCase = {
  parsed: ParsedTestEvidenceCase;
  sourcePath: string;
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

export async function loadTestEvidenceCatalog(
  workspaceRoot: string,
  config: TestEvidenceConfig,
  configRelativePath = defaultTestEvidenceConfigPath
): Promise<LoadedTestEvidenceCatalog> {
  const sourceResult = await readTestEvidenceCatalogSources(
    workspaceRoot,
    config,
    configRelativePath
  );
  const diagnostics = [...sourceResult.diagnostics];
  const cases: LoadedTestEvidenceCatalogCase[] = [];
  const parsedById = new Map<
    string,
    Array<{ line: number; sourcePath: string }>
  >();
  const caseIdPattern = new RegExp(config.caseIdPattern, "u");

  for (const source of sourceResult.sources) {
    const parsedCases = collectTestEvidenceCases(source.text, caseIdPattern);
    for (const entry of parsedCases) {
      if (entry.headingFormatIsValid && entry.caseIdIsValid) {
        const locations = parsedById.get(entry.id) ?? [];
        locations.push({ line: entry.line, sourcePath: source.path });
        parsedById.set(entry.id, locations);
      }
    }

    if (parsedCases.length !== 1) {
      diagnostics.push(createDiagnostic({
        category: "catalog",
        code: "catalog.case-count-invalid",
        message: `${source.path} must contain exactly one test evidence case; `
          + `found ${parsedCases.length}`,
        path: source.path,
        severity: "error"
      }));
      continue;
    }

    const parsed = parsedCases[0];
    if (parsed === undefined) {
      continue;
    }
    const validated = validateTestEvidenceCase(parsed, source.path);
    diagnostics.push(...validated.errors.map((message) => createDiagnostic({
      category: "catalog",
      code: "catalog.invalid",
      message,
      path: source.path,
      severity: "error"
    })));
    if (validated.case !== null) {
      cases.push({
        parsed,
        sourcePath: source.path,
        validated: validated.case
      });
    }
  }

  for (const [caseId, locations] of parsedById) {
    if (locations.length <= 1) {
      continue;
    }
    diagnostics.push(createDiagnostic({
      caseId,
      category: "catalog",
      code: "catalog.case-id-duplicate",
      message: `duplicate case ID across catalog: ${caseId} (${
        locations
          .map((entry) => `${entry.sourcePath}:${entry.line}`)
          .join(", ")
      })`,
      path: config.catalogPath,
      severity: "error"
    }));
  }

  return {
    cases,
    diagnostics,
    sources: sourceResult.sources,
    topicCatalog: sourceResult.topicCatalog
  };
}

export async function readTestEvidenceCatalogSources(
  workspaceRoot: string,
  config: TestEvidenceConfig,
  configRelativePath = defaultTestEvidenceConfigPath
): Promise<TestEvidenceCatalogSourceResult> {
  const catalogDirectory = path.join(
    workspaceRoot,
    ...config.catalogPath.split("/")
  );
  const rootDiagnostic = await inspectCatalogRoot(
    catalogDirectory,
    config.catalogPath
  );
  if (rootDiagnostic !== null) {
    return {
      diagnostics: [rootDiagnostic],
      sources: [],
      topicCatalog: null
    };
  }

  const loadedTopics = await loadTestEvidenceTopicCatalog(
    workspaceRoot,
    config.catalogPath
  );
  const diagnostics = [...loadedTopics.diagnostics];
  const topicCatalog = loadedTopics.catalog;
  if (topicCatalog === null) {
    return { diagnostics, sources: [], topicCatalog: null };
  }

  const topicIds = new Set(topicCatalog.topics.map((topic) => topic.id));
  const relativeIndexPath = catalogRelativeIndexPath(
    config.catalogPath,
    config.indexPath
  );
  const allowedRootFiles = new Set([
    testEvidenceTopicCatalogFileName,
    testEvidenceCatalogReadmeFileName,
    ...(
      relativeIndexPath !== null && !relativeIndexPath.includes("/")
        ? [relativeIndexPath]
        : []
    )
  ]);
  if (
    relativeIndexPath !== null
    && !relativeIndexPath.includes("/")
    && topicIds.has(relativeIndexPath)
  ) {
    diagnostics.push(createDiagnostic({
      category: "config",
      code: "config.index-path-conflict",
      message: `indexPath occupies defined topic directory name: ${
        relativeIndexPath
      }`,
      path: configRelativePath,
      severity: "error"
    }));
  }

  let entries: Dirent[];
  try {
    entries = await fs.readdir(catalogDirectory, { withFileTypes: true });
    entries.sort((left, right) => compareText(left.name, right.name));
  } catch (error) {
    diagnostics.push(createDiagnostic({
      category: "catalog",
      code: "catalog.read-failed",
      message: `${config.catalogPath} could not be read: ${errorText(error)}`,
      path: config.catalogPath,
      severity: "error"
    }));
    return { diagnostics, sources: [], topicCatalog };
  }

  const sources: TestEvidenceCatalogSource[] = [];
  for (const entry of entries) {
    if (entry.isFile()) {
      if (!allowedRootFiles.has(entry.name)) {
        diagnostics.push(createDiagnostic({
          category: "catalog",
          code: "catalog.root-file-unsupported",
          message: `${config.catalogPath} root contains unsupported file ${
            entry.name
          }`,
          path: path.posix.join(config.catalogPath, entry.name),
          severity: "error"
        }));
      }
      continue;
    }
    if (!entry.isDirectory()) {
      diagnostics.push(createDiagnostic({
        category: "catalog",
        code: "catalog.root-entry-unsupported",
        message: `${config.catalogPath} contains unsupported entry ${
          entry.name
        }`,
        path: path.posix.join(config.catalogPath, entry.name),
        severity: "error"
      }));
      continue;
    }
    if (!topicIds.has(entry.name)) {
      diagnostics.push(createDiagnostic({
        category: "catalog",
        code: "catalog.topic-unknown",
        message: `topic directory is not defined in ${
          testEvidenceTopicCatalogFileName
        }: ${entry.name}`,
        path: path.posix.join(config.catalogPath, entry.name),
        severity: "error"
      }));
      continue;
    }
    const topicSources = await readTopicDirectory({
      catalogDirectory,
      catalogPath: config.catalogPath,
      topicId: entry.name
    });
    diagnostics.push(...topicSources.diagnostics);
    sources.push(...topicSources.sources);
  }

  diagnostics.push(...await indexIdentityDiagnostics({
    config,
    configRelativePath,
    sources,
    workspaceRoot
  }));
  sources.sort((left, right) => compareText(left.path, right.path));
  return { diagnostics, sources, topicCatalog };
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
  let entries: Dirent[];
  try {
    entries = await fs.readdir(topicDirectory, { withFileTypes: true });
    entries.sort((left, right) => compareText(left.name, right.name));
  } catch (error) {
    return {
      diagnostics: [createDiagnostic({
        category: "catalog",
        code: "catalog.topic-read-failed",
        message: `${topicPath} could not be read: ${errorText(error)}`,
        path: topicPath,
        severity: "error"
      })],
      sources: []
    };
  }

  const sources: TestEvidenceCatalogSource[] = [];
  for (const entry of entries) {
    const sourcePath = path.posix.join(options.topicId, entry.name);
    if (!entry.isFile() || !isTestEvidenceCaseFileName(entry.name)) {
      diagnostics.push(createDiagnostic({
        category: "catalog",
        code: "catalog.topic-entry-unsupported",
        message: `${sourcePath} must be a direct semantic-slug.md case file`,
        path: path.posix.join(options.catalogPath, sourcePath),
        severity: "error"
      }));
      continue;
    }
    try {
      sources.push({
        path: sourcePath,
        text: await fs.readFile(
          path.join(topicDirectory, entry.name),
          "utf8"
        )
      });
    } catch (error) {
      diagnostics.push(createDiagnostic({
        category: "catalog",
        code: "catalog.read-failed",
        message: `${sourcePath} could not be read: ${errorText(error)}`,
        path: path.posix.join(options.catalogPath, sourcePath),
        severity: "error"
      }));
    }
  }

  if (sources.length === 0) {
    diagnostics.push(createDiagnostic({
      category: "catalog",
      code: "catalog.topic-directory-empty",
      message: `${topicPath} must contain at least one direct case Markdown`,
      path: topicPath,
      severity: "error"
    }));
  }
  return { diagnostics, sources };
}

async function indexIdentityDiagnostics(options: {
  config: TestEvidenceConfig;
  configRelativePath: string;
  sources: readonly TestEvidenceCatalogSource[];
  workspaceRoot: string;
}): Promise<TestEvidenceDiagnostic[]> {
  const candidates = [
    path.posix.join(
      options.config.catalogPath,
      testEvidenceTopicCatalogFileName
    ),
    path.posix.join(
      options.config.catalogPath,
      testEvidenceCatalogReadmeFileName
    ),
    options.configRelativePath,
    ...options.sources.map((source) => path.posix.join(
      options.config.catalogPath,
      source.path
    ))
  ];
  const conflicts: string[] = [];
  try {
    for (const candidate of candidates) {
      if (!await workspaceRelativePathsAreDistinct(
        options.workspaceRoot,
        [options.config.indexPath, candidate]
      )) {
        conflicts.push(candidate);
      }
    }
  } catch (error) {
    return [createDiagnostic({
      category: "config",
      code: "config.path-inspection-failed",
      message: `indexPath identities could not be inspected: ${
        errorText(error)
      }`,
      path: options.configRelativePath,
      severity: "error"
    })];
  }
  return conflicts.length === 0
    ? []
    : [createDiagnostic({
        category: "config",
        code: "config.index-path-conflict",
        message: `indexPath must not share a path or filesystem identity with: ${
          conflicts.join(", ")
        }`,
        path: options.configRelativePath,
        severity: "error"
      })];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
