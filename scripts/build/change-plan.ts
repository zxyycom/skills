import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { toJsonSchema } from "@valibot/to-json-schema";
import { compile } from "json-schema-to-typescript";
import {
  buildGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedArtifacts,
  type GeneratedArtifact,
  type GeneratedFileMode
} from "../lib/generated-file.ts";
import { githubRepository, rootDir } from "../lib/project.ts";
import { changePlanMetadataSchema } from "../../tools/change-plan/src/metadata.ts";

const rebuildCommand = "bun run sync:change-plan-cli";
const skillSourcePath = "skills/change-plan";
const sourceRelativePath = "tools/change-plan/src/cli.ts";
const metadataSourcePath = "tools/change-plan/src/metadata.ts";
const outputRelativePath = "skills/change-plan/scripts/change-plan.mjs";
const publishedScriptsDirectory = path.join(
  rootDir,
  skillSourcePath,
  "scripts"
);
const declarationOutputDirectory = path.join(
  publishedScriptsDirectory,
  "change-plan-sdk"
);
const metadataTypesFilename = "change-plan-metadata.types.d.ts";
const metadataSchemaFilename = "change-plan-metadata.schema.json";
const metadataSchemaOutputPath = path.join(
  rootDir,
  skillSourcePath,
  "references",
  "schemas",
  metadataSchemaFilename
);
const execFileAsync = promisify(execFile);

type MetadataArtifacts = {
  declaration: string;
  schemaArtifact: GeneratedArtifact;
};

function isMissingPathError(error: unknown): boolean {
  return error !== null
    && typeof error === "object"
    && "code" in error
    && error.code === "ENOENT";
}

