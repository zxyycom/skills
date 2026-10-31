import path from "node:path";

export type SourceMapNormalizationOptions = Readonly<{
  generatedSourceMapDirectory: string;
  publishedSourceMapDirectory: string;
  workspaceRoot: string;
}>;

type BunSourceMap = Record<string, unknown> & {
  sources: readonly string[];
  sourcesContent?: unknown;
};

function isSourceContentArray(value: unknown): value is Array<string | null> {
  return (
    Array.isArray(value) &&
    value.every(
      (sourceContent) =>
        sourceContent === null || typeof sourceContent === "string"
    )
  );
}

function isBunSourceMap(value: unknown): value is BunSourceMap {
  return (
    value !== null &&
    typeof value === "object" &&
    "sources" in value &&
    Array.isArray(value.sources) &&
    value.sources.every((source) => typeof source === "string")
  );
}

function parseBunSourceMap(text: string): BunSourceMap {
  const parsed: unknown = JSON.parse(text);
  if (!isBunSourceMap(parsed)) {
    throw new Error("Bun source map must contain a string sources array");
  }
  return parsed;
}

function normalizeSourcesContent(
  sourceMap: BunSourceMap
): Array<string | null> | undefined {
  if (!("sourcesContent" in sourceMap)) {
    return undefined;
  }
  if (
    !isSourceContentArray(sourceMap.sourcesContent) ||
    sourceMap.sourcesContent.length !== sourceMap.sources.length
  ) {
    throw new Error(
      "Bun source map sourcesContent must align with sources and contain strings or null"
    );
  }
  return sourceMap.sourcesContent.map((sourceContent) =>
    sourceContent === null ? null : sourceContent.replace(/\r\n?/g, "\n")
  );
}

function normalizeSourcePaths(
  sources: readonly string[],
  options: SourceMapNormalizationOptions
): string[] {
  return sources.map((source) => {
    const absoluteSourcePath = path.resolve(
      options.generatedSourceMapDirectory,
      source
    );
    const relativePath = path.relative(
      options.workspaceRoot,
      absoluteSourcePath
    );
    if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`)) {
      throw new Error(
        `Bun source map contains a source outside the workspace: ${source}`
      );
    }
    return relativePath.replace(/\\/g, "/");
  });
}

export function normalizeSourceMap(
  text: string,
  options: SourceMapNormalizationOptions
): string {
  const sourceMap = parseBunSourceMap(text);
  const sourcesContent = normalizeSourcesContent(sourceMap);

  return `${JSON.stringify({
    ...sourceMap,
    sources: normalizeSourcePaths(sourceMap.sources, options),
    ...(sourcesContent === undefined ? {} : { sourcesContent }),
    sourceRoot: `${path.relative(options.publishedSourceMapDirectory, options.workspaceRoot).replace(/\\/g, "/")}/`
  })}\n`;
}
