import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { toJsonSchema } from "@valibot/to-json-schema";
import {
  buildGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedArtifacts,
  type GeneratedFileMode,
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
const schemaSourcePath = "tools/task-graph/src/schema.ts";
const publishedScriptsDirectory = path.join(rootDir, skillSourcePath, "scripts");
const cliOutputPath = path.join(publishedScriptsDirectory, "task-graph.mjs");
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

const portableWriteFileAtomicFilename = "node_modules/write-file-atomic/lib/index.js";
const execFileAsync = promisify(execFile);

function declarationHeader(sourcePath: string, artifactName: string): string {
  return buildGeneratedFileHeader({
    artifactName,
    rebuildCommand,
    repository: githubRepository,
    skillSourcePath,
    sourcePath
  });
}

function normalizeGeneratedDeclaration(declaration: string): string {
  const normalized = declaration
    .replace(/^#![^\r\n]*(?:\r?\n)?/u, "")
    .replace(/\r\n?/gu, "\n")
    .replace(/(["'])(\.\.?\/[^"']+)\.ts\1/gu, "$1$2.mjs$1");
  return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
}

function declarationDependencies(
  declaration: string,
  filename: string
): string[] {
  const specifiers = [
    ...declaration.matchAll(/\bfrom\s+["']([^"']+)["']/gu),
    ...declaration.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu),
    ...declaration.matchAll(/^\s*import\s+["']([^"']+)["'];?\s*$/gmu)
  ].map((match) => match[1] ?? "");
  return [...new Set(specifiers)].map((specifier) => {
    const match = /^\.\/([^/\\]+)\.mjs$/u.exec(specifier);
    if (match === null) {
      throw new Error(
        `${filename} exposes unsupported declaration dependency ${specifier}`
      );
    }
    return `${match[1]}.d.ts`;
  });
}

async function buildDeclarationArtifacts(): Promise<GeneratedArtifact[]> {
  const packageRequire = createRequire(import.meta.url);
  const compilerPackageRoot = path.dirname(
    packageRequire.resolve("@typescript/native-preview/package.json")
  );
  const compilerEntry = path.join(compilerPackageRoot, "bin", "tsgo");
  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "task-graph-declarations-")
  );
  try {
    await execFileAsync(
      process.execPath,
      [
        compilerEntry,
        "--ignoreConfig",
        "--declaration",
        "--emitDeclarationOnly",
        "--stripInternal",
        "--target", "ES2024",
        "--module", "NodeNext",
        "--moduleResolution", "NodeNext",
        "--allowImportingTsExtensions",
        "--strict",
        "--verbatimModuleSyntax",
        "--skipLibCheck", "false",
        "--types", "node",
        "--rootDir", ".",
        "--outDir", tempDirectory,
        cliSourcePath
      ],
      {
        cwd: rootDir,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true
      }
    );

    const emittedDirectory = path.join(
      tempDirectory,
      "tools",
      "task-graph",
      "src"
    );
    const emittedFiles = (await fs.readdir(emittedDirectory))
      .filter((filename) => filename.endsWith(".d.ts"))
      .sort();
    if (!emittedFiles.includes("cli.d.ts")) {
      throw new Error("TypeScript did not emit the task graph CLI declaration entry");
    }

    const declarations = new Map<string, string>();
    for (const filename of emittedFiles) {
      declarations.set(
        filename,
        normalizeGeneratedDeclaration(
          await fs.readFile(path.join(emittedDirectory, filename), "utf8")
        )
      );
    }
    const reachableFiles = new Set<string>();
    const pendingFiles = ["cli.d.ts"];
    while (pendingFiles.length > 0) {
      const filename = pendingFiles.pop();
      if (filename === undefined || reachableFiles.has(filename)) continue;
      const declaration = declarations.get(filename);
      if (declaration === undefined) {
        throw new Error(`Missing emitted declaration dependency ${filename}`);
      }
      reachableFiles.add(filename);
      for (const dependency of declarationDependencies(declaration, filename)) {
        if (!reachableFiles.has(dependency)) pendingFiles.push(dependency);
      }
    }

    const artifacts: GeneratedArtifact[] = [{
      content: `${declarationHeader(
        cliSourcePath,
        "task graph SDK TypeScript declaration entry"
      )}\nexport * from "./task-graph-sdk/cli.mjs";\n`,
      path: path.join(publishedScriptsDirectory, "task-graph.d.mts"),
      sourcePath: cliSourcePath
    }];
    for (const filename of [...reachableFiles].sort()) {
      const sourceFilename = filename.replace(/\.d\.ts$/u, ".ts");
      const sourcePath = path.posix.join(
        "tools/task-graph/src",
        sourceFilename
      );
      const declaration = declarations.get(filename);
      if (declaration === undefined) {
        throw new Error(`Missing emitted declaration ${filename}`);
      }
      artifacts.push({
        content: `${declarationHeader(
          sourcePath,
          "task graph SDK TypeScript declaration"
        )}\n${declaration}`,
        path: path.join(
          declarationOutputDirectory,
          filename.replace(/\.d\.ts$/u, ".d.mts")
        ),
        sourcePath
      });
    }
    return artifacts;
  } finally {
    await fs.rm(tempDirectory, { force: true, recursive: true });
  }
}

async function removeStaleDeclarationArtifacts(
  expectedPaths: ReadonlySet<string>,
  mode: GeneratedFileMode
): Promise<boolean> {
  let entries;
  try {
    entries = await fs.readdir(declarationOutputDirectory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }

  let changed = false;
  for (const entry of entries) {
    const entryPath = path.join(declarationOutputDirectory, entry.name);
    if (expectedPaths.has(entryPath)) continue;
    changed = true;
    const relativePath = path.relative(rootDir, entryPath).replace(/\\/gu, "/");
    if (mode === "check") {
      console.error(`${relativePath} is not emitted by ${cliSourcePath}`);
    } else {
      await fs.rm(entryPath, { force: true, recursive: true });
      console.log(`Removed ${relativePath}`);
    }
  }
  return changed;
}

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

  const declarationArtifacts = await buildDeclarationArtifacts();
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
      + "task-graph CLI info command.",
    title: "TaskGraphIndex"
  };
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
    ...declarationArtifacts,
    {
      content: `${JSON.stringify(jsonSchema, null, 2)}\n`,
      path: schemaOutputPath,
      sourcePath: schemaSourcePath
    }
  ];
}

async function main(): Promise<void> {
  const mode = parseGeneratedFileMode(process.argv.slice(2));
  const artifacts = await buildArtifacts();
  const changedArtifacts = await syncGeneratedArtifacts(
    artifacts,
    mode,
    rootDir,
    cliSourcePath
  );
  const expectedDeclarationPaths = new Set(
    artifacts
      .map((artifact) => artifact.path)
      .filter((artifactPath) => path.dirname(artifactPath) === declarationOutputDirectory)
  );
  const changedStaleDeclarations = await removeStaleDeclarationArtifacts(
    expectedDeclarationPaths,
    mode
  );
  const changed = changedArtifacts || changedStaleDeclarations;
  if (mode === "check" && changed) {
    process.exit(1);
  }
  if (!changed) {
    console.log("Task graph generated artifacts are current.");
  }
}

await main();