function generatedHeader(sourcePath: string, artifactName: string): string {
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

function replaceMetadataSchemaType(declaration: string): string {
  const valibotImport = 'import * as v from "valibot";\n';
  const schemaStartMarker = "export declare const changePlanMetadataSchema:";
  const typeEndMarker = "export type ChangePlanMetadata = v.InferOutput<typeof changePlanMetadataSchema>;";
  const schemaStart = declaration.indexOf(schemaStartMarker);
  const typeEndStart = declaration.indexOf(typeEndMarker);
  if (
    !declaration.startsWith(valibotImport)
    || schemaStart === -1
    || typeEndStart <= schemaStart
  ) {
    throw new Error(
      "Emitted change-plan metadata declaration has an unexpected schema shape"
    );
  }
  const typeEnd = typeEndStart + typeEndMarker.length;
  const publicTypeImport = [
    'import type { ChangePlanMetadata } from "./change-plan-metadata.types.mjs";',
    'export type { ChangePlanMetadata } from "./change-plan-metadata.types.mjs";'
  ].join("\n");
  return `${publicTypeImport}${declaration.slice(typeEnd)}`;
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

async function buildMetadataArtifacts(): Promise<MetadataArtifacts> {
  const converted = toJsonSchema(changePlanMetadataSchema, {
    errorMode: "throw",
    target: "draft-2020-12",
    typeMode: "output"
  });
  const schema = {
    ...converted,
    $id: `https://raw.githubusercontent.com/${githubRepository}/main/`
      + `${skillSourcePath}/references/schemas/${metadataSchemaFilename}`,
    title: "ChangePlanMetadata"
  };
  const declaration = await compile(
    // The compiler accepts draft 2020-12 at runtime, but its input type is
    // still declared as JSON Schema draft 4.
    schema as Parameters<typeof compile>[0],
    "ChangePlanMetadata",
    {
      bannerComment: "",
      style: {
        bracketSpacing: true,
        printWidth: 88,
        semi: true,
        singleQuote: false,
        tabWidth: 2,
        trailingComma: "none",
        useTabs: false
      },
      unknownAny: true
    }
  );
  return {
    declaration: `${declaration.trim()}\n`,
    schemaArtifact: {
      content: `${JSON.stringify(schema, null, 2)}\n`,
      path: metadataSchemaOutputPath,
      sourcePath: metadataSourcePath
    }
  };
}

async function buildDeclarationArtifacts(
  metadataDeclaration: string
): Promise<GeneratedArtifact[]> {
  const packageRequire = createRequire(import.meta.url);
  const compilerPackageRoot = path.dirname(
    packageRequire.resolve("@typescript/native-preview/package.json")
  );
  const compilerEntry = path.join(compilerPackageRoot, "bin", "tsgo");
  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "change-plan-declarations-")
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
        sourceRelativePath
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
      "change-plan",
      "src"
    );
    const emittedFiles = (await fs.readdir(emittedDirectory))
      .filter((filename) => filename.endsWith(".d.ts"))
      .sort();
    if (!emittedFiles.includes("cli.d.ts")) {
      throw new Error("TypeScript did not emit the change-plan CLI declaration entry");
    }

    const declarations = new Map<string, string>();
    for (const filename of emittedFiles) {
      const declaration = normalizeGeneratedDeclaration(
        await fs.readFile(path.join(emittedDirectory, filename), "utf8")
      );
      declarations.set(
        filename,
        filename === "metadata.d.ts"
          ? replaceMetadataSchemaType(declaration)
          : declaration
      );
    }
    declarations.set(metadataTypesFilename, metadataDeclaration);

    const reachableFiles = new Set<string>();
    const pendingFiles = ["cli.d.ts"];
    while (pendingFiles.length > 0) {
      const filename = pendingFiles.pop();
      if (filename === undefined || reachableFiles.has(filename)) {
        continue;
      }
      const declaration = declarations.get(filename);
      if (declaration === undefined) {
        throw new Error(`Missing emitted declaration dependency ${filename}`);
      }
      reachableFiles.add(filename);
      for (const dependency of declarationDependencies(declaration, filename)) {
        if (!reachableFiles.has(dependency)) {
          pendingFiles.push(dependency);
        }
      }
    }

    const artifacts: GeneratedArtifact[] = [{
      content: `${generatedHeader(
        sourceRelativePath,
        "change plan lifecycle CLI TypeScript declaration entry"
      )}\nexport * from "./change-plan-sdk/cli.mjs";\n`,
      path: path.join(publishedScriptsDirectory, "change-plan.d.mts"),
      sourcePath: sourceRelativePath
    }];
    for (const filename of [...reachableFiles].sort()) {
      const metadataTypes = filename === metadataTypesFilename;
      const sourcePath = metadataTypes
        ? metadataSourcePath
        : path.posix.join(
          "tools/change-plan/src",
          filename.replace(/\.d\.ts$/u, ".ts")
        );
      const declaration = declarations.get(filename);
      if (declaration === undefined) {
        throw new Error(`Missing emitted declaration ${filename}`);
      }
      artifacts.push({
        content: `${generatedHeader(
          sourcePath,
          metadataTypes
            ? "ChangePlanMetadata schema-derived TypeScript declarations"
            : "change plan lifecycle SDK TypeScript declaration"
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

async function buildBundleArtifacts(): Promise<GeneratedArtifact[]> {
  const bundle = await bundleWithBun({
    banner: generatedHeader(
      sourceRelativePath,
      "change plan lifecycle CLI"
    ),
    cwd: rootDir,
    entryPath: path.join(rootDir, sourceRelativePath),
    format: "esm",
    keepNames: true,
    minify: true,
    outputFileName: path.basename(outputRelativePath),
    sourceMapBaseDirectory: path.dirname(
      path.join(rootDir, outputRelativePath)
    ),
    sourceMap: true
  });
  if (bundle.sourceMap === null) {
    throw new Error("Change plan CLI bundle must include a source map");
  }
  const outputPath = path.join(rootDir, outputRelativePath);
  return [
    { content: bundle.code, path: outputPath, sourcePath: sourceRelativePath },
    {
      content: bundle.sourceMap,
      path: `${outputPath}.map`,
      sourcePath: sourceRelativePath
    }
  ];
}

async function removeStaleDeclarationArtifacts(
  expectedPaths: ReadonlySet<string>,
  mode: GeneratedFileMode
): Promise<boolean> {
  let entries;
  try {
    entries = await fs.readdir(declarationOutputDirectory, {
      withFileTypes: true
    });
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }

  let changed = false;
  for (const entry of entries) {
    const entryPath = path.join(declarationOutputDirectory, entry.name);
    if (expectedPaths.has(entryPath)) {
      continue;
    }
    changed = true;
    const relativePath = path.relative(rootDir, entryPath).replace(/\\/gu, "/");
    if (mode === "check") {
      console.error(`Generated file differs: ${relativePath}`);
    } else {
      await fs.rm(entryPath, { force: true, recursive: true });
      console.log(`Removed stale generated file: ${relativePath}`);
    }
  }
  return changed;
}

async function main(): Promise<void> {
  const mode = parseGeneratedFileMode(process.argv.slice(2));
  const metadataArtifacts = await buildMetadataArtifacts();
  const artifacts = [
    ...await buildBundleArtifacts(),
    ...await buildDeclarationArtifacts(metadataArtifacts.declaration),
    metadataArtifacts.schemaArtifact
  ];
  const changed = await syncGeneratedArtifacts(
    artifacts,
    mode,
    rootDir,
    sourceRelativePath
  );
  const staleDeclarations = await removeStaleDeclarationArtifacts(
    new Set(
      artifacts
        .map((artifact) => artifact.path)
        .filter((artifactPath) => path.dirname(artifactPath) === declarationOutputDirectory)
    ),
    mode
  );

  if (mode === "check" && (changed || staleDeclarations)) {
    process.exit(1);
  }
  if (!changed && !staleDeclarations) {
    console.log("Change plan CLI generated artifacts are current.");
  }
}

await main();
