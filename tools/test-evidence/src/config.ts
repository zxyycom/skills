import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { createDiagnostic } from "./diagnostics.ts";
import {
  defaultTestEvidenceConfigPath,
  testEvidenceConfigSchema,
  testEvidenceConfigSchemaVersion
} from "./schemas.ts";
import {
  catalogRelativeIndexPath,
  testEvidenceCatalogReadmeFileName,
  testEvidenceTopicCatalogFileName
} from "./topic.ts";
import type {
  TestEvidenceConfig,
  TestEvidenceDiagnostic
} from "./types.ts";
import {
  normalizeWorkspaceRelative,
  workspaceRelativePathsAreDistinct
} from "./workspace-path.ts";

export type LoadedTestEvidenceConfig = {
  config: TestEvidenceConfig | null;
  configRelativePath: string;
  diagnostics: TestEvidenceDiagnostic[];
};

export async function loadTestEvidenceConfig(
  workspaceRoot: string,
  requestedConfigPath?: string,
  providedConfig?: unknown
): Promise<LoadedTestEvidenceConfig> {
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const requestedPath = requestedConfigPath
    ?? defaultTestEvidenceConfigPath;
  const configRelativePath = normalizeRelativePath(
    requestedPath,
    "config path",
    diagnostics
  );
  if (configRelativePath === null) {
    return { config: null, configRelativePath: requestedPath, diagnostics };
  }

  let value = providedConfig;
  if (value === undefined) {
    try {
      value = JSON.parse(
        await fs.readFile(path.join(workspaceRoot, configRelativePath), "utf8")
      ) as unknown;
    } catch (error) {
      if (isMissingFileError(error) && requestedConfigPath === undefined) {
        value = { schemaVersion: testEvidenceConfigSchemaVersion };
      } else {
        diagnostics.push(createDiagnostic({
          category: "config",
          code: isMissingFileError(error)
            ? "config.not-found"
            : "config.read-failed",
          message: `${configRelativePath} could not be read: ${errorMessage(error)}`,
          path: configRelativePath,
          severity: "error"
        }));
        return { config: null, configRelativePath, diagnostics };
      }
    }
  }

  const parsed = v.safeParse(testEvidenceConfigSchema, value);
  if (!parsed.success) {
    diagnostics.push(...parsed.issues.map((issue) => {
      const issuePath = v.getDotPath(issue);
      return createDiagnostic({
        category: "config",
        code: "config.schema-invalid",
        message: `${configRelativePath}${
          issuePath === null ? "" : ` ${issuePath}`
        } ${issue.message}`,
        path: configRelativePath,
        severity: "error"
      });
    }));
    return { config: null, configRelativePath, diagnostics };
  }

  const catalogPath = normalizeRelativePath(
    parsed.output.catalogPath,
    "catalogPath",
    diagnostics,
    configRelativePath
  );
  const indexPath = normalizeRelativePath(
    parsed.output.indexPath,
    "indexPath",
    diagnostics,
    configRelativePath
  );
  try {
    new RegExp(parsed.output.caseIdPattern, "u");
  } catch (error) {
    diagnostics.push(createDiagnostic({
      category: "config",
      code: "config.case-id-pattern-invalid",
      message: "caseIdPattern must be a valid regular expression: "
        + errorMessage(error),
      path: configRelativePath,
      severity: "error"
    }));
  }

  let pathsAreDistinct = true;
  if (catalogPath !== null && indexPath !== null) {
    try {
      const topicCatalogPath = path.posix.join(
        catalogPath,
        testEvidenceTopicCatalogFileName
      );
      const readmePath = path.posix.join(
        catalogPath,
        testEvidenceCatalogReadmeFileName
      );
      pathsAreDistinct = await workspaceRelativePathsAreDistinct(
        workspaceRoot,
        [
          catalogPath,
          indexPath,
          configRelativePath,
          topicCatalogPath,
          readmePath
        ]
      );
    } catch (error) {
      diagnostics.push(createDiagnostic({
        category: "config",
        code: "config.path-inspection-failed",
        message: `Configured path identities could not be inspected: ${errorMessage(error)}`,
        path: configRelativePath,
        severity: "error"
      }));
    }
  }
  if (!pathsAreDistinct) {
    diagnostics.push(createDiagnostic({
      category: "config",
      code: "config.path-conflict",
      message: "catalogPath, indexPath, the config path, and reserved "
        + "test-evidence root files must have distinct filesystem identities",
      path: configRelativePath,
      severity: "error"
    }));
  }

  if (catalogPath !== null && indexPath !== null) {
    const relativeIndexPath = catalogRelativeIndexPath(
      catalogPath,
      indexPath
    );
    if (
      relativeIndexPath !== null
      && relativeIndexPath.includes("/")
    ) {
      diagnostics.push(createDiagnostic({
        category: "config",
        code: "config.index-path-invalid",
        message: "indexPath must be outside catalogPath or identify one "
          + `root-level index file inside ${catalogPath}`,
        path: configRelativePath,
        severity: "error"
      }));
    }
  }

  if (catalogPath === null || indexPath === null || diagnostics.length > 0) {
    return { config: null, configRelativePath, diagnostics };
  }
  return {
    config: { ...parsed.output, catalogPath, indexPath },
    configRelativePath,
    diagnostics
  };
}

function normalizeRelativePath(
  value: string,
  field: string,
  diagnostics: TestEvidenceDiagnostic[],
  diagnosticPath?: string
): string | null {
  const normalized = normalizeWorkspaceRelative(value);
  if (normalized === null) {
    diagnostics.push(createDiagnostic({
      category: "config",
      code: "config.path-invalid",
      message: `${field} must be a workspace-relative path: ${value}`,
      path: diagnosticPath,
      severity: "error"
    }));
  }
  return normalized;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
