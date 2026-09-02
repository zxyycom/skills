import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs, promisify } from "node:util";
import { isFileSystemError } from "../../tools/shared/src/node/filesystem.ts";
import { normalizeSourceMap } from "./source-map.ts";

export {
  buildGeneratedDeclaration,
  buildGeneratedTypeScriptDeclarationArtifacts,
  removeStaleGeneratedTypeScriptDeclarations,
  type GeneratedDeclarationOptions,
  type GeneratedTypeScriptDeclarationArtifactsOptions,
  type GeneratedTypeScriptDeclarationCleanupOptions,
  type GeneratedTypeScriptDeclarationCleanupResult
} from "./generated-typescript-declarations.ts";
export {
  buildGeneratedFileHeader,
  type GeneratedFileHeaderOptions
} from "./generated-file-header.ts";
export {
  normalizeSourceMap,
  type SourceMapNormalizationOptions
} from "./source-map.ts";

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
