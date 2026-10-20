import { nativeCliEntry } from "../lib/native-cli-entry.ts";
import {
  buildSkillRuntimeArtifacts,
  syncSkillRuntimeArtifacts,
  runRuntimeAdapter
} from "../lib/skill-runtime.ts";
import type { GeneratedFileMode } from "../lib/generated-file.ts";
import path from "node:path";
import { toJsonSchema } from "@valibot/to-json-schema";
import {
  buildGeneratedTypeScriptDeclarationArtifacts,
  removeStaleGeneratedTypeScriptDeclarations,
  type GeneratedArtifact
} from "../lib/generated-file.ts";
import { githubRepository, rootDir } from "../lib/project.ts";
import {
  taskGraphJsonSchemaOverrideAction,
  taskIndexSchema
} from "../../tools/task-graph/src/schema.ts";

const rebuildCommand = "bun run sync:task-graph-cli";
const skillSourcePath = "skills/task-graph";
const cliSourcePath = "tools/task-graph/src/cli.ts";
const schemaSourcePath = "tools/task-graph/src/schema.ts";
const publishedScriptsDirectory = path.join(
  rootDir,
  skillSourcePath,
  "scripts"
);
const declarationOutputDirectory = path.join(
  publishedScriptsDirectory,
  "task-graph-sdk"
);
const schemaOutputPath = path.join(
  rootDir,
  skillSourcePath,
  "references",
  "task-graph-index.schema.json"
);

const publicRuntimeExports = [
  "TaskGraphError",
  "TaskGraphService",
  "applyTaskGraphOperations",
  "cancelTask",
  "claimTask",
  "completeTask",
  "defaultTaskGraphIndexPath",
  "emptyTaskIndex",
  "failTask",
  "parseTaskGraphApplyRequest",
  "parseTaskIndex",
  "projectTaskGraph",
  "releaseTask",
  "removeTasks",
  "renewTaskLease",
  "retryTask",
  "runTaskGraphCli",
  "serializeTaskIndex",
  "taskControlModes",
  "taskEffectiveStates",
  "taskExecutionPhases",
  "taskGraphRuntimeProtocolVersion",
  "taskGraphSchemaVersion",
  "taskGraphSupportedNodeRange",
  "taskGraphVersion",
  "validateTaskIndexGraph"
];

async function buildArtifacts(): Promise<GeneratedArtifact[]> {
  const declarationArtifacts =
    await buildGeneratedTypeScriptDeclarationArtifacts({
      declarationArtifactName: "task graph SDK TypeScript declaration",
      declarationEntryOutputPath: path.join(
        publishedScriptsDirectory,
        "task-graph.d.mts"
      ),
      declarationOutputDirectory,
      entrySourcePath: cliSourcePath,
      rebuildCommand,
      repository: githubRepository,
      skillSourcePath,
      workspaceRoot: rootDir
    });
  const convertedSchema = toJsonSchema(taskIndexSchema, {
    errorMode: "ignore",
    overrideAction: taskGraphJsonSchemaOverrideAction,
    target: "draft-2020-12",
    typeMode: "input"
  });
  const jsonSchema = {
    ...convertedSchema,
    $id:
      `https://raw.githubusercontent.com/${githubRepository}/main/` +
      `${skillSourcePath}/references/task-graph-index.schema.json`,
    $comment:
      "Safe-integer ID suffixes, real RFC 3339 instants, cross-field, topology, " +
      "revision, lease, and canonical-form invariants are validated by the " +
      "task-graph CLI info command.",
    title: "TaskGraphIndex"
  };
  return [
    ...(await buildSkillRuntimeArtifacts({
      skillName: "task-graph",
      rebuildCommand,
      nodeEngine: "^22.22.2 || ^24.15.0 || >=26.0.0",
      entries: [
        await nativeCliEntry({
          sourcePath: cliSourcePath,
          outputName: "task-graph.ts",
          runner: "runTaskGraphCli",
          declarationName: "task-graph.d.mts",
          typedExports: publicRuntimeExports
        })
      ]
    })),
    ...declarationArtifacts,
    {
      content: `${JSON.stringify(jsonSchema, null, 2)}\n`,
      path: schemaOutputPath,
      sourcePath: schemaSourcePath
    }
  ];
}

export async function syncRuntime(mode: GeneratedFileMode): Promise<boolean> {
  const artifacts = await buildArtifacts();
  const changedArtifacts = await syncSkillRuntimeArtifacts(artifacts, {
    mode,
    skillName: "task-graph",
    retiredPaths: ["scripts/task-graph.mjs", "scripts/task-graph.mjs.map"]
  });
  const expectedDeclarationPaths = new Set(
    artifacts
      .map((artifact) => artifact.path)
      .filter(
        (artifactPath) =>
          path.dirname(artifactPath) === declarationOutputDirectory
      )
  );
  const staleDeclarations = await removeStaleGeneratedTypeScriptDeclarations({
    declarationArtifactName: "task graph SDK TypeScript declaration",
    declarationOutputDirectory,
    expectedPaths: expectedDeclarationPaths,
    mode,
    sourcePath: cliSourcePath,
    workspaceRoot: rootDir
  });
  if (staleDeclarations.hasUnsupportedEntries)
    throw new Error("Unsupported declaration files");
  return changedArtifacts || staleDeclarations.changed;
}
await runRuntimeAdapter(import.meta.url, syncRuntime);
