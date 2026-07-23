import fs from "node:fs/promises";
import path from "node:path";
import { createDiagnostic } from "./diagnostics.ts";
import { getTestEvidenceCaseState } from "./query.ts";
import {
  defaultTestEvidenceCatalogPath,
  defaultTestEvidenceIndexPath,
  testEvidenceReportSchemaVersion
} from "./schemas.ts";
import type {
  TestEvidenceCaseShowResult,
  TestEvidenceDiagnostic
} from "./types.ts";

export type ShowTestEvidenceCaseOptions = {
  caseId: string;
  config?: unknown;
  configPath?: string;
  workspaceRoot: string;
};

export async function showTestEvidenceCase(
  options: ShowTestEvidenceCaseOptions
): Promise<TestEvidenceCaseShowResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const found = await getTestEvidenceCaseState({
    caseId: options.caseId,
    config: options.config,
    configPath: options.configPath,
    workspaceRoot
  });
  const entry = found.case;
  if (entry === null) {
    return createShowFailureResult(found.diagnostics, {
      catalogPath: found.catalogPath,
      indexPath: found.indexPath
    });
  }

  let text: string;
  try {
    text = await fs.readFile(
      path.join(workspaceRoot, ...found.catalogPath.split("/")),
      "utf8"
    );
  } catch (error) {
    return createShowFailureResult([
      createDiagnostic({
        caseId: entry.id,
        category: "catalog",
        code: "catalog.read-failed",
        message: `${found.catalogPath} could not be read: ${errorText(error)}`,
        path: found.catalogPath,
        severity: "error"
      })
    ], {
      catalogPath: found.catalogPath,
      indexPath: found.indexPath
    });
  }

  const lines = text.split(/\r\n?|\n/u);
  const markdown = lines.slice(entry.line - 1, entry.endLine).join("\n").trimEnd();
  const expectedHeading = `### Case ${entry.id}: ${entry.title}`;
  if (markdown.split("\n", 1)[0] !== expectedHeading) {
    return createShowFailureResult([
      createDiagnostic({
        caseId: entry.id,
        category: "index",
        code: "state-index.index-stale",
        line: entry.line,
        message: `${found.indexPath} no longer locates ${entry.id} in `
          + `${found.catalogPath}. Run sync-index --write to rebuild the index`,
        path: found.indexPath,
        severity: "error"
      })
    ], {
      catalogPath: found.catalogPath,
      indexPath: found.indexPath
    });
  }

  return {
    case: entry,
    catalogPath: found.catalogPath,
    diagnostics: found.diagnostics,
    indexPath: found.indexPath,
    markdown,
    schemaVersion: testEvidenceReportSchemaVersion
  };
}

export function createShowFailureResult(
  diagnostics: readonly TestEvidenceDiagnostic[],
  paths: {
    catalogPath?: string;
    indexPath?: string;
  } = {}
): TestEvidenceCaseShowResult {
  return {
    case: null,
    catalogPath: paths.catalogPath ?? defaultTestEvidenceCatalogPath,
    diagnostics: [...diagnostics],
    indexPath: paths.indexPath ?? defaultTestEvidenceIndexPath,
    markdown: null,
    schemaVersion: testEvidenceReportSchemaVersion
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
