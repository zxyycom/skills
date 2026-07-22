import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import picomatch from "picomatch";
import { createDiagnostic, sortUniqueDiagnostics } from "./diagnostics.ts";
import { collectSourceMarkers } from "./markers.ts";
import {
  ensureRegexMatchFlags,
  loadRegexCollectorConfig
} from "./regex-config.ts";
import {
  testEntryInventorySchemaVersion,
  type RegexCollectorConfig,
  type RegexDetector,
  type SupportedLanguage,
  type TestEntry,
  type TestEntryInventory,
  type TestEntryMarker,
  type TestEvidenceDiagnostic
} from "./types.ts";

export type CollectRegexTestEntriesOptions = {
  config?: unknown;
  configPath?: string;
  workspaceRoot: string;
};

type CompiledDetector = RegexDetector & {
  excludeMatchers: PathMatcher[];
  expression: RegExp;
  includeMatchers: PathMatcher[];
};

type PathMatcher = (value: string) => boolean;

const builtinDetectors: Record<SupportedLanguage, RegexDetector> = {
  rust: detector(
    "builtin:rust",
    "rust",
    ["**/*.rs"],
    String.raw`#\s*\[\s*(?:(?:[A-Za-z_]\w*)::)*test(?:\s*\([^]*?\))?\s*\]`
  ),
  typescript: detector(
    "builtin:typescript",
    "typescript",
    ["**/*.cts", "**/*.mts", "**/*.ts", "**/*.tsx"],
    String.raw`(?:^|[^\w$.])((?:it|test)(?:\.(?:concurrent|each|fail|failing|fails|fixme|for|only|runIf|sequential|skip|skipIf|todo))*\s*(?:<[^>\n]+>)?\s*\()`,
    1
  ),
  javascript: detector(
    "builtin:javascript",
    "javascript",
    ["**/*.cjs", "**/*.js", "**/*.jsx", "**/*.mjs"],
    String.raw`(?:^|[^\w$.])((?:it|test)(?:\.(?:concurrent|each|fail|failing|fails|fixme|for|only|runIf|sequential|skip|skipIf|todo))*\s*\()`,
    1
  ),
  python: detector(
    "builtin:python",
    "python",
    ["**/*.py"],
    String.raw`^[ \t]*(?:async\s+)?def\s+test_[A-Za-z0-9_]*\s*\(`
  ),
  go: detector(
    "builtin:go",
    "go",
    ["**/*.go"],
    String.raw`^func\s+(?:Test|Benchmark|Fuzz)[A-Z0-9_][A-Za-z0-9_]*\s*\(`
  ),
  java: detector(
    "builtin:java",
    "java",
    ["**/*.java"],
    String.raw`@(?:Test|ParameterizedTest|RepeatedTest|TestFactory)\b`
  ),
  csharp: detector(
    "builtin:csharp",
    "csharp",
    ["**/*.cs"],
    String.raw`\[(?:Fact|Theory|Test|TestCase|TestMethod)(?:Attribute)?(?:\([^]*?\))?\]`
  )
};

export async function collectRegexTestEntries(
  options: CollectRegexTestEntriesOptions
): Promise<TestEntryInventory> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const loaded = await loadRegexCollectorConfig(
    workspaceRoot,
    options.configPath,
    options.config
  );
  if (loaded.config === null) {
    return emptyInventory(loaded.diagnostics);
  }

  const diagnostics = [...loaded.diagnostics];
  const detectors = compileDetectors(loaded.config);
  const searchGlobs = loaded.config.includeGlobs.length > 0
    ? loaded.config.includeGlobs
    : [...new Set(detectors.flatMap((entry) => entry.includeGlobs))].sort();
  const relativePaths = searchGlobs.length === 0
    ? []
    : await fg(searchGlobs, {
        cwd: workspaceRoot,
        dot: true,
        followSymbolicLinks: false,
        ignore: loaded.config.excludeGlobs,
        onlyFiles: true,
        unique: true
      });

  const entries: TestEntry[] = [];
  const markers: TestEntryMarker[] = [];
  for (const relativePath of relativePaths.sort()) {
    const normalizedPath = relativePath.replaceAll("\\", "/");
    let text: string;
    try {
      text = await fs.readFile(path.join(workspaceRoot, normalizedPath), "utf8");
    } catch (error) {
      diagnostics.push(createDiagnostic({
        category: "discovery",
        code: "discovery.source-read-failed",
        message: `${normalizedPath} could not be read: ${errorMessage(error)}`,
        path: normalizedPath,
        severity: "error"
      }));
      continue;
    }

    const fileDetectors = detectors.filter((entry) =>
      matchesAny(normalizedPath, entry.includeMatchers)
      && !matchesAny(normalizedPath, entry.excludeMatchers)
    );
    const detected = detectTestEntries(normalizedPath, text, fileDetectors);
    diagnostics.push(...detected.diagnostics);
    entries.push(...detected.entries);

    const collectedMarkers = collectSourceMarkers(text, normalizedPath);
    diagnostics.push(...collectedMarkers.diagnostics);
    markers.push(...attachMarkersToEntries(
      text,
      collectedMarkers.markers,
      detected.entries
    ));
  }

  return {
    diagnostics: sortUniqueDiagnostics(diagnostics),
    entries: entries.sort(compareEntries),
    markers: markers.sort(compareMarkers),
    schemaVersion: testEntryInventorySchemaVersion
  };
}

