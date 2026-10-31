import path from "node:path";
import {
  duplicateDetection,
  fileMetrics,
  functionMetrics,
  jsonSchemaValidation,
  jsonValidation,
  markdownLinkValidation,
  markdownLint,
  secretDetection
} from "@zxyycom/vibe-check";
import type { Check } from "@zxyycom/vibe-check";
import { rootDir } from "../../project.ts";
import {
  gateCheckDeclaration,
  projectActivationCondition,
  type GateCheckConfiguration,
  repositoryProcessClaims,
  repositoryScanClaim
} from "../contracts.ts";

import {
  historicalContentExclusions,
  investigationAuthoringDocumentExclusions,
  markdownSourcePatterns,
  maintainedMarkdownFiles
} from "../impact-paths.ts";
import {
  gateCodeToolIds,
  markdownLintToolSubscription
} from "../impact-tools.ts";
import { selectGateCodeAreas } from "../code-selection.ts";
export {
  historicalContentExclusions,
  investigationAuthoringDocumentExclusions,
  maintainedMarkdownFiles
} from "../impact-paths.ts";

const projectExclusions = [...historicalContentExclusions] as const;

export const maintainedCodeFiles = {
  patterns: [
    "scripts/**/*.{js,ts}",
    "tools/**/*.{js,ts}",
    ...projectExclusions.map((pattern) => `!${pattern}`)
  ]
} as const;
export const productCodeFiles = {
  patterns: [
    "tools/**/*.{js,ts}",
    "!tools/**/tests/**",
    "!tools/**/*.test.{js,ts}",
    ...projectExclusions.map((pattern) => `!${pattern}`)
  ]
} as const;
export const testCodeFiles = {
  patterns: [
    "scripts/**/*.test.{js,ts}",
    "tools/**/tests/**/*.{js,ts}",
    "tools/**/*.test.{js,ts}",
    ...projectExclusions.map((pattern) => `!${pattern}`)
  ]
} as const;
export const automationCodeFiles = {
  patterns: [
    "scripts/**/*.{js,ts}",
    "!scripts/**/*.test.{js,ts}",
    ...projectExclusions.map((pattern) => `!${pattern}`)
  ]
} as const;
const maintainedDocumentExclusions = [
  ...projectExclusions,
  ...investigationAuthoringDocumentExclusions
].map((pattern) => `!${pattern}`);
export const maintainedDocumentFiles = {
  patterns: [
    "**/*.json",
    ...markdownSourcePatterns,
    ...maintainedDocumentExclusions
  ]
} as const;
export const maintainedSecretFiles = {
  patterns: [
    "**/*.{code-workspace,example,html,js,json,jsonl,md,mjs,mts,rules,toml,ts,txt,yaml,yml}",
    "**/.gitattributes",
    "**/.gitignore",
    ".githooks/*",
    ...projectExclusions.map((pattern) => `!${pattern}`)
  ]
} as const;

const schemas = [
  {
    id: "urn:skills:task-graph-index",
    path: "skills/task-graph/references/task-graph-index.schema.json"
  },
  {
    id: "urn:skills:test-evidence-index",
    path: "skills/test-evidence-review/references/schemas/test-evidence-state-index.schema.json"
  }
] as const;

const bindings = [
  {
    id: "task-graph-index",
    instancePath: "docs/task-graph/task-graph-index.json",
    schemaId: "urn:skills:task-graph-index"
  },
  {
    id: "test-evidence-index",
    instancePath: "docs/test-evidence/test-evidence-index.json",
    schemaId: "urn:skills:test-evidence-index"
  }
] as const;

export const vibeNativeCheckIds = [
  "duplicate-detection",
  "secret-detection",
  "json-validation",
  "json-schema-validation",
  "markdown-link-validation",
  "markdown-lint",
  "file-metrics",
  "function-metrics"
] as const;

