import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { parseArgs, promisify } from "node:util";
import { isFileSystemError } from "../../tools/shared/src/node/filesystem.ts";

export type GeneratedFileMode = "check" | "write";

export type BunBundleOptions = {
  banner?: string;
  cwd: string;
  entryPath: string;
  format: "cjs" | "esm";
  keepNames?: boolean;
  minify?: boolean;
  outputFileName: string;
  plugins?: BunBuildPlugin[];
  sourceMapBaseDirectory?: string;
  sourceMap?: boolean;
};

export type BunBuildPlugin = {
  name: string;
  setup(builder: {
    onLoad(
      options: { filter: RegExp },
      callback: (args: { path: string }) => Promise<{
        contents: string;
        loader: "js" | "ts";
      }>
    ): void;
  }): void;
};

export type BunBundleResult = {
  code: string;
  sourceMap: string | null;
};

export type GeneratedArtifact = {
  content: string;
  path: string;
  sourcePath?: string;
};

export type GeneratedDeclarationOptions = {
  banner: string;
  sourcePath: string;
};

export type GeneratedTypeScriptDeclarationArtifactsOptions = {
  declarationArtifactName: string;
  declarationEntryOutputPath: string;
  declarationOutputDirectory: string;
  entrySourcePath: string;
  rebuildCommand: string;
  repository: string;
  skillSourcePath: string;
  workspaceRoot: string;
};

export type GeneratedTypeScriptDeclarationCleanupOptions = {
  declarationArtifactName: string;
  declarationOutputDirectory: string;
  expectedPaths: ReadonlySet<string>;
  mode: GeneratedFileMode;
  sourcePath: string;
  workspaceRoot: string;
};

export type GeneratedTypeScriptDeclarationCleanupResult = {
  changed: boolean;
  hasUnsupportedEntries: boolean;
};

export type GeneratedFileHeaderOptions = {
  additionalLines?: string[];
  artifactName: string;
  rebuildCommand: string;
  repository: string;
  skillSourcePath?: string;
  sourcePath: string;
};

export type SourceMapNormalizationOptions = {
  generatedSourceMapDirectory: string;
  publishedSourceMapDirectory: string;
  workspaceRoot: string;
};

const execFileAsync = promisify(execFile);

type BunBuildOutput = {
  path: string;
  text(): Promise<string>;
};

type BunBuildResult = {
  logs: unknown[];
  outputs: BunBuildOutput[];
  success: boolean;
};

type BunBuild = (options: {
  banner: string;
  entrypoints: string[];
  format: "cjs" | "esm";
  keepNames: boolean;
  minify: boolean;
  naming: string;
  outdir: string;
  packages: "bundle";
  plugins: BunBuildPlugin[];
  sourcemap: "linked" | "none";
  target: "node";
}) => Promise<BunBuildResult>;

function isSourceContentArray(value: unknown): value is Array<string | null> {
  return (
    Array.isArray(value) &&
    value.every(
      (sourceContent) =>
        sourceContent === null || typeof sourceContent === "string"
    )
  );
}

export function parseGeneratedFileMode(argv: string[]): GeneratedFileMode {
  const { values } = parseArgs({
    args: argv,
    options: {
      check: { type: "boolean" },
      write: { type: "boolean" }
    },
    strict: true
  });
  if (values.check && values.write) {
    throw new Error("--check and --write cannot be used together");
  }

  return values.write ? "write" : "check";
}

