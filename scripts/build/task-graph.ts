import path from "node:path";
import { toJsonSchema } from "@valibot/to-json-schema";
import {
  buildGeneratedDeclaration,
  buildGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedArtifacts,
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
const declarationSourcePath = "tools/task-graph/api/task-graph.d.mts";
const schemaSourcePath = "tools/task-graph/src/schema.ts";
const publishedScriptsDirectory = path.join(rootDir, skillSourcePath, "scripts");
const cliOutputPath = path.join(publishedScriptsDirectory, "task-graph.mjs");
const schemaOutputPath = path.join(
  rootDir,
  skillSourcePath,
  "references",
  "task-graph-index.schema.json"
);

async function buildArtifacts(): Promise<GeneratedArtifact[]> {
  const bundle = await bundleWithBun({
    banner: buildGeneratedFileHeader({
      artifactName: "task graph JSON CLI",
      rebuildCommand,
      repository: githubRepository,
      skillSourcePath,
      sourcePath: cliSourcePath
    }),
    cwd: rootDir,
    entryPath: path.join(rootDir, cliSourcePath),
    format: "esm",
    keepNames: true,
    minify: true,
    outputFileName: path.basename(cliOutputPath),
    sourceMapBaseDirectory: publishedScriptsDirectory,
    sourceMap: true
  });
  if (bundle.sourceMap === null) {
    throw new Error("Task graph CLI bundle must include a source map");
  }

  const declaration = await buildGeneratedDeclaration({
    banner: buildGeneratedFileHeader({
      artifactName: "task graph JSON CLI TypeScript declarations",
      rebuildCommand,
      repository: githubRepository,
      skillSourcePath,
      sourcePath: declarationSourcePath
    }),
    sourcePath: path.join(rootDir, declarationSourcePath)
  });
  const convertedSchema = toJsonSchema(taskIndexSchema, {
    errorMode: "ignore",
    overrideAction: taskGraphJsonSchemaOverrideAction,
    target: "draft-2020-12",
    typeMode: "input"
  });
  const jsonSchema = {
    ...convertedSchema,
    $id: `https://raw.githubusercontent.com/${githubRepository}/main/`
      + `${skillSourcePath}/references/task-graph-index.schema.json`,
    $comment:
      "Safe-integer ID suffixes, real RFC 3339 instants, cross-field, topology, "
      + "revision, lease, and canonical-form invariants are validated by the "
      + "task-graph CLI check command.",
    title: "TaskGraphIndex"
  };

  return [
    {
      content: bundle.code,
      path: cliOutputPath,
      sourcePath: cliSourcePath
    },
    {
      content: bundle.sourceMap,
      path: `${cliOutputPath}.map`,
      sourcePath: cliSourcePath
    },
    {
      content: declaration,
      path: path.join(publishedScriptsDirectory, "task-graph.d.mts"),
      sourcePath: declarationSourcePath
    },
    {
      content: `${JSON.stringify(jsonSchema, null, 2)}\n`,
      path: schemaOutputPath,
      sourcePath: schemaSourcePath
    }
  ];
}

async function main(): Promise<void> {
  const mode = parseGeneratedFileMode(process.argv.slice(2));
  const changed = await syncGeneratedArtifacts(
    await buildArtifacts(),
    mode,
    rootDir,
    cliSourcePath
  );
  if (mode === "check" && changed) {
    process.exit(1);
  }
  if (!changed) {
    console.log("Task graph generated artifacts are current.");
  }
}

await main();
