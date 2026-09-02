import fs from "node:fs/promises";
import path from "node:path";
import { createDiagnostic } from "./diagnostics.ts";
import { getTestEvidenceCaseState } from "./query.ts";
import {
  testEvidenceCatalogPath,
  testEvidenceIndexPath,
  testEvidenceReportSchemaVersion
} from "./schemas.ts";
import type {
  TestEvidenceCaseShowResult,
  TestEvidenceDiagnostic
} from "./types.ts";

export type ShowTestEvidenceCaseOptions = {
  caseId: string;
  workspaceRoot: string;
};

export async function showTestEvidenceCase(
  options: ShowTestEvidenceCaseOptions
): Promise<TestEvidenceCaseShowResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const found = await getTestEvidenceCaseState({
    caseId: options.caseId,
    workspaceRoot
  });
  const entry = found.case;
  if (entry === null) {
    return createShowFailureResult(found.diagnostics, {
      topic: found.topic
    });
  }

  const read = await readCaseText(workspaceRoot, found.catalogPath, entry);
  if (read.text === null) {
    return createShowFailureResult([read.diagnostic], { topic: found.topic });
  }

  const lines = read.text.split(/\r\n?|\n/u);
  const markdown = lines
    .slice(entry.line - 1, entry.endLine)
    .join("\n")
    .trimEnd();
  const expectedHeading = `### Case ${entry.id}: ${entry.title}`;
  if (markdown.split("\n", 1)[0] !== expectedHeading) {
    return createShowFailureResult(
      [staleCaseDiagnostic(found.indexPath, entry)],
      {
        topic: found.topic
      }
    );
  }

  return {
    case: entry,
    catalogPath: found.catalogPath,
    diagnostics: found.diagnostics,
    indexPath: found.indexPath,
    markdown,
    schemaVersion: testEvidenceReportSchemaVersion,
    topic: found.topic
  };
}

type CatalogCaseEntry = NonNullable<
  Awaited<ReturnType<typeof getTestEvidenceCaseState>>["case"]
>;

async function readCaseText(
  workspaceRoot: string,
  catalogPath: string,
  entry: CatalogCaseEntry
): Promise<
  | { diagnostic: null; text: string }
  | { diagnostic: TestEvidenceDiagnostic; text: null }
> {
  try {
    const text = await fs.readFile(
      path.join(
        workspaceRoot,
        ...catalogPath.split("/"),
        ...entry.sourcePath.split("/")
      ),
      "utf8"
    );
    return { diagnostic: null, text };
  } catch (error) {
    return {
      diagnostic: createDiagnostic({
        caseId: entry.id,
        category: "catalog",
        code: "catalog.read-failed",
        message: `${entry.sourcePath} could not be read: ${errorText(error)}`,
        path: entry.sourcePath,
        severity: "error"
      }),
      text: null
    };
  }
}

function staleCaseDiagnostic(
  indexPath: string,
  entry: CatalogCaseEntry
): TestEvidenceDiagnostic {
  return createDiagnostic({
    caseId: entry.id,
    category: "index",
    code: "state-index.index-stale",
    line: entry.line,
    message:
      `${indexPath} no longer locates ${entry.id} in ` +
      `${entry.sourcePath}. Run sync-index --write to rebuild the index`,
    path: indexPath,
    severity: "error"
  });
}

function createShowFailureResult(
  diagnostics: readonly TestEvidenceDiagnostic[],
  paths: {
    topic?: TestEvidenceCaseShowResult["topic"];
  } = {}
): TestEvidenceCaseShowResult {
  return {
    case: null,
    catalogPath: testEvidenceCatalogPath,
    diagnostics: [...diagnostics],
    indexPath: testEvidenceIndexPath,
    markdown: null,
    schemaVersion: testEvidenceReportSchemaVersion,
    topic: paths.topic ?? null
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
