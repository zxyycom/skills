import { Ajv, type ValidateFunction } from "ajv";
import { createRequire } from "node:module";
import { isDeepStrictEqual } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { type FormatConfig } from "oxfmt";
import { rootDir } from "./project.ts";

const require = createRequire(import.meta.url);

export const oxfmtConfigFileName = ".oxfmtrc.json";
export const oxlintConfigFileName = ".oxlintrc.json";
export const formatSourceGlob = "'{scripts/**/*.{ts,js},tools/**/*.ts}'";

export const formatPackageScripts = {
  format: `oxfmt --write ${formatSourceGlob}`,
  "format:check": `oxfmt --check ${formatSourceGlob}`
} as const satisfies Readonly<Record<string, string>>;

export const lintPackageScripts = {
  lint: "bun scripts/lint.ts",
  "lint:fix": "bun scripts/lint.ts --fix"
} as const satisfies Readonly<Record<string, string>>;

type OxcTool = "oxfmt" | "oxlint";

const repositoryOxlintPolicy = {
  categories: { correctness: "error" },
  env: { builtin: true },
  options: {
    reportUnusedDisableDirectives: "error",
    typeAware: true
  },
  plugins: ["typescript", "unicorn", "oxc"],
  rules: {
    "typescript/no-floating-promises": [
      "error",
      {
        allowForKnownSafeCalls: [
          {
            from: "package",
            name: "test",
            package: "node:test"
          }
        ]
      }
    ]
  }
} as const;

const allowedOxlintConfigurationKeys = new Set([
  "$schema",
  ...Object.keys(repositoryOxlintPolicy)
]);

const oxlintPolicyExpectations = {
  categories: 'categories must equal { "correctness": "error" }',
  env: 'env must equal { "builtin": true }',
  options:
    'options must set "reportUnusedDisableDirectives" to "error" and "typeAware" to true',
  plugins: 'plugins must equal ["typescript", "unicorn", "oxc"]',
  rules:
    'rules must preserve the approved "typescript/no-floating-promises" configuration'
} as const satisfies Record<keyof typeof repositoryOxlintPolicy, string>;

const compiledSchemaValidators = new Map<OxcTool, ValidateFunction>();

function createSchemaValidator(): Ajv {
  const validator = new Ajv({ allErrors: true, strict: false });
  const unsignedInteger = (maximum: number) => (value: number) =>
    Number.isSafeInteger(value) && value >= 0 && value <= maximum;
  validator.addFormat("double", {
    type: "number",
    validate: Number.isFinite
  });
  validator.addFormat("uint", {
    type: "number",
    validate: unsignedInteger(Number.MAX_SAFE_INTEGER)
  });
  validator.addFormat("uint8", {
    type: "number",
    validate: unsignedInteger(255)
  });
  validator.addFormat("uint16", {
    type: "number",
    validate: unsignedInteger(65_535)
  });
  validator.addFormat("uint32", {
    type: "number",
    validate: unsignedInteger(4_294_967_295)
  });
  validator.addFormat("uint64", {
    type: "number",
    validate: unsignedInteger(Number.MAX_SAFE_INTEGER)
  });
  return validator;
}

