import fs from "node:fs/promises";
import path from "node:path";
import { createDiagnostic } from "./diagnostics.ts";
import { getVerificationCaseState } from "./query.ts";
import {
  defaultVerificationEvidenceCatalogPath,
  defaultVerificationEvidenceIndexPath,
  verificationEvidenceReportSchemaVersion
} from "./schemas.ts";
import type {
  VerificationCaseShowResult,
  VerificationEvidenceDiagnostic
} from "./types.ts";

export type ShowVerificationCaseOptions = {
  caseId: string;
  config?: unknown;
  configPath?: string;
  workspaceRoot: string;
};

export async function showVerificationCase(
  options: ShowVerificationCaseOptions
): Promise<VerificationCaseShowResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const found = await getVerificationCaseState({
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
  const markdown = lines.slice(entry.line - 1, entry.endLine)
    .join("\n")
    .trimEnd();
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
    schemaVersion: verificationEvidenceReportSchemaVersion
  };
}

function createShowFailureResult(
  diagnostics: readonly VerificationEvidenceDiagnostic[],
  paths: {
    catalogPath?: string;
    indexPath?: string;
  } = {}
): VerificationCaseShowResult {
  return {
    case: null,
    catalogPath: paths.catalogPath ?? defaultVerificationEvidenceCatalogPath,
    diagnostics: [...diagnostics],
    indexPath: paths.indexPath ?? defaultVerificationEvidenceIndexPath,
    markdown: null,
    schemaVersion: verificationEvidenceReportSchemaVersion
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
