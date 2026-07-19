import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { collectSourceMarkers } from "./markers.ts";
import type {
  SourceFile,
  SupportedLanguage,
  TestEvidenceConfig
} from "./types.ts";

type LanguageDefinition = {
  extensions: string[];
  patterns: RegExp[];
};

const definitions: Record<SupportedLanguage, LanguageDefinition> = {
  rust: {
    extensions: [".rs"],
    patterns: [/#\s*\[\s*(?:(?:[A-Za-z_]\w*)::)*test(?:\s*\([^]*?\))?\s*\]/u]
  },
  typescript: {
    extensions: [".ts", ".tsx"],
    patterns: [/(?:^|[^\w$.])(?:describe|it|test)(?:\.\w+)*\s*(?:<[^>\n]+>)?\s*\(/mu]
  },
  javascript: {
    extensions: [".cjs", ".js", ".jsx", ".mjs"],
    patterns: [/(?:^|[^\w$.])(?:describe|it|test)(?:\.\w+)*\s*\(/mu]
  },
  python: {
    extensions: [".py"],
    patterns: [
      /^(?:async\s+)?def\s+test_[A-Za-z0-9_]*\s*\(/mu,
      /^class\s+Test[A-Za-z0-9_]*(?:\s*\([^)]*\))?\s*:/mu
    ]
  },
  go: {
    extensions: [".go"],
    patterns: [/^func\s+(?:Test|Benchmark|Fuzz)[A-Z0-9_][A-Za-z0-9_]*\s*\(/mu]
  },
  java: {
    extensions: [".java"],
    patterns: [/@(?:Test|ParameterizedTest|RepeatedTest|TestFactory)\b/u]
  },
  csharp: {
    extensions: [".cs"],
    patterns: [/\[(?:Fact|Theory|Test|TestCase|TestMethod)(?:Attribute)?(?:\([^]*?\))?\]/u]
  }
};

export type SourceDiscoveryResult = {
  errors: string[];
  files: SourceFile[];
};

export async function discoverSourceFiles(
  workspaceRoot: string,
  config: TestEvidenceConfig
): Promise<SourceDiscoveryResult> {
  const errors: string[] = [];
  const patterns = config.includeGlobs.length > 0
    ? config.includeGlobs
    : defaultSourceGlobs(config.languages);
  const relativePaths = await fg(patterns, {
    cwd: workspaceRoot,
    dot: true,
    followSymbolicLinks: false,
    ignore: config.ignoreGlobs,
    onlyFiles: true,
    unique: true
  });

  const files: SourceFile[] = [];
  for (const relativePath of relativePaths.sort()) {
    const normalizedPath = relativePath.replaceAll("\\", "/");
    let text: string;
    try {
      text = await fs.readFile(path.join(workspaceRoot, normalizedPath), "utf8");
    } catch (error) {
      errors.push(
        `${normalizedPath} could not be read: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      continue;
    }

    files.push({
      detectedLanguages: detectTestLanguages(normalizedPath, text, config.languages),
      markers: collectSourceMarkers(text, normalizedPath),
      relativePath: normalizedPath
    });
  }

  return { errors, files };
}

function defaultSourceGlobs(languages: readonly SupportedLanguage[]): string[] {
  return [...new Set(languages.flatMap((language) =>
    definitions[language].extensions.map((extension) => `**/*${extension}`)
  ))].sort();
}

function detectTestLanguages(
  relativePath: string,
  text: string,
  languages: readonly SupportedLanguage[]
): SupportedLanguage[] {
  const extension = path.extname(relativePath).toLowerCase();
  return languages.filter((language) => {
    const definition = definitions[language];
    return definition.extensions.includes(extension)
      && definition.patterns.some((pattern) => pattern.test(text));
  });
}