function matchesValidatedSchema<T>(
  validator: (value: unknown) => boolean,
  value: unknown
): value is T {
  return validator(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonDocument(filePath: string): Promise<unknown> {
  let source: string;
  try {
    source = await fs.readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `Could not read ${filePath}: ${error instanceof Error ? error.message : String(error)}. ` +
        "Restore the configuration file and run bun run validate again."
    );
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(
      `Could not parse ${filePath}: ${error instanceof Error ? error.message : String(error)}. ` +
        "Fix the JSON and run bun run validate again."
    );
  }
}

async function readToolSchema(tool: OxcTool): Promise<Record<string, unknown>> {
  const packageJsonPath = require.resolve(`${tool}/package.json`);
  const schemaPath = path.join(
    path.dirname(packageJsonPath),
    "configuration_schema.json"
  );
  const schema = await readJsonDocument(schemaPath);
  if (!isRecord(schema)) {
    throw new Error(
      `Could not validate ${tool} configuration because ${schemaPath} is not a JSON object. ` +
        "Reinstall dependencies with pnpm install --frozen-lockfile."
    );
  }
  return schema;
}

async function loadSchemaValidator(tool: OxcTool): Promise<ValidateFunction> {
  const cachedValidator = compiledSchemaValidators.get(tool);
  if (cachedValidator !== undefined) {
    return cachedValidator;
  }

  const schema = await readToolSchema(tool);
  const validator = createSchemaValidator().compile(schema);
  compiledSchemaValidators.set(tool, validator);
  return validator;
}

async function loadOxcConfiguration<T>(
  tool: OxcTool,
  fileName: string,
  workspaceRoot: string
): Promise<T> {
  const configurationPath = path.join(workspaceRoot, fileName);
  const [configuration, validator] = await Promise.all([
    readJsonDocument(configurationPath),
    loadSchemaValidator(tool)
  ]);
  if (!matchesValidatedSchema<T>(validator, configuration)) {
    const diagnostic = validator.errors?.[0];
    const field = diagnostic?.instancePath || "<root>";
    const reason = diagnostic?.message ?? "does not match the Oxc schema";
    throw new Error(
      `${configurationPath} ${field} ${reason}. ` +
        `Update ${fileName} for the installed ${tool} version and run bun run validate again.`
    );
  }
  return configuration;
}

function validateOxlintProjectPolicy(
  configuration: unknown,
  configurationPath: string
): void {
  if (!isRecord(configuration)) {
    throw new Error(
      `${configurationPath} must be an object to satisfy the repository Oxlint policy.`
    );
  }

  const policyFailures: string[] = [];
  for (const key of Object.keys(configuration)) {
    if (!allowedOxlintConfigurationKeys.has(key)) {
      policyFailures.push(
        `${key} is not an allowed repository Oxlint setting; update the policy owner before changing lint behavior`
      );
    }
  }
  for (const [key, expectedValue] of Object.entries(repositoryOxlintPolicy)) {
    if (!isDeepStrictEqual(configuration[key], expectedValue)) {
      policyFailures.push(
        `${oxlintPolicyExpectations[key as keyof typeof repositoryOxlintPolicy]}; update the policy owner before changing lint behavior`
      );
    }
  }
  if (policyFailures.length === 0) {
    return;
  }
  throw new Error(
    `${configurationPath} violates the repository Oxlint policy:\n` +
      policyFailures.map((failure) => `- ${failure}`).join("\n") +
      "\nFix the affected code; only for a direct contract conflict, use the narrowest justified oxlint-disable-next-line at that line."
  );
}

export async function loadOxfmtFormatConfig(
  workspaceRoot: string = rootDir
): Promise<FormatConfig> {
  return await loadOxcConfiguration<FormatConfig>(
    "oxfmt",
    oxfmtConfigFileName,
    workspaceRoot
  );
}

export async function validateOxlintConfiguration(
  workspaceRoot: string = rootDir
): Promise<void> {
  const configuration = await loadOxcConfiguration(
    "oxlint",
    oxlintConfigFileName,
    workspaceRoot
  );
  validateOxlintProjectPolicy(
    configuration,
    path.join(workspaceRoot, oxlintConfigFileName)
  );
}

export async function validateOxcConfigurationFiles(
  report: (message: string) => void,
  workspaceRoot: string = rootDir
): Promise<void> {
  for (const [tool, fileName] of [
    ["oxfmt", oxfmtConfigFileName],
    ["oxlint", oxlintConfigFileName]
  ] as const) {
    try {
      if (tool === "oxlint") {
        await validateOxlintConfiguration(workspaceRoot);
      } else {
        await loadOxcConfiguration(tool, fileName, workspaceRoot);
      }
    } catch (error) {
      report(error instanceof Error ? error.message : String(error));
    }
  }
}
