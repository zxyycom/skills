import path from "node:path";
import {
  defaultProjectFileSelection,
  duplicateDetection,
  fileMetrics,
  functionMetrics,
  jsonSchemaValidation,
  jsonValidation,
  markdownLinkValidation,
  secretDetection
} from "@zxyycom/vibe-check";
import type { Check } from "@zxyycom/vibe-check";
import { rootDir } from "../../project.ts";
import { repositoryProcessClaims, repositoryScanClaim } from "../contracts.ts";

export const historicalContentExclusions = [
  "docs/investigations/_resources/**"
] as const;

export const investigationAuthoringDocumentExclusions = [
  "docs/investigations/_candidate.*"
] as const;

const projectExclusions = [
  ...defaultProjectFileSelection.exclude,
  ...historicalContentExclusions
] as const;

export const maintainedCodeFiles = {
  source: "git-worktree",
  include: [
    "scripts/**/*.js",
    "scripts/**/*.ts",
    "tools/**/*.js",
    "tools/**/*.ts"
  ],
  exclude: projectExclusions
} as const;

export const productCodeFiles = {
  source: "git-worktree",
  include: ["tools/**/*.js", "tools/**/*.ts"],
  exclude: [
    ...projectExclusions,
    "tools/**/tests/**",
    "tools/**/*.test.js",
    "tools/**/*.test.ts"
  ]
} as const;

export const testCodeFiles = {
  source: "git-worktree",
  include: [
    "scripts/**/*.test.js",
    "scripts/**/*.test.ts",
    "tools/**/tests/**/*.js",
    "tools/**/tests/**/*.ts",
    "tools/**/*.test.js",
    "tools/**/*.test.ts"
  ],
  exclude: projectExclusions
} as const;

export const automationCodeFiles = {
  source: "git-worktree",
  include: ["scripts/**/*.js", "scripts/**/*.ts"],
  exclude: [
    ...projectExclusions,
    "scripts/**/*.test.js",
    "scripts/**/*.test.ts"
  ]
} as const;

export const maintainedDocumentFiles = {
  source: "git-worktree",
  exclude: [...projectExclusions, ...investigationAuthoringDocumentExclusions]
} as const;

export const maintainedSecretFiles = {
  source: "git-worktree",
  include: [
    "**/*.{code-workspace,example,html,js,json,jsonl,md,mjs,mts,rules,toml,ts,txt,yaml,yml}",
    "**/.gitattributes",
    "**/.gitignore",
    ".githooks/*"
  ],
  exclude: projectExclusions
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
  "file-metrics",
  "function-metrics"
] as const;

function withResourceClaims<
  AuthoredOptions extends object,
  PreparedOptions extends object
>(
  check: Check<AuthoredOptions, PreparedOptions>,
  resourceClaims: Readonly<Record<string, number>>
): Check<AuthoredOptions, PreparedOptions> {
  return { ...check, resourceClaims };
}

export function createVibeNativeChecks(
  workspaceRoot: string = rootDir
): readonly Check[] {
  return [
    withResourceClaims(
      duplicateDetection({
        cache: { enabled: false },
        codeAreas: {
          maintained: {
            files: maintainedCodeFiles,
            findingPolicy: "blocking",
            minimumTokens: 150
          }
        }
      }),
      repositoryScanClaim
    ),
    withResourceClaims(
      secretDetection({
        files: maintainedSecretFiles,
        findingWaivers: [],
        maximumFileCount: 4_096,
        maximumTotalBytes: 67_108_864
      }),
      repositoryScanClaim
    ),
    withResourceClaims(
      jsonValidation({
        files: maintainedDocumentFiles,
        maximumBytes: 2_097_152
      }),
      repositoryScanClaim
    ),
    withResourceClaims(
      jsonSchemaValidation({
        bindings,
        files: {
          source: "git-worktree",
          include: [
            ...schemas.map(({ path }) => path),
            ...bindings.map(({ instancePath }) => instancePath)
          ],
          exclude: projectExclusions
        },
        maximumBytes: 2_097_152,
        schemaIdentity: { mode: "configuration-authoritative" },
        schemas
      }),
      repositoryScanClaim
    ),
    withResourceClaims(
      markdownLinkValidation({
        cache: {
          directory: path.join(
            workspaceRoot,
            ".log/vibe-check/cache/markdown-parse-facts"
          ),
          enabled: true
        },
        files: maintainedDocumentFiles,
        findingPolicy: "blocking"
      }),
      repositoryScanClaim
    ),
    withResourceClaims(
      fileMetrics({
        codeAreas: {
          maintained: {
            files: maintainedCodeFiles,
            findingPolicy: "blocking"
          }
        },
        findingPolicy: "blocking",
        findingWaivers: []
      }),
      repositoryProcessClaims
    ),
    withResourceClaims(
      functionMetrics({
        codeAreas: {
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
        findingPolicy: "blocking",
        findingWaivers: []
      }),
      repositoryScanClaim
    )
  ];
}
