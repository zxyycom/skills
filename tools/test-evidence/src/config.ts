import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { createDiagnostic } from "./diagnostics.ts";
import {
  testEvidenceLedgerConfigSchema,
  testEvidenceLedgerConfigSchemaVersion
} from "./schemas.ts";
import type {
  TestEvidenceDiagnostic,
  TestEvidenceLedgerConfig
} from "./types.ts";
import { normalizeWorkspaceRelative } from "./workspace-path.ts";

const defaultTestEvidenceLedgerConfigPath = ".test-evidence.json";

export type LoadedTestEvidenceLedgerConfig = {
  config: TestEvidenceLedgerConfig | null;
  configRelativePath: string;
  diagnostics: TestEvidenceDiagnostic[];
};

export async function loadTestEvidenceLedgerConfig(
  workspaceRoot: string,
  requestedConfigPath?: string,
  providedConfig?: unknown
): Promise<LoadedTestEvidenceLedgerConfig> {
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const requestedPath = requestedConfigPath ?? defaultTestEvidenceLedgerConfigPath;
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
        value = { schemaVersion: testEvidenceLedgerConfigSchemaVersion };
      } else {
        diagnostics.push(createDiagnostic({
          category: "config",
          code: isMissingFileError(error) ? "config.not-found" : "config.read-failed",
          message: `${configRelativePath} could not be read: ${errorMessage(error)}`,
          path: configRelativePath,
          severity: "error"
        }));
        return { config: null, configRelativePath, diagnostics };
      }
    }
  }

  const parsed = v.safeParse(testEvidenceLedgerConfigSchema, value);
  if (!parsed.success) {
    diagnostics.push(...parsed.issues.map((issue) => {
      const issuePath = v.getDotPath(issue);
      return createDiagnostic({
        category: "config",
        code: "config.schema-invalid",
        message: `${configRelativePath}${issuePath === null ? "" : ` ${issuePath}`} ${issue.message}`,
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
  try {
    new RegExp(parsed.output.caseIdPattern, "u");
  } catch (error) {
    diagnostics.push(createDiagnostic({
      category: "config",
      code: "config.case-id-pattern-invalid",
      message: `caseIdPattern must be a valid regular expression: ${errorMessage(error)}`,
      path: configRelativePath,
      severity: "error"
    }));
  }

  if (catalogPath === null || diagnostics.length > 0) {
    return { config: null, configRelativePath, diagnostics };
  }
  return {
    config: { ...parsed.output, catalogPath },
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