export function detectTestEntries(
  relativePath: string,
  text: string,
  detectors: readonly CompiledDetector[]
): { diagnostics: TestEvidenceDiagnostic[]; entries: TestEntry[] } {
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const lineOffsets = collectLineOffsets(text);
  const entriesByOffset = new Map<number, TestEntry>();
  const failedDetectors = new Set<string>();

  for (const detector of detectors) {
    detector.expression.lastIndex = 0;
    for (const match of text.matchAll(detector.expression)) {
      const targetGroup = detector.offsetGroup ?? 0;
      const captured = match[targetGroup];
      const targetRange = match.indices?.[targetGroup];
      if (
        captured === undefined
        || captured.length === 0
        || targetRange === undefined
      ) {
        if (!failedDetectors.has(detector.id)) {
          failedDetectors.add(detector.id);
          diagnostics.push(createDiagnostic({
            category: "discovery",
            code: "discovery.detector-match-invalid",
            detectorId: detector.id,
            message: `regex detector ${detector.id} produced an empty or missing target match`,
            path: relativePath,
            severity: "error"
          }));
        }
        continue;
      }
      const offset = targetRange[0];
      const location = locateOffset(offset, lineOffsets);
      const existing = entriesByOffset.get(offset);
      if (existing === undefined) {
        entriesByOffset.set(offset, {
          column: location.column,
          detectorIds: [detector.id],
          id: `${relativePath}#${offset}`,
          language: detector.language,
          line: location.line,
          offset,
          path: relativePath
        });
      } else if (!existing.detectorIds.includes(detector.id)) {
        existing.detectorIds.push(detector.id);
        existing.detectorIds.sort();
      }
    }
  }
  return {
    diagnostics,
    entries: [...entriesByOffset.values()].sort(compareEntries)
  };
}

function compileDetectors(config: RegexCollectorConfig): CompiledDetector[] {
  return [
    ...config.builtinDetectors.map((language) => builtinDetectors[language]),
    ...config.patterns
  ].map((entry) => ({
    ...entry,
    excludeMatchers: compileGlobs(entry.excludeGlobs),
    expression: new RegExp(entry.pattern, ensureRegexMatchFlags(entry.flags)),
    includeMatchers: compileGlobs(entry.includeGlobs)
  }));
}

function detector(
  id: string,
  language: SupportedLanguage,
  includeGlobs: string[],
  pattern: string,
  offsetGroup?: number
): RegexDetector {
  return {
    excludeGlobs: [],
    flags: "mu",
    id,
    includeGlobs,
    language,
    offsetGroup,
    pattern
  };
}

function attachMarkersToEntries(
  text: string,
  markers: readonly TestEntryMarker[],
  entries: readonly TestEntry[]
): TestEntryMarker[] {
  const lines = text.split(/\r?\n/u);
  return markers.map((marker) => {
    const entry = entries.find((candidate) =>
      candidate.offset > marker.offset
      && hasAttachableGap(lines, marker.line, candidate.line, candidate.language)
    );
    return { ...marker, targetEntryId: entry?.id ?? null };
  });
}

function hasAttachableGap(
  lines: readonly string[],
  markerLine: number,
  entryLine: number,
  language: string
): boolean {
  for (let lineNumber = markerLine + 1; lineNumber < entryLine; lineNumber += 1) {
    const line = (lines[lineNumber - 1] ?? "").trim();
    if (
      line.length > 0
      && !/^(?:\/\/|#|--|;|\/\*|\*|\*\/|<!--|-->)/u.test(line)
      && !isLanguageAttachmentLine(line, language)
    ) {
      return false;
    }
  }
  return true;
}

function isLanguageAttachmentLine(line: string, language: string): boolean {
  if (language === "python" || language === "java") {
    return line.startsWith("@");
  }
  return language === "csharp" && line.startsWith("[");
}

function compileGlobs(patterns: readonly string[]): PathMatcher[] {
  return patterns.map((pattern) => picomatch(pattern, { dot: true }));
}

function matchesAny(relativePath: string, matchers: readonly PathMatcher[]): boolean {
  return matchers.some((matcher) => matcher(relativePath));
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

function emptyInventory(
  diagnostics: readonly TestEvidenceDiagnostic[]
): TestEntryInventory {
  return {
    diagnostics: sortUniqueDiagnostics(diagnostics),
    entries: [],
    markers: [],
    schemaVersion: testEntryInventorySchemaVersion
  };
}

function compareEntries(left: TestEntry, right: TestEntry): number {
  return compareText(left.path, right.path) || left.offset - right.offset;
}

function compareMarkers(left: TestEntryMarker, right: TestEntryMarker): number {
  return compareText(left.path, right.path) || left.offset - right.offset;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
