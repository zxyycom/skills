import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import {
  reviewTriggerPolicies,
  supportedLanguages,
  type TestEvidenceConfig,
  unregisteredPolicies
} from "./types.ts";
import { normalizeWorkspaceRelative } from "./workspace-path.ts";

const defaultConfigPath = ".test-evidence.json";
const defaultCaseIdPattern = "^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-\\d{3}$";
const defaultIgnoreGlobs = [
  "**/.*/**",
  "**/.git/**",
  "**/.venv/**",
  "**/build/**",
  "**/dist/**",
  "**/node_modules/**",
  "**/target/**",
  "**/vendor/**"
];

const nonEmptyStringSchema = v.pipe(
  v.string("must be a string"),
  v.check((value) => value.trim().length > 0, "must be a non-empty string")
);
const configSchema = v.strictObject({
  caseIdPattern: v.optional(nonEmptyStringSchema),
  catalogPath: v.optional(nonEmptyStringSchema),
  ignoreGlobs: v.optional(v.array(nonEmptyStringSchema)),
  includeGlobs: v.optional(v.array(nonEmptyStringSchema)),
  languages: v.optional(v.array(v.picklist(supportedLanguages))),
  reviewMaxAgeDays: v.optional(v.pipe(
    v.number("must be a number"),
    v.integer("must be an integer"),
    v.minValue(1, "must be at least 1")
  )),
  reviewTriggers: v.optional(v.picklist(reviewTriggerPolicies)),
  schemaVersion: v.literal(2, "must be 2"),
  unregisteredTestEntries: v.optional(v.picklist(unregisteredPolicies))
});

type ParsedConfig = v.InferOutput<typeof configSchema>;

export type LoadedTestEvidenceConfig = {
  config: TestEvidenceConfig | null;
  configRelativePath: string;
  errors: string[];
};

export async function loadTestEvidenceConfig(
  workspaceRoot: string,
  requestedConfigPath?: string
): Promise<LoadedTestEvidenceConfig> {
  const errors: string[] = [];
  const configRelativePath = normalizeRelativePath(
    requestedConfigPath ?? defaultConfigPath,
    "config path",
    errors
  );
  if (configRelativePath === null) {
    return { config: null, configRelativePath: requestedConfigPath ?? defaultConfigPath, errors };
  }

  const configPath = path.join(workspaceRoot, configRelativePath);
  let parsed: ParsedConfig = { schemaVersion: 2 };
  try {
    parsed = parseConfigText(await fs.readFile(configPath, "utf8"), configRelativePath, errors);
  } catch (error) {
    if (!isMissingFileError(error) || requestedConfigPath !== undefined) {
      errors.push(
        `${configRelativePath} could not be read: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const catalogPath = normalizeRelativePath(
    parsed.catalogPath ?? "docs/testing/cases.md",
    "catalogPath",
    errors
  );
  const includeGlobs = normalizeGlobs(parsed.includeGlobs ?? [], "includeGlobs", errors);
  const ignoreGlobs = normalizeGlobs(
    [...defaultIgnoreGlobs, ...(parsed.ignoreGlobs ?? [])],
    "ignoreGlobs",
    errors
  );
  const caseIdPattern = parsed.caseIdPattern ?? defaultCaseIdPattern;
  try {
    new RegExp(caseIdPattern, "u");
  } catch (error) {
    errors.push(
      `caseIdPattern must be a valid regular expression: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (catalogPath === null || errors.length > 0) {
    return { config: null, configRelativePath, errors };
  }

  return {
    config: {
      caseIdPattern,
      catalogPath,
      ignoreGlobs,
      includeGlobs,
      languages: [...new Set(parsed.languages ?? supportedLanguages)],
      reviewMaxAgeDays: parsed.reviewMaxAgeDays,
      reviewTriggers: parsed.reviewTriggers ?? "warn",
      schemaVersion: 2,
      unregisteredTestEntries: parsed.unregisteredTestEntries ?? "warn"
    },
    configRelativePath,
    errors
  };
}

function parseConfigText(text: string, relativePath: string, errors: string[]): ParsedConfig {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    errors.push(
      `${relativePath} must contain valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return { schemaVersion: 2 };
  }

  const result = v.safeParse(configSchema, value);
  if (!result.success) {
    errors.push(...result.issues.map((issue) => {
      const issuePath = v.getDotPath(issue);
      const prefix = issuePath === null ? relativePath : `${relativePath} ${issuePath}`;
      return `${prefix} ${issue.message}`;
    }));
    return { schemaVersion: 2 };
  }
  return result.output;
}

function normalizeGlobs(values: readonly string[], field: string, errors: string[]): string[] {
  return [...new Set(values.flatMap((value) => {
    const normalized = normalizeWorkspaceRelative(value);
    if (normalized === null) {
      errors.push(`${field} must contain only workspace-relative glob patterns: ${value}`);
      return [];
    }
    return [normalized];
  }))];
}

function normalizeRelativePath(
  value: string,
  field: string,
  errors: string[]
): string | null {
  const normalized = normalizeWorkspaceRelative(value);
  if (normalized === null) {
    errors.push(`${field} must be a workspace-relative path: ${value}`);
    return null;
  }
  return normalized;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
