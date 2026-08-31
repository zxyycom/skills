import process from "node:process";
import {
  defaultProjectFileSelection,
  defineConfig,
  duplicateDetection,
  fileMetrics,
  functionMetrics,
  jsonSchemaValidation,
  jsonValidation,
  markdownLinkValidation,
  run
} from "@zxyycom/vibe-check";
import type { ProjectDefinition, RunResult } from "@zxyycom/vibe-check";
import { isMainModule } from "../tools/shared/src/node/main-module.ts";
import { rootDir } from "./lib/project.ts";

const historicalContentExclusions = [
  "changes/archive/**",
  "docs/investigations/_resources/**"
];
const projectExclusions = [
  ...defaultProjectFileSelection.exclude,
  ...historicalContentExclusions
];
const maintainedCodeFiles = {
  source: "git-worktree",
  include: [
    "scripts/**/*.js",
    "scripts/**/*.ts",
    "tools/**/*.js",
    "tools/**/*.ts"
  ],
  exclude: projectExclusions
} as const;
const maintainedDocumentFiles = {
  source: "git-worktree",
  exclude: projectExclusions
} as const;

type GateExitCode = 0 | 1;

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

function createDefinition(): ProjectDefinition {
  return defineConfig({
    checks: [
      duplicateDetection({
        cache: { enabled: false },
        codeAreas: {
          maintained: {
            files: maintainedCodeFiles,
            findingPolicy: "blocking"
          }
        }
      }),
      fileMetrics({
        codeAreas: { maintained: { files: maintainedCodeFiles } }
      }),
      functionMetrics({
        codeAreas: { maintained: { files: maintainedCodeFiles } }
      }),
      jsonValidation({
        files: maintainedDocumentFiles,
        maximumBytes: 2_097_152
      }),
      jsonSchemaValidation({
        bindings,
        files: {
          source: "git-worktree",
          include: [
            ...schemas.map(({ path }) => path),
            ...bindings.map(({ instancePath }) => instancePath)
          ],
          exclude: []
        },
        maximumBytes: 2_097_152,
        schemaIdentity: { mode: "configuration-authoritative" },
        schemas
      }),
      markdownLinkValidation({
        files: maintainedDocumentFiles,
        findingPolicy: "blocking"
      })
    ],
    outputs: {
      diagnosticLogging: { enabled: false },
      machinePublication: { enabled: false }
    }
  });
}

function describeInvocationFailure(
  result: Exclude<RunResult, { readonly kind: "completed" }>
): string {
  switch (result.kind) {
    case "cancelled":
      return `cancelled during ${result.phase}`;
    case "configuration":
      return `${result.diagnostic.kind} at ${result.diagnostic.path}: ${result.diagnostic.reason}`;
    case "execution":
    case "output":
    case "planning":
      return `${result.kind}: ${result.diagnostic.code}`;
  }
}

export async function runVibeCheck(): Promise<GateExitCode> {
  const result = await run(createDefinition(), {
    checkAggregation: {
      checks: "all",
      empty: "failed",
      mode: "all",
      notApplicable: "exclude",
      unavailable: "fail"
    },
    projectRoot: rootDir
  });

  if (result.kind !== "completed") {
    console.error(
      `Vibe Check invocation failed: ${describeInvocationFailure(result)}`
    );
    return 1;
  }
  if (result.aggregate !== "passed") {
    console.error(
      `Vibe Check gate failed: ${result.aggregate ?? "no aggregate"}`
    );
    return 1;
  }
  return 0;
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runVibeCheck();
  } catch (error) {
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    );
    process.exitCode = 1;
  }
}