export function createVibeNativeChecks(
  workspaceRoot: string = rootDir,
  configuration: GateCheckConfiguration = {}
): readonly Check[] {
  const codeActivation =
    configuration.scope === "selected"
      ? projectActivationCondition(["repository-code"], configuration)
      : undefined;
  const metricActivation =
    configuration.scope === "selected"
      ? projectActivationCondition(gateCodeToolIds, configuration)
      : undefined;
  return [
    duplicateDetection({
      ...gateCheckDeclaration(
        "duplicate-detection",
        configuration,
        repositoryScanClaim,
        [],
        codeActivation
      ),
      cache: {
        enabled: true,
        directory: path.join(
          workspaceRoot,
          ".log/vibe-check/cache/duplicate-fragments"
        )
      },
      codeAreas: {
        maintained: {
          files: maintainedCodeFiles,
          findingPolicy: "blocking",
          minimumTokens: 150
        }
      }
    }),
    secretDetection({
      ...gateCheckDeclaration(
        "secret-detection",
        configuration,
        repositoryScanClaim
      ),
      files: maintainedSecretFiles,
      findingWaivers: [],
      maximumFileCount: 5_120,
      maximumTotalBytes: 67_108_864
    }),
    jsonValidation({
      ...gateCheckDeclaration(
        "json-validation",
        configuration,
        repositoryScanClaim
      ),
      files: { patterns: ["**/*.json", ...maintainedDocumentExclusions] },
      maximumBytes: 2_097_152
    }),
    jsonSchemaValidation({
      ...gateCheckDeclaration(
        "json-schema-validation",
        configuration,
        repositoryScanClaim
      ),
      bindings,
      files: {
        patterns: [
          ...schemas.map(({ path }) => path),
          ...bindings.map(({ instancePath }) => instancePath),
          ...projectExclusions.map((pattern) => `!${pattern}`)
        ]
      },
      maximumBytes: 2_097_152,
      schemaIdentity: { mode: "configuration-authoritative" },
      schemas
    }),
    markdownLinkValidation({
      ...gateCheckDeclaration(
        "markdown-link-validation",
        configuration,
        repositoryScanClaim
      ),
      cache: {
        directory: path.join(
          workspaceRoot,
          ".log/vibe-check/cache/markdown-parse-facts"
        ),
        enabled: true
      },
      files: {
        patterns: [...markdownSourcePatterns, ...maintainedDocumentExclusions]
      },
      limits: {
        maxMarkdownBytes: 1_048_576,
        maxOccurrences: 10_000,
        maxTargetReads: 4_096
      },
      findingPolicy: "blocking"
    }),
    markdownLint({
      ...gateCheckDeclaration(
        "markdown-lint",
        configuration,
        repositoryScanClaim,
        [],
        projectActivationCondition(markdownLintToolSubscription, configuration)
      ),
      files: maintainedMarkdownFiles,
      findingPolicy: "blocking",
      rules: [
        "no-reversed-links",
        "no-missing-space-atx",
        "no-empty-links",
        "no-alt-text",
        "reference-links-images",
        "table-column-count"
      ],
      cache: {
        enabled: true,
        directory: path.join(
          workspaceRoot,
          ".log/vibe-check/cache/markdown-lint-facts"
        )
      }
    }),
    fileMetrics({
      ...gateCheckDeclaration(
        "file-metrics",
        configuration,
        repositoryProcessClaims,
        [],
        metricActivation
      ),
      codeAreas: selectGateCodeAreas(
        {
          maintained: {
            files: maintainedCodeFiles,
            findingPolicy: "blocking"
          }
        },
        configuration
      ),
      findingPolicy: "blocking",
      findingWaivers: []
    }),
    functionMetrics({
      ...gateCheckDeclaration(
        "function-metrics",
        configuration,
        repositoryScanClaim,
        [],
        metricActivation
      ),
      codeAreas: selectGateCodeAreas(
        {
          product: {
            files: productCodeFiles,
            findingPolicy: "blocking",
            limits: {
              codeLines: {
                lowComplexityAllowance: {
                  cyclomaticComplexityBelow: 5,
                  maximum: 120
                },
                maximum: 45
              },
              cyclomaticComplexity: { maximum: 10 },
              nestingDepth: { maximum: 5 },
              parameters: { maximum: 5 }
            }
          },
          automation: {
            files: automationCodeFiles,
            findingPolicy: "blocking",
            limits: {
              codeLines: {
                lowComplexityAllowance: {
                  cyclomaticComplexityBelow: 7,
                  maximum: 220
                },
                maximum: 80
              },
              cyclomaticComplexity: { maximum: 16 },
              nestingDepth: { maximum: 8 },
              parameters: { maximum: 7 }
            }
          },
          tests: {
            files: testCodeFiles,
            findingPolicy: "blocking",
            limits: {
              codeLines: {
                lowComplexityAllowance: {
                  cyclomaticComplexityBelow: 8,
                  maximum: 250
                },
                maximum: 100
              },
              cyclomaticComplexity: { maximum: 20 },
              nestingDepth: { maximum: 10 },
              parameters: { maximum: 8 }
            }
          }
        },
        configuration
      ),
      findingPolicy: "blocking",
      findingWaivers: []
    })
  ];
}
