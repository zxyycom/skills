import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { collectSourceMarkers } from "./markers.ts";
import type {
  SourceFile,
  SourceMarker,
  SupportedLanguage,
  TestEntry,
  TestEvidenceConfig
} from "./types.ts";

type EntryPattern = {
  expression: RegExp;
  offsetGroup?: number;
};

type LanguageDefinition = {
  extensions: string[];
  patterns: EntryPattern[];
};

const definitions: Record<SupportedLanguage, LanguageDefinition> = {
  rust: {
    extensions: [".rs"],
    patterns: [{
      expression: /#\s*\[\s*(?:(?:[A-Za-z_]\w*)::)*test(?:\s*\([^]*?\))?\s*\]/gu
    }]
  },
  typescript: {
    extensions: [".cts", ".mts", ".ts", ".tsx"],
    patterns: [{
      expression:
        /(?:^|[^\w$.])((?:it|test)(?:\.(?:concurrent|each|fail|failing|fails|fixme|for|only|runIf|sequential|skip|skipIf|todo))*\s*(?:<[^>\n]+>)?\s*\()/gmu,
      offsetGroup: 1
    }]
  },
  javascript: {
    extensions: [".cjs", ".js", ".jsx", ".mjs"],
    patterns: [{
      expression:
        /(?:^|[^\w$.])((?:it|test)(?:\.(?:concurrent|each|fail|failing|fails|fixme|for|only|runIf|sequential|skip|skipIf|todo))*\s*\()/gmu,
      offsetGroup: 1
    }]
  },
  python: {
    extensions: [".py"],
    patterns: [{
      expression: /^[ \t]*(?:async\s+)?def\s+test_[A-Za-z0-9_]*\s*\(/gmu
    }]
  },
  go: {
    extensions: [".go"],
    patterns: [{
      expression: /^func\s+(?:Test|Benchmark|Fuzz)[A-Z0-9_][A-Za-z0-9_]*\s*\(/gmu
    }]
  },
  java: {
    extensions: [".java"],
    patterns: [{
      expression: /@(?:Test|ParameterizedTest|RepeatedTest|TestFactory)\b/gu
    }]
  },
  csharp: {
    extensions: [".cs"],
    patterns: [{
      expression: /\[(?:Fact|Theory|Test|TestCase|TestMethod)(?:Attribute)?(?:\([^]*?\))?\]/gu
    }]
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

    const collectedMarkers = collectSourceMarkers(text, normalizedPath);
    const testEntries = detectTestEntries(normalizedPath, text, config.languages);
    errors.push(...collectedMarkers.errors);
    files.push({
      markers: attachMarkersToEntries(text, collectedMarkers.markers, testEntries),
      relativePath: normalizedPath,
      testEntries
    });
  }

  return { errors, files };
}

function defaultSourceGlobs(languages: readonly SupportedLanguage[]): string[] {
  return [...new Set(languages.flatMap((language) =>
    definitions[language].extensions.map((extension) => `**/*${extension}`)
  ))].sort();
}

function detectTestEntries(
  relativePath: string,
  text: string,
  languages: readonly SupportedLanguage[]
): TestEntry[] {
  const extension = path.extname(relativePath).toLowerCase();
  const lineOffsets = collectLineOffsets(text);
  const entries = languages.flatMap((language) => {
    const definition = definitions[language];
    if (!definition.extensions.includes(extension)) {
      return [];
    }
    return definition.patterns.flatMap((pattern) =>
      collectPatternEntries(text, language, pattern, lineOffsets)
    );
  });

  const unique = new Map<string, TestEntry>();
  for (const entry of entries) {
    unique.set(`${entry.language}:${entry.offset}`, entry);
  }
  return [...unique.values()].sort((left, right) => left.offset - right.offset);
}

function collectPatternEntries(
  text: string,
  language: SupportedLanguage,
  pattern: EntryPattern,
  lineOffsets: readonly number[]
): TestEntry[] {
  const entries: TestEntry[] = [];
  for (const match of text.matchAll(pattern.expression)) {
    if (match.index === undefined) {
      continue;
    }
    const capturedPrefix = pattern.offsetGroup === undefined
      ? ""
      : match[0].slice(0, match[0].indexOf(match[pattern.offsetGroup] ?? ""));
    const offset = match.index + capturedPrefix.length;
    const location = locateOffset(offset, lineOffsets);
    entries.push({
      column: location.column,
      language,
      line: location.line,
      offset
    });
  }
  return entries;
}

function attachMarkersToEntries(
  text: string,
  markers: readonly SourceMarker[],
  entries: readonly TestEntry[]
): SourceMarker[] {
  const lines = text.split(/\r?\n/u);
  return markers.map((marker) => {
    const entry = entries.find((candidate) =>
      candidate.offset > marker.offset
      && hasAttachableGap(
        lines,
        marker.line,
        candidate.line,
        candidate.language
      )
    );
    return {
      ...marker,
      attachedEntryOffset: entry?.offset ?? null
    };
  });
}

function hasAttachableGap(
  lines: readonly string[],
  markerLine: number,
  entryLine: number,
  language: SupportedLanguage
): boolean {
  for (let lineNumber = markerLine + 1; lineNumber < entryLine; lineNumber += 1) {
    const line = (lines[lineNumber - 1] ?? "").trim();
    if (
      line.length > 0
      && !isCommentLine(line)
      && !isLanguageAttachmentLine(line, language)
    ) {
      return false;
    }
  }
  return true;
}

function isCommentLine(line: string): boolean {
  return /^(?:\/\/|#|--|;|\/\*|\*|\*\/|<!--|-->)/u.test(line);
}

function isLanguageAttachmentLine(
  line: string,
  language: SupportedLanguage
): boolean {
  if (language === "python" || language === "java") {
    return line.startsWith("@");
  }
  if (language === "csharp") {
    return line.startsWith("[");
  }
  return false;
}

function collectLineOffsets(text: string): number[] {
  const offsets = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      offsets.push(index + 1);
    }
  }
  return offsets;
}

function locateOffset(
  offset: number,
  lineOffsets: readonly number[]
): { column: number; line: number } {
  let low = 0;
  let high = lineOffsets.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const lineOffset = lineOffsets[middle] ?? 0;
    const nextOffset = lineOffsets[middle + 1] ?? Number.POSITIVE_INFINITY;
    if (offset < lineOffset) {
      high = middle - 1;
    } else if (offset >= nextOffset) {
      low = middle + 1;
    } else {
      return { column: offset - lineOffset + 1, line: middle + 1 };
    }
  }
  return { column: 1, line: 1 };
}
