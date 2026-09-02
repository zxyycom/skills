import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { createDiagnostic } from "./diagnostics.ts";
import {
  testEvidenceCatalogPath,
  testEvidenceTopicCatalogSchema,
  type TestEvidenceDiagnostic,
  type TestEvidenceTopicCatalog
} from "./schemas.ts";
import { testEvidenceTopicCatalogFileName } from "./topic.ts";

export type LoadedTestEvidenceTopicCatalog = {
  catalog: TestEvidenceTopicCatalog | null;
  diagnostics: TestEvidenceDiagnostic[];
  path: string;
};

export async function loadTestEvidenceTopicCatalog(
  workspaceRoot: string
): Promise<LoadedTestEvidenceTopicCatalog> {
  const relativePath = path.posix.join(
    testEvidenceCatalogPath,
    testEvidenceTopicCatalogFileName
  );
  const absolutePath = path.join(workspaceRoot, ...relativePath.split("/"));
  const loaded = await readTopicCatalogText(absolutePath, relativePath);
  if (loaded.text === null) {
    return loaded.failure;
  }

  let input: unknown;
  try {
    input = JSON.parse(loaded.text) as unknown;
  } catch (error) {
    return failedTopicCatalog(
      relativePath,
      "catalog.topics-json-invalid",
      `${relativePath} must be valid JSON: ${errorText(error)}`
    );
  }

  const parsed = v.safeParse(testEvidenceTopicCatalogSchema, input);
  if (!parsed.success) {
    return {
      catalog: null,
      diagnostics: parsed.issues.map((issue) =>
        createDiagnostic({
          category: "catalog",
          code: "catalog.topics-schema-invalid",
          message: `${relativePath} ${formatIssue(issue)}`,
          path: relativePath,
          severity: "error"
        })
      ),
      path: relativePath
    };
  }
  return {
    catalog: parsed.output,
    diagnostics: [],
    path: relativePath
  };
}

async function readTopicCatalogText(
  absolutePath: string,
  relativePath: string
): Promise<
  | { failure: LoadedTestEvidenceTopicCatalog; text: null }
  | { failure: null; text: string }
> {
  let stats: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    stats = await fs.lstat(absolutePath);
  } catch (error) {
    const missing = isMissingFileError(error);
    return {
      failure: failedTopicCatalog(
        relativePath,
        missing ? "catalog.topics-missing" : "catalog.topics-read-failed",
        missing
          ? `${relativePath} is required`
          : `${relativePath} could not be inspected: ${errorText(error)}`
      ),
      text: null
    };
  }
  if (!stats.isFile() || stats.isSymbolicLink()) {
    return {
      failure: failedTopicCatalog(
        relativePath,
        "catalog.topics-not-file",
        `${relativePath} must be a regular JSON file`
      ),
      text: null
    };
  }
  try {
    return { failure: null, text: await fs.readFile(absolutePath, "utf8") };
  } catch (error) {
    return {
      failure: failedTopicCatalog(
        relativePath,
        "catalog.topics-read-failed",
        `${relativePath} could not be read: ${errorText(error)}`
      ),
      text: null
    };
  }
}

export function normalizeTestEvidenceTopicCatalog(
  catalog: TestEvidenceTopicCatalog
): string {
  return JSON.stringify({
    schemaVersion: catalog.schemaVersion,
    topics: catalog.topics.map(({ id, description }) => ({
      id,
      description
    }))
  });
}

function failedTopicCatalog(
  relativePath: string,
  code: string,
  message: string
): LoadedTestEvidenceTopicCatalog {
  return {
    catalog: null,
    diagnostics: [
      createDiagnostic({
        category: "catalog",
        code,
        message,
        path: relativePath,
        severity: "error"
      })
    ],
    path: relativePath
  };
}

function formatIssue(issue: v.BaseIssue<unknown>): string {
  const issuePath = v.getDotPath(issue);
  return issuePath === null ? issue.message : `${issuePath} ${issue.message}`;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
