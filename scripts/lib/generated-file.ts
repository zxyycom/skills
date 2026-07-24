import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs, promisify } from "node:util";
import { pathExists } from "../../tools/shared/src/node/filesystem.ts";

export type GeneratedFileMode = "check" | "write";

export type BunBundleOptions = {
  banner?: string;
  cwd: string;
  entryPath: string;
  format: "cjs" | "esm";
  keepNames?: boolean;
  minify?: boolean;
  outputFileName: string;
  sourceMapBaseDirectory?: string;
  sourceMap?: boolean;
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

function isSourceContentArray(value: unknown): value is Array<string | null> {
  return Array.isArray(value)
    && value.every(
      (sourceContent) => sourceContent === null || typeof sourceContent === "string"
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
    parsed === null
    || typeof parsed !== "object"
    || !("sources" in parsed)
    || !Array.isArray(parsed.sources)
    || !parsed.sources.every((source) => typeof source === "string")
  ) {
    throw new Error("Bun source map must contain a string sources array");
  }
  let normalizedSourcesContent: Array<string | null> | undefined;
  if ("sourcesContent" in parsed) {
    if (
      !isSourceContentArray(parsed.sourcesContent)
      || parsed.sourcesContent.length !== parsed.sources.length
    ) {
      throw new Error(
        "Bun source map sourcesContent must align with sources and contain strings or null"
      );
    }
    normalizedSourcesContent = parsed.sourcesContent.map((sourceContent) => (
      sourceContent === null ? null : sourceContent.replace(/\r\n?/g, "\n")
    ));
  }

  return `${JSON.stringify({
    ...parsed,
    sources: parsed.sources.map((source) => {
      const absoluteSourcePath = path.resolve(generatedSourceMapDirectory, source);
      const relativePath = path.relative(workspaceRoot, absoluteSourcePath);
      if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`)) {
        throw new Error(`Bun source map contains a source outside the workspace: ${source}`);
      }
      return relativePath.replace(/\\/g, "/");
    }),
    ...(normalizedSourcesContent === undefined
      ? {}
      : { sourcesContent: normalizedSourcesContent }),
    sourceRoot: `${path.relative(publishedSourceMapDirectory, workspaceRoot).replace(/\\/g, "/")}/`
  })}\n`;
}

export async function bundleWithBun(options: BunBundleOptions): Promise<BunBundleResult> {
  const sourceMapBaseDirectory = options.sourceMapBaseDirectory;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-bundle-"));
  const outputPath = path.join(tempDir, options.outputFileName);
  const entryHasShebang = (await fs.readFile(options.entryPath, "utf8")).startsWith("#!");
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
    await execFileAsync(process.execPath, args, { cwd: options.cwd });
    const code = await fs.readFile(outputPath, "utf8");
    if (!code.startsWith("#!")) {
      throw new Error(`Bundled executable ${options.outputFileName} must start with a shebang`);
    }

    let sourceMap: string | null = null;
    if (options.sourceMap) {
      if (sourceMapBaseDirectory === undefined) {
        throw new Error("sourceMapBaseDirectory is required when sourceMap is enabled");
      }
      sourceMap = normalizeSourceMap(
        await fs.readFile(`${outputPath}.map`, "utf8"),
        {
          generatedSourceMapDirectory: path.dirname(outputPath),
          publishedSourceMapDirectory: sourceMapBaseDirectory,
          workspaceRoot: options.cwd
        }
      );
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
  const declaration = (await fs.readFile(options.sourcePath, "utf8"))
    .replace(/\r\n?/g, "\n");
  return `${options.banner}\n${declaration.endsWith("\n") ? declaration : `${declaration}\n`}`;
}

function normalizeGeneratedTextLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

export async function syncGeneratedFile(
  outputPath: string,
  expected: string,
  mode: GeneratedFileMode
): Promise<"current" | "stale" | "written"> {
  if (await pathExists(outputPath)) {
    const actual = await fs.readFile(outputPath, "utf8");
    if (
      normalizeGeneratedTextLineEndings(actual)
      === normalizeGeneratedTextLineEndings(expected)
    ) {
      return "current";
    }
  }

  if (mode === "check") {
    return "stale";
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
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
    const result = await syncGeneratedFile(artifact.path, artifact.content, mode);
    if (result === "current") {
      continue;
    }

    changed = true;
    const relativePath = path.relative(workspaceRoot, artifact.path).replace(/\\/g, "/");
    const artifactSourcePath = artifact.sourcePath ?? sourcePath;
    if (result === "stale") {
      console.error(`${relativePath} is missing or not generated from ${artifactSourcePath}`);
    } else {
      console.log(`Wrote ${relativePath}`);
    }
  }
  return changed;
}

export function buildGeneratedFileHeader(options: GeneratedFileHeaderOptions): string {
  const repositoryUrl = `https://github.com/${options.repository}`;
  const headerLines = [
    "/*",
    ` * Generated ${options.artifactName}. Do not edit this file directly.`,
    ` * Repository: ${repositoryUrl}`,
    ` * Maintained source: ${repositoryUrl}/blob/main/${options.sourcePath}`,
    ` * Source path: ${options.sourcePath}`,
    ...(options.skillSourcePath === undefined
      ? []
      : [` * Skill source directory: ${repositoryUrl}/tree/main/${options.skillSourcePath}`]),
    ` * Rebuild: ${options.rebuildCommand}`,
    ...(options.additionalLines ?? []).map((line) => ` * ${line}`),
    " */"
  ];
  return headerLines.join("\n");
}
