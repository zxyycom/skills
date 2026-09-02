import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { isFileSystemError } from "../../tools/shared/src/node/filesystem.ts";
import type { GeneratedArtifact, GeneratedFileMode } from "./generated-file.ts";
import { buildGeneratedFileHeader } from "./generated-file-header.ts";

export type GeneratedDeclarationOptions = Readonly<{
  banner: string;
  sourcePath: string;
}>;

export type GeneratedTypeScriptDeclarationArtifactsOptions = Readonly<{
  declarationArtifactName: string;
  declarationEntryOutputPath: string;
  declarationOutputDirectory: string;
  entrySourcePath: string;
  rebuildCommand: string;
  repository: string;
  skillSourcePath: string;
  workspaceRoot: string;
}>;

export type GeneratedTypeScriptDeclarationCleanupOptions = Readonly<{
  declarationArtifactName: string;
  declarationOutputDirectory: string;
  expectedPaths: ReadonlySet<string>;
  mode: GeneratedFileMode;
  sourcePath: string;
  workspaceRoot: string;
}>;

export type GeneratedTypeScriptDeclarationCleanupResult = Readonly<{
  changed: boolean;
  hasUnsupportedEntries: boolean;
}>;

const execFileAsync = promisify(execFile);
const declarationHashbangPattern = /^#![^\r\n]*(?:\r?\n)?/u;
const declarationLineEndingPattern = /\r\n?/gu;
const declarationTypeScriptSpecifierPattern = /(["'])(\.\.?\/[^"']+)\.ts\1/gu;

type EmittedTypeScriptDeclarations = Readonly<{
  declarations: ReadonlyMap<string, string>;
  entryFilename: string;
}>;

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
    .replace(declarationHashbangPattern, "")
    .replace(declarationLineEndingPattern, "\n")
    .replace(declarationTypeScriptSpecifierPattern, "$1$2.mjs$1");
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
  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "generated-typescript-declarations-")
  );
  try {
    const emitted = await emitTypeScriptDeclarations(
      options,
      temporaryDirectory
    );
    return generatedTypeScriptDeclarationArtifacts(options, emitted);
  } finally {
    await fs.rm(temporaryDirectory, { force: true, recursive: true });
  }
}

async function emitTypeScriptDeclarations(
  options: GeneratedTypeScriptDeclarationArtifactsOptions,
  temporaryDirectory: string
): Promise<EmittedTypeScriptDeclarations> {
  const packageRequire = createRequire(import.meta.url);
  const compilerPackageRoot = path.dirname(
    packageRequire.resolve("@typescript/native-preview/package.json")
  );
  const compilerEntry = path.join(compilerPackageRoot, "bin", "tsgo");
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
  const entryFilename = path
    .basename(options.entrySourcePath)
    .replace(/\.ts$/u, ".d.ts");
  const emittedFiles = (await fs.readdir(emittedDirectory))
    .filter((filename) => filename.endsWith(".d.ts"))
    .sort();
  if (!emittedFiles.includes(entryFilename)) {
    throw new Error(
      `TypeScript did not emit ${entryFilename} for ${options.entrySourcePath}`
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
  return { declarations, entryFilename };
}

function reachableDeclarationFiles(
  emitted: EmittedTypeScriptDeclarations
): string[] {
  const reachableFiles = new Set<string>();
  const pendingFiles = [emitted.entryFilename];
  while (pendingFiles.length > 0) {
    const filename = pendingFiles.pop();
    if (filename === undefined || reachableFiles.has(filename)) continue;
    const declaration = emitted.declarations.get(filename);
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
  return [...reachableFiles].sort();
}

function generatedTypeScriptDeclarationArtifacts(
  options: GeneratedTypeScriptDeclarationArtifactsOptions,
  emitted: EmittedTypeScriptDeclarations
): GeneratedArtifact[] {
  const entryModuleName = emitted.entryFilename.replace(/\.d\.ts$/u, ".mjs");
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
  const sourceDirectory = path.posix.dirname(options.entrySourcePath);
  for (const filename of reachableDeclarationFiles(emitted)) {
    const declaration = emitted.declarations.get(filename);
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