export function normalizeSourceMap(
  text: string,
  options: SourceMapNormalizationOptions
): string {
  const {
    generatedSourceMapDirectory,
    publishedSourceMapDirectory,
    workspaceRoot
  } = options;
  const parsed: unknown = JSON.parse(text);
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    !("sources" in parsed) ||
    !Array.isArray(parsed.sources) ||
    !parsed.sources.every((source) => typeof source === "string")
  ) {
    throw new Error("Bun source map must contain a string sources array");
  }
  let normalizedSourcesContent: Array<string | null> | undefined;
  if ("sourcesContent" in parsed) {
    if (
      !isSourceContentArray(parsed.sourcesContent) ||
      parsed.sourcesContent.length !== parsed.sources.length
    ) {
      throw new Error(
        "Bun source map sourcesContent must align with sources and contain strings or null"
      );
    }
    normalizedSourcesContent = parsed.sourcesContent.map((sourceContent) =>
      sourceContent === null ? null : sourceContent.replace(/\r\n?/g, "\n")
    );
  }

  return `${JSON.stringify({
    ...parsed,
    sources: parsed.sources.map((source) => {
      const absoluteSourcePath = path.resolve(
        generatedSourceMapDirectory,
        source
      );
      const relativePath = path.relative(workspaceRoot, absoluteSourcePath);
      if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`)) {
        throw new Error(
          `Bun source map contains a source outside the workspace: ${source}`
        );
      }
      return relativePath.replace(/\\/g, "/");
    }),
    ...(normalizedSourcesContent === undefined
      ? {}
      : { sourcesContent: normalizedSourcesContent }),
    sourceRoot: `${path.relative(publishedSourceMapDirectory, workspaceRoot).replace(/\\/g, "/")}/`
  })}\n`;
}

export async function bundleWithBun(
  options: BunBundleOptions
): Promise<BunBundleResult> {
  const sourceMapBaseDirectory = options.sourceMapBaseDirectory;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-bundle-"));
  const outputPath = path.join(tempDir, options.outputFileName);
  const entryHasShebang = (
    await fs.readFile(options.entryPath, "utf8")
  ).startsWith("#!");
  const banner = [
    ...(entryHasShebang ? [] : ["#!/usr/bin/env node"]),
    ...(options.banner === undefined ? [] : [options.banner])
  ].join("\n");
  const args = [
    "build",
    options.entryPath,
    "--target=node",
    `--format=${options.format}`,
    "--packages=bundle",
    ...(options.minify ? ["--minify"] : []),
    ...(options.keepNames ? ["--keep-names"] : []),
    ...(options.sourceMap ? ["--sourcemap=linked"] : []),
    ...(banner.length === 0 ? [] : [`--banner=${banner}`]),
    `--outdir=${tempDir.replace(/\\/g, "/")}`,
    `--entry-naming=${options.outputFileName}`
  ];

  try {
    let code: string;
    let generatedSourceMap: string | null = null;
    if (options.plugins === undefined) {
      await execFileAsync(process.execPath, args, { cwd: options.cwd });
      code = await fs.readFile(outputPath, "utf8");
      generatedSourceMap = options.sourceMap
        ? await fs.readFile(`${outputPath}.map`, "utf8")
        : null;
    } else {
      const bun = (
        globalThis as typeof globalThis & {
          Bun?: { build: BunBuild };
        }
      ).Bun;
      if (bun === undefined) {
        throw new Error("Bundling with plugins requires the Bun runtime");
      }
      const result = await bun.build({
        banner,
        entrypoints: [options.entryPath],
        format: options.format,
        keepNames: options.keepNames ?? false,
        minify: options.minify ?? false,
        naming: options.outputFileName,
        outdir: tempDir,
        packages: "bundle",
        plugins: options.plugins,
        sourcemap: options.sourceMap ? "linked" : "none",
        target: "node"
      });
      if (!result.success) {
        throw new Error(
          `Bun bundle failed: ${result.logs.map(String).join("\n")}`
        );
      }
      const codeOutput = result.outputs.find(
        (output) => path.resolve(output.path) === path.resolve(outputPath)
      );
      if (codeOutput === undefined) {
        throw new Error(`Bun bundle did not produce ${options.outputFileName}`);
      }
      code = await codeOutput.text();
      if (options.sourceMap) {
        const sourceMapOutput = result.outputs.find(
          (output) =>
            path.resolve(output.path) === path.resolve(`${outputPath}.map`)
        );
        if (sourceMapOutput === undefined) {
          throw new Error(
            `Bun bundle did not produce ${options.outputFileName}.map`
          );
        }
        generatedSourceMap = await sourceMapOutput.text();
      }
    }
    if (!code.startsWith("#!")) {
      throw new Error(
        `Bundled executable ${options.outputFileName} must start with a shebang`
      );
    }

    let sourceMap: string | null = null;
    if (options.sourceMap) {
      if (sourceMapBaseDirectory === undefined) {
        throw new Error(
          "sourceMapBaseDirectory is required when sourceMap is enabled"
        );
      }
      sourceMap = normalizeSourceMap(generatedSourceMap ?? "", {
        generatedSourceMapDirectory: path.dirname(outputPath),
        publishedSourceMapDirectory: sourceMapBaseDirectory,
        workspaceRoot: options.cwd
      });
    }

    return {
      code,
      sourceMap
    };
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

export async function buildGeneratedDeclaration(
  options: GeneratedDeclarationOptions
): Promise<string> {
  const declaration = (await fs.readFile(options.sourcePath, "utf8")).replace(
    /\r\n?/g,
    "\n"
  );
  return `${options.banner}\n${declaration.endsWith("\n") ? declaration : `${declaration}\n`}`;
}

function generatedDeclarationHeader(
  options: GeneratedTypeScriptDeclarationArtifactsOptions,
  sourcePath: string,
  artifactName: string
): string {
  return buildGeneratedFileHeader({
    artifactName,
    rebuildCommand: options.rebuildCommand,
    repository: options.repository,
    skillSourcePath: options.skillSourcePath,
    sourcePath
  });
}

function normalizeGeneratedTypeScriptDeclaration(declaration: string): string {
  const normalized = declaration
    .replace(/^#![^\r\n]*(?:\r?\n)?/u, "")
    .replace(/\r\n?/gu, "\n")
    .replace(/(["'])(\.\.?\/[^"']+)\.ts\1/gu, "$1$2.mjs$1");
  return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
}

function generatedDeclarationDependencies(
  declaration: string,
  filename: string
): string[] {
  const specifiers = [
    ...declaration.matchAll(/\bfrom\s+["']([^"']+)["']/gu),
    ...declaration.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu),
    ...declaration.matchAll(/^\s*import\s+["']([^"']+)["'];?\s*$/gmu)
  ].map((match) => match[1] ?? "");
  return [
    ...new Set(
      specifiers.map((specifier) => {
        const match = /^\.\/([^/\\]+)\.mjs$/u.exec(specifier);
        if (match === null) {
          throw new Error(
            `${filename} exposes unsupported declaration dependency ${specifier}`
          );
        }
        return `${match[1]}.d.ts`;
      })
    )
  ];
}

export async function buildGeneratedTypeScriptDeclarationArtifacts(
  options: GeneratedTypeScriptDeclarationArtifactsOptions
): Promise<GeneratedArtifact[]> {
  const packageRequire = createRequire(import.meta.url);
  const compilerPackageRoot = path.dirname(
    packageRequire.resolve("@typescript/native-preview/package.json")
  );
  const compilerEntry = path.join(compilerPackageRoot, "bin", "tsgo");
  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "generated-typescript-declarations-")
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
        "--target",
        "ES2024",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--allowImportingTsExtensions",
        "--strict",
        "--verbatimModuleSyntax",
        "--skipLibCheck",
        "false",
        "--types",
        "node",
        "--rootDir",
        ".",
        "--outDir",
        temporaryDirectory,
        options.entrySourcePath
      ],
      {
        cwd: options.workspaceRoot,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true
      }
    );

    const emittedDirectory = path.join(
      temporaryDirectory,
      path.dirname(options.entrySourcePath)
    );
    const entryDeclarationFilename = path
      .basename(options.entrySourcePath)
      .replace(/\.ts$/u, ".d.ts");
    const emittedFiles = (await fs.readdir(emittedDirectory))
      .filter((filename) => filename.endsWith(".d.ts"))
      .sort();
    if (!emittedFiles.includes(entryDeclarationFilename)) {
      throw new Error(
        `TypeScript did not emit ${entryDeclarationFilename} for ${options.entrySourcePath}`
      );
    }

    const declarations = new Map<string, string>();
    for (const filename of emittedFiles) {
      declarations.set(
        filename,
        normalizeGeneratedTypeScriptDeclaration(
          await fs.readFile(path.join(emittedDirectory, filename), "utf8")
        )
      );
    }

    const reachableFiles = new Set<string>();
    const pendingFiles = [entryDeclarationFilename];
    while (pendingFiles.length > 0) {
      const filename = pendingFiles.pop();
      if (filename === undefined || reachableFiles.has(filename)) continue;
      const declaration = declarations.get(filename);
      if (declaration === undefined) {
        throw new Error(`Missing emitted declaration dependency ${filename}`);
      }
      reachableFiles.add(filename);
      for (const dependency of generatedDeclarationDependencies(
        declaration,
        filename
      )) {
        if (!reachableFiles.has(dependency)) pendingFiles.push(dependency);
      }
    }

    const sourceDirectory = path.posix.dirname(options.entrySourcePath);
    const entryModuleName = entryDeclarationFilename.replace(
      /\.d\.ts$/u,
      ".mjs"
    );
    const artifacts: GeneratedArtifact[] = [
      {
        content: `${generatedDeclarationHeader(
          options,
          options.entrySourcePath,
          `${options.declarationArtifactName} entry`
        )}\nexport * from "./${path.basename(options.declarationOutputDirectory)}/${entryModuleName}";\n`,
        path: options.declarationEntryOutputPath,
        sourcePath: options.entrySourcePath
      }
    ];
    for (const filename of [...reachableFiles].sort()) {
      const declaration = declarations.get(filename);
      if (declaration === undefined) {
        throw new Error(`Missing emitted declaration ${filename}`);
      }
      const sourcePath = path.posix.join(
        sourceDirectory,
        filename.replace(/\.d\.ts$/u, ".ts")
      );
      artifacts.push({
        content: `${generatedDeclarationHeader(
          options,
          sourcePath,
          options.declarationArtifactName
        )}\n${declaration}`,
        path: path.join(
          options.declarationOutputDirectory,
          filename.replace(/\.d\.ts$/u, ".d.mts")
        ),
        sourcePath
      });
    }
    return artifacts;
  } finally {
    await fs.rm(temporaryDirectory, { force: true, recursive: true });
  }
}

function isGeneratedTypeScriptDeclaration(
  declaration: string,
  artifactName: string
): boolean {
  return declaration.startsWith(
    `/*\n * Generated ${artifactName}. Do not edit this file directly.\n`
  );
}

function unsupportedDeclarationArtifact(
  relativePath: string,
  reason: string
): void {
  console.error(
    `${relativePath} must be removed or relocated manually: ${reason}`
  );
}

export async function removeStaleGeneratedTypeScriptDeclarations(
  options: GeneratedTypeScriptDeclarationCleanupOptions
): Promise<GeneratedTypeScriptDeclarationCleanupResult> {
  let entries;
  try {
    entries = await fs.readdir(options.declarationOutputDirectory, {
      withFileTypes: true
    });
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return { changed: false, hasUnsupportedEntries: false };
    }
    throw error;
  }

  let changed = false;
  let hasUnsupportedEntries = false;
  for (const entry of entries) {
    const entryPath = path.join(options.declarationOutputDirectory, entry.name);
    if (options.expectedPaths.has(entryPath)) continue;

    changed = true;
    const relativePath = path
      .relative(options.workspaceRoot, entryPath)
      .replace(/\\/gu, "/");
    if (!entry.isFile() || !entry.name.endsWith(".d.mts")) {
      hasUnsupportedEntries = true;
      unsupportedDeclarationArtifact(
        relativePath,
        "only direct regular generated .d.mts files are eligible for cleanup"
      );
      continue;
    }

    let declaration: string;
    try {
      declaration = await fs.readFile(entryPath, "utf8");
    } catch {
      hasUnsupportedEntries = true;
      unsupportedDeclarationArtifact(
        relativePath,
        "the declaration could not be read to verify its generated header"
      );
      continue;
    }
    if (
      !isGeneratedTypeScriptDeclaration(
        declaration,
        options.declarationArtifactName
      )
    ) {
      hasUnsupportedEntries = true;
      unsupportedDeclarationArtifact(
        relativePath,
        "the declaration does not carry this generator's header"
      );
      continue;
    }

    if (options.mode === "check") {
      console.error(`${relativePath} is not emitted by ${options.sourcePath}`);
    } else {
      await fs.unlink(entryPath);
      console.log(`Removed ${relativePath}`);
    }
  }
  return { changed, hasUnsupportedEntries };
}

function normalizeGeneratedTextLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

async function hasRegularGeneratedArtifact(
  outputPath: string
): Promise<boolean> {
  try {
    const status = await fs.lstat(outputPath);
    if (!status.isFile()) {
      throw new Error(
        `Generated artifact path must be a regular file: ${outputPath}`
      );
    }
    return true;
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
}

export async function syncGeneratedFile(
  outputPath: string,
  expected: string,
  mode: GeneratedFileMode
): Promise<"current" | "stale" | "written"> {
  if (await hasRegularGeneratedArtifact(outputPath)) {
    const actual = await fs.readFile(outputPath, "utf8");
    if (
      normalizeGeneratedTextLineEndings(actual) ===
      normalizeGeneratedTextLineEndings(expected)
    ) {
      return "current";
    }
  }

  if (mode === "check") {
    return "stale";
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await hasRegularGeneratedArtifact(outputPath);
  await fs.writeFile(outputPath, expected, "utf8");
  return "written";
}

export async function syncGeneratedArtifacts(
  artifacts: readonly GeneratedArtifact[],
  mode: GeneratedFileMode,
  workspaceRoot: string,
  sourcePath: string
): Promise<boolean> {
  let changed = false;
  for (const artifact of artifacts) {
    const result = await syncGeneratedFile(
      artifact.path,
      artifact.content,
      mode
    );
    if (result === "current") {
      continue;
    }

    changed = true;
    const relativePath = path
      .relative(workspaceRoot, artifact.path)
      .replace(/\\/g, "/");
    const artifactSourcePath = artifact.sourcePath ?? sourcePath;
    if (result === "stale") {
      console.error(
        `${relativePath} is missing or not generated from ${artifactSourcePath}`
      );
    } else {
      console.log(`Wrote ${relativePath}`);
    }
  }
  return changed;
}

export function buildGeneratedFileHeader(
  options: GeneratedFileHeaderOptions
): string {
  const repositoryUrl = `https://github.com/${options.repository}`;
  const headerLines = [
    "/*",
    ` * Generated ${options.artifactName}. Do not edit this file directly.`,
    ` * Repository: ${repositoryUrl}`,
    ` * Maintained source: ${repositoryUrl}/blob/main/${options.sourcePath}`,
    ` * Source path: ${options.sourcePath}`,
    ...(options.skillSourcePath === undefined
      ? []
      : [
          ` * Skill source directory: ${repositoryUrl}/tree/main/${options.skillSourcePath}`
        ]),
    ` * Rebuild: ${options.rebuildCommand}`,
    ...(options.additionalLines ?? []).map((line) => ` * ${line}`),
    " */"
  ];
  return headerLines.join("\n");
}
