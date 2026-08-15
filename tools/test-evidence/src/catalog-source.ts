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

export async function loadTestEvidenceCatalog(
  workspaceRoot: string
): Promise<LoadedTestEvidenceCatalog> {
  const sourceResult = await readTestEvidenceCatalogSources(workspaceRoot);
  const diagnostics = [...sourceResult.diagnostics];
  const cases: LoadedTestEvidenceCatalogCase[] = [];
  const parsedById = new Map<
    string,
    Array<{ line: number; sourcePath: string }>
  >();
  const caseIdPattern = new RegExp(testEvidenceCaseIdPatternSource, "u");

  for (const source of sourceResult.sources) {
    const parsedCases = collectTestEvidenceCases(source.text, caseIdPattern);
    const firstCase = parsedCases[0];
    const startsWithValidCaseHeading =
      firstCase?.line === 1 &&
      firstCase.headingFormatIsValid &&
      firstCase.caseIdIsValid;
    if (!startsWithValidCaseHeading) {
      diagnostics.push(
        createDiagnostic({
          category: "catalog",
          code: "catalog.invalid",
          message:
            `${source.path} must start on line 1 with ` +
            "### Case <CASE-ID>: <title>",
          path: source.path,
          severity: "error"
        })
      );
    }
    for (const entry of parsedCases) {
      if (entry.headingFormatIsValid && entry.caseIdIsValid) {
        const locations = parsedById.get(entry.id) ?? [];
        locations.push({ line: entry.line, sourcePath: source.path });
        parsedById.set(entry.id, locations);
      }
    }

    if (parsedCases.length !== 1) {
      diagnostics.push(
        createDiagnostic({
          category: "catalog",
          code: "catalog.case-count-invalid",
          message:
            `${source.path} must contain exactly one test evidence case; ` +
            `found ${parsedCases.length}`,
          path: source.path,
          severity: "error"
        })
      );
      continue;
    }

    const parsed = parsedCases[0];
    if (parsed === undefined) {
      continue;
    }
    const validated = validateTestEvidenceCase(parsed, source.path);
    diagnostics.push(
      ...validated.errors.map((message) =>
        createDiagnostic({
          category: "catalog",
          code: "catalog.invalid",
          message,
          path: source.path,
          severity: "error"
        })
      )
    );
    if (validated.case !== null && startsWithValidCaseHeading) {
      cases.push({
        parsed,
        source,
        validated: validated.case
      });
    }
  }

  for (const [caseId, locations] of parsedById) {
    if (locations.length <= 1) {
      continue;
    }
    diagnostics.push(
      createDiagnostic({
        caseId,
        category: "catalog",
        code: "catalog.case-id-duplicate",
        message: `duplicate case ID across catalog: ${caseId} (${locations
          .map((entry) => `${entry.sourcePath}:${entry.line}`)
          .join(", ")})`,
        path: testEvidenceCatalogPath,
        severity: "error"
      })
    );
  }

  return {
    cases,
    diagnostics,
    sources: sourceResult.sources,
    topicCatalog: sourceResult.topicCatalog
  };
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

  let entries: Dirent[];
  try {
    entries = await fs.readdir(catalogDirectory, { withFileTypes: true });
    entries.sort((left, right) => compareText(left.name, right.name));
  } catch (error) {
    diagnostics.push(
      createDiagnostic({
        category: "catalog",
        code: "catalog.read-failed",
        message: `${testEvidenceCatalogPath} could not be read: ${errorText(error)}`,
        path: testEvidenceCatalogPath,
        severity: "error"
      })
    );
    return { diagnostics, sources: [], topicCatalog };
  }

  const sources: TestEvidenceCatalogSource[] = [];
  for (const entry of entries) {
    if (entry.isFile()) {
      if (!allowedRootFiles.has(entry.name)) {
        diagnostics.push(
          createDiagnostic({
            category: "catalog",
            code: "catalog.root-file-unsupported",
            message: `${testEvidenceCatalogPath} root contains unsupported file ${
              entry.name
            }`,
            path: path.posix.join(testEvidenceCatalogPath, entry.name),
            severity: "error"
          })
        );
      }
      continue;
    }
    if (!entry.isDirectory()) {
      diagnostics.push(
        createDiagnostic({
          category: "catalog",
          code: "catalog.root-entry-unsupported",
          message: `${testEvidenceCatalogPath} contains unsupported entry ${
            entry.name
          }`,
          path: path.posix.join(testEvidenceCatalogPath, entry.name),
          severity: "error"
        })
      );
      continue;
    }
    if (!topicIds.has(entry.name)) {
      diagnostics.push(
        createDiagnostic({
          category: "catalog",
          code: "catalog.topic-unknown",
          message: `topic directory is not defined in ${
            testEvidenceTopicCatalogFileName
          }: ${entry.name}`,
          path: path.posix.join(testEvidenceCatalogPath, entry.name),
          severity: "error"
        })
      );
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

  diagnostics.push(
    ...(await indexIdentityDiagnostics({
      sources,
      workspaceRoot
    }))
  );
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
      diagnostics: [
        createDiagnostic({
          category: "catalog",
          code: "catalog.topic-read-failed",
          message: `${topicPath} could not be read: ${errorText(error)}`,
          path: topicPath,
          severity: "error"
        })
      ],
      sources: []
    };
  }

  const sources: TestEvidenceCatalogSource[] = [];
  for (const entry of entries) {
    const sourcePath = path.posix.join(options.topicId, entry.name);
    if (!entry.isFile() || !isTestEvidenceCaseFileName(entry.name)) {
      diagnostics.push(
        createDiagnostic({
          category: "catalog",
          code: "catalog.topic-entry-unsupported",
          message: `${sourcePath} must be a direct semantic-slug.md case file`,
          path: path.posix.join(options.catalogPath, sourcePath),
          severity: "error"
        })
      );
      continue;
    }
    try {
      sources.push({
        path: sourcePath,
        text: await fs.readFile(path.join(topicDirectory, entry.name), "utf8")
      });
    } catch (error) {
      diagnostics.push(
        createDiagnostic({
          category: "catalog",
          code: "catalog.read-failed",
          message: `${sourcePath} could not be read: ${errorText(error)}`,
          path: path.posix.join(options.catalogPath, sourcePath),
          severity: "error"
        })
      );
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
