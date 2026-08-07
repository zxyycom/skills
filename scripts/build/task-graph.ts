import fs from "node:fs/promises";
import path from "node:path";
import { toJsonSchema } from "@valibot/to-json-schema";
import {
  buildGeneratedDeclaration,
  buildGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedArtifacts,
  type BunBuildPlugin,
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
const runtimeAssetSourceDirectory = "tools/task-graph/references/runtime";
const runtimeAssetOutputDirectory = path.join(
  rootDir,
  skillSourcePath,
  "references",
  "runtime"
);
const publishedScriptsDirectory = path.join(rootDir, skillSourcePath, "scripts");
const cliOutputPath = path.join(publishedScriptsDirectory, "task-graph.mjs");
const schemaOutputPath = path.join(
  rootDir,
  skillSourcePath,
  "references",
  "task-graph-index.schema.json"
);

const portableWriteFileAtomicFilename = "node_modules/write-file-atomic/lib/index.js";

function createPortableWriteFileAtomicPlugin(): {
  assertApplied(): void;
  plugin: BunBuildPlugin;
} {
  let loadCount = 0;
  return {
    assertApplied() {
      if (loadCount !== 1) {
        throw new Error(`Expected one write-file-atomic transform, received ${loadCount}`);
      }
    },
    plugin: {
      name: "portable-write-file-atomic-filename",
      setup(builder) {
        builder.onLoad(
          { filter: /write-file-atomic[\\/]lib[\\/]index\.js$/u },
          async ({ path: sourcePath }) => {
            loadCount += 1;
            if (loadCount !== 1) {
              throw new Error("write-file-atomic transform matched more than one module");
            }
            const realSourcePath = await fs.realpath(sourcePath);
            if (!/[\\/]write-file-atomic[\\/]lib[\\/]index\.js$/u.test(realSourcePath)) {
              throw new Error("write-file-atomic transform received an unexpected real path");
            }
            const manifest = JSON.parse(await fs.readFile(
              path.join(path.dirname(realSourcePath), "..", "package.json"),
              "utf8"
            )) as { name?: unknown; version?: unknown };
            if (manifest.name !== "write-file-atomic" || manifest.version !== "8.0.0") {
              throw new Error("write-file-atomic transform received an unexpected package");
            }
            const source = await fs.readFile(realSourcePath, "utf8");
            const filenameMatches = source.match(/\b__filename\b/gu) ?? [];
            if (filenameMatches.length !== 1) {
              throw new Error(
                `Expected one write-file-atomic __filename token, received ${filenameMatches.length}`
              );
            }
            return {
              contents: source.replace(
                /\b__filename\b/u,
                JSON.stringify(portableWriteFileAtomicFilename)
              ),
              loader: "js"
            };
          }
        );
      }
    }
  };
}

function removeBundleDebugId(
  code: string,
  sourceMapText: string
): { code: string; sourceMap: string } {
  const debugIdMatch = /\/\/# debugId=([A-F0-9]{32})\r?\n\/\/# sourceMappingURL=task-graph\.mjs\.map\r?\n?$/u.exec(code);
  if (debugIdMatch === null) {
    throw new Error("Task graph CLI bundle must end with paired debugId and source map lines");
  }
  const sourceMap = JSON.parse(sourceMapText) as Record<string, unknown>;
  if (sourceMap.debugId !== debugIdMatch[1]) {
    throw new Error("Task graph CLI and source map Bun debugIds must match");
  }
  delete sourceMap.debugId;
  return {
    code: code.replace(/\/\/# debugId=[A-F0-9]{32}\r?\n(?=\/\/# sourceMappingURL=task-graph\.mjs\.map\r?\n?$)/u, ""),
    sourceMap: `${JSON.stringify(sourceMap)}\n`
  };
}

async function buildArtifacts(): Promise<GeneratedArtifact[]> {
  const portableDependency = createPortableWriteFileAtomicPlugin();
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
    plugins: [portableDependency.plugin],
    sourceMapBaseDirectory: publishedScriptsDirectory,
    sourceMap: true
  });
  portableDependency.assertApplied();
  if (bundle.sourceMap === null) {
    throw new Error("Task graph CLI bundle must include a source map");
  }
  const portableBundle = removeBundleDebugId(bundle.code, bundle.sourceMap);
  const serializedWorkspacePath = JSON.stringify(rootDir).slice(1, -1);
  if (
    portableBundle.code.includes(rootDir)
    || portableBundle.code.includes(serializedWorkspacePath)
  ) {
    throw new Error("Task graph CLI bundle contains an absolute workspace path");
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
  const runtimeAssets = await Promise.all(
    ["package.json", "package-lock.json"].map(async (name): Promise<GeneratedArtifact> => {
      const sourcePath = `${runtimeAssetSourceDirectory}/${name}`;
      return {
        content: await fs.readFile(path.join(rootDir, sourcePath), "utf8"),
        path: path.join(runtimeAssetOutputDirectory, name),
        sourcePath
      };
    })
  );

  return [
    {
      content: portableBundle.code,
      path: cliOutputPath,
      sourcePath: cliSourcePath
    },
    {
      content: portableBundle.sourceMap,
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
    },
    ...runtimeAssets
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
