import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { createDiagnostic } from "./diagnostics.ts";
import {
  regexCollectorConfigSchema,
  regexCollectorConfigSchemaVersion
} from "./schemas.ts";
import {
  type RegexCollectorConfig,
  type TestEvidenceDiagnostic
} from "./types.ts";
import { normalizeWorkspaceRelative } from "./workspace-path.ts";

export const defaultRegexCollectorConfigPath = ".test-entry-regex.json";
const defaultRegexCollectorConfig = v.parse(regexCollectorConfigSchema, {
  schemaVersion: regexCollectorConfigSchemaVersion
});

export type LoadedRegexCollectorConfig = {
  config: RegexCollectorConfig | null;
  configRelativePath: string;
  diagnostics: TestEvidenceDiagnostic[];
};

export async function loadRegexCollectorConfig(
  workspaceRoot: string,
  requestedConfigPath?: string,
  providedConfig?: unknown
): Promise<LoadedRegexCollectorConfig> {
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const requestedPath = requestedConfigPath ?? defaultRegexCollectorConfigPath;
  const configRelativePath = normalizeWorkspaceRelative(requestedPath);
  if (configRelativePath === null) {
    diagnostics.push(createDiagnostic({
      category: "config",
      code: "collector.config-path-invalid",
      message: `collector config path must be workspace-relative: ${requestedPath}`,
      severity: "error"
    }));
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
        value = { schemaVersion: regexCollectorConfigSchemaVersion };
      } else {
        diagnostics.push(createDiagnostic({
          category: "config",
          code: isMissingFileError(error)
            ? "collector.config-not-found"
            : "collector.config-read-failed",
          message: `${configRelativePath} could not be read: ${errorMessage(error)}`,
          path: configRelativePath,
          severity: "error"
        }));
        return { config: null, configRelativePath, diagnostics };
      }
    }
  }

  const parsed = v.safeParse(regexCollectorConfigSchema, value);
  if (!parsed.success) {
    diagnostics.push(...parsed.issues.map((issue) => {
      const issuePath = v.getDotPath(issue);
      return createDiagnostic({
        category: "config",
        code: "collector.config-schema-invalid",
        message: `${configRelativePath}${issuePath === null ? "" : ` ${issuePath}`} ${issue.message}`,
        path: configRelativePath,
        severity: "error"
      });
    }));
    return { config: null, configRelativePath, diagnostics };
  }

  const config = normalizeConfig(parsed.output, configRelativePath, diagnostics);
  return {
    config: diagnostics.length === 0 ? config : null,
    configRelativePath,
    diagnostics
  };
}

function normalizeConfig(
  config: RegexCollectorConfig,
  configPath: string,
  diagnostics: TestEvidenceDiagnostic[]
): RegexCollectorConfig {
  const normalizeGlobs = (values: readonly string[], field: string): string[] =>
    [...new Set(values.flatMap((value) => {
      const normalized = normalizeWorkspaceRelative(value);
      if (normalized === null) {
        diagnostics.push(createDiagnostic({
          category: "config",
          code: "collector.glob-invalid",
          message: `${field} must contain workspace-relative globs: ${value}`,
          path: configPath,
          severity: "error"
        }));
        return [];
      }
      return [normalized];
    }))];

  const seenCustomIds = new Set<string>();
  const patterns = config.patterns.map((detector) => {
    if (detector.id.startsWith("builtin:")) {
      diagnostics.push(createDiagnostic({
        category: "config",
        code: "collector.detector-id-reserved",
        detectorId: detector.id,
        message: `regex detector ID uses the reserved builtin namespace: ${detector.id}`,
        path: configPath,
        severity: "error"
      }));
    } else if (seenCustomIds.has(detector.id)) {
      diagnostics.push(createDiagnostic({
        category: "config",
        code: "collector.detector-id-duplicate",
        detectorId: detector.id,
        message: `regex detector ID must be unique: ${detector.id}`,
        path: configPath,
        severity: "error"
      }));
    }
    seenCustomIds.add(detector.id);
    try {
      new RegExp(detector.pattern, ensureRegexMatchFlags(detector.flags));
    } catch (error) {
      diagnostics.push(createDiagnostic({
        category: "config",
        code: "collector.regex-invalid",
        detectorId: detector.id,
        message: `regex detector ${detector.id} has an invalid pattern: ${errorMessage(error)}`,
        path: configPath,
        severity: "error"
      }));
    }
    return {
      ...detector,
      excludeGlobs: normalizeGlobs(detector.excludeGlobs, `patterns.${detector.id}.excludeGlobs`),
      includeGlobs: normalizeGlobs(detector.includeGlobs, `patterns.${detector.id}.includeGlobs`)
    };
  });

  return {
    ...config,
    builtinDetectors: [...new Set(config.builtinDetectors)],
    excludeGlobs: normalizeGlobs(
      [...defaultRegexCollectorConfig.excludeGlobs, ...config.excludeGlobs],
      "excludeGlobs"
    ),
    includeGlobs: normalizeGlobs(config.includeGlobs, "includeGlobs"),
    patterns
  };
}

export function ensureRegexMatchFlags(flags: string): string {
  let resolved = flags;
  for (const requiredFlag of ["d", "g"]) {
    if (!resolved.includes(requiredFlag)) {
      resolved += requiredFlag;
    }
  }
  return resolved;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
