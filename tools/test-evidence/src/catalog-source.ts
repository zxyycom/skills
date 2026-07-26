import fs from "node:fs/promises";
import path from "node:path";
import fastGlob from "fast-glob";
import {
  collectTestEvidenceCases,
  type ParsedTestEvidenceCase
} from "./catalog.ts";
import {
  validateTestEvidenceCases,
  type TestEvidenceCase
} from "./catalog-validation.ts";
import { createDiagnostic } from "./diagnostics.ts";
import type {
  TestEvidenceConfig,
  TestEvidenceDiagnostic
} from "./types.ts";

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
};

export type LoadedTestEvidenceCatalog = TestEvidenceCatalogSourceResult & {
  cases: LoadedTestEvidenceCatalogCase[];
};

export async function loadTestEvidenceCatalog(
  workspaceRoot: string,
  config: TestEvidenceConfig
): Promise<LoadedTestEvidenceCatalog> {
  const sourceResult = await readTestEvidenceCatalogSources(
    workspaceRoot,
    config.catalogPath
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
    if (parsedCases.length === 0) {
      diagnostics.push(createDiagnostic({
        category: "catalog",
        code: "catalog.topic-empty",
        message: `${source.path} must contain at least one test evidence case`,
        path: source.path,
        severity: "error"
      }));
      continue;
    }

    for (const entry of parsedCases) {
      if (entry.headingFormatIsValid && entry.caseIdIsValid) {
        const locations = parsedById.get(entry.id) ?? [];
        locations.push({ line: entry.line, sourcePath: source.path });
        parsedById.set(entry.id, locations);
      }
    }

    const validated = validateTestEvidenceCases(parsedCases, source.path);
    diagnostics.push(...validated.errors.map((message) => createDiagnostic({
      category: "catalog",
      code: "catalog.invalid",
      message,
      path: source.path,
      severity: "error"
    })));

    const casesByLocation = new Map(
      validated.cases.map((entry) => [
        caseLocation(entry.id, entry.line),
        entry
      ])
    );
    for (const parsed of parsedCases) {
      const validatedCase = casesByLocation.get(
        caseLocation(parsed.id, parsed.line)
      );
      if (validatedCase !== undefined) {
        cases.push({
          parsed,
          sourcePath: source.path,
          validated: validatedCase
        });
      }
    }
  }

  for (const [caseId, locations] of parsedById) {
    const sourcePaths = new Set(locations.map((entry) => entry.sourcePath));
    if (sourcePaths.size <= 1) {
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

  return { cases, diagnostics, sources: sourceResult.sources };
}

export async function readTestEvidenceCatalogSources(
  workspaceRoot: string,
  catalogPath: string
): Promise<TestEvidenceCatalogSourceResult> {
  const catalogDirectory = path.join(
    workspaceRoot,
    ...catalogPath.split("/")
  );
  try {
    const stats = await fs.stat(catalogDirectory);
    if (!stats.isDirectory()) {
      return {
        diagnostics: [createDiagnostic({
          category: "catalog",
          code: "catalog.not-directory",
          message: `${catalogPath} must be a directory of topic Markdown files`,
          path: catalogPath,
          severity: "error"
        })],
        sources: []
      };
    }
  } catch (error) {
    return {
      diagnostics: [createDiagnostic({
        category: "catalog",
        code: "catalog.read-failed",
        message: `${catalogPath} could not be read: ${errorText(error)}`,
        path: catalogPath,
        severity: "error"
      })],
      sources: []
    };
  }

  let relativePaths: string[];
  try {
    relativePaths = (await fastGlob("*.md", {
      cwd: catalogDirectory,
      dot: false,
      followSymbolicLinks: false,
      onlyFiles: true
    }))
      .map((relativePath) => relativePath.replaceAll("\\", "/"))
      .sort(compareText);
  } catch (error) {
    return {
      diagnostics: [createDiagnostic({
        category: "catalog",
        code: "catalog.read-failed",
        message: `${catalogPath} could not be read: ${errorText(error)}`,
        path: catalogPath,
        severity: "error"
      })],
      sources: []
    };
  }

  if (relativePaths.length === 0) {
    return {
      diagnostics: [createDiagnostic({
        category: "catalog",
        code: "catalog.empty",
        message: `${catalogPath} must contain at least one topic Markdown file`,
        path: catalogPath,
        severity: "error"
      })],
      sources: []
    };
  }

  const diagnostics: TestEvidenceDiagnostic[] = [];
  const sources: TestEvidenceCatalogSource[] = [];
  for (const relativePath of relativePaths) {
    const sourcePath = path.posix.join(catalogPath, relativePath);
    try {
      sources.push({
        path: sourcePath,
        text: await fs.readFile(
          path.join(catalogDirectory, ...relativePath.split("/")),
          "utf8"
        )
      });
    } catch (error) {
      diagnostics.push(createDiagnostic({
        category: "catalog",
        code: "catalog.read-failed",
        message: `${sourcePath} could not be read: ${errorText(error)}`,
        path: sourcePath,
        severity: "error"
      }));
    }
  }
  return { diagnostics, sources };
}

function caseLocation(id: string, line: number): string {
  return `${id}\0${line}`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
