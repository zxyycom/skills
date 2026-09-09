import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { GateCommandRunResult } from "./command-runner.ts";
import type { ReleaseTestBatchGroup } from "./release-test-batch.ts";

export type ParsedReleaseTestSuite = Readonly<{
  failed: boolean;
  file: string;
}>;

function stringAttribute(
  value: Readonly<Record<string, unknown>>,
  name: string
): string | null {
  const attribute = value[name];
  return typeof attribute === "string" || typeof attribute === "number"
    ? String(attribute)
    : null;
}

function records(
  value: unknown,
  field: string
): readonly Readonly<Record<string, unknown>>[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }
  const child = (value as Readonly<Record<string, unknown>>)[field];
  const candidates = Array.isArray(child)
    ? child
    : child === undefined
      ? []
      : [child];
  return candidates.filter(
    (entry): entry is Readonly<Record<string, unknown>> =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry)
  );
}

function parseCount(
  suite: Readonly<Record<string, unknown>>,
  name: string,
  optional = false
): number {
  const raw = stringAttribute(suite, name);
  if (raw === null && optional) return 0;
  if (raw === null || !/^\d+$/u.test(raw)) {
    throw new Error(`JUnit suite must declare a non-negative ${name} count`);
  }
  return Number(raw);
}

export function parseReleaseTestBatchReport(
  report: string,
  expectedFiles: readonly string[]
): ReadonlyMap<string, ParsedReleaseTestSuite> {
  const validation = XMLValidator.validate(report);
  if (validation !== true) throw new Error("Bun JUnit report is not valid XML");
  const parsed: unknown = new XMLParser({
    attributeNamePrefix: "",
    ignoreAttributes: false,
    parseAttributeValue: false
  }).parse(report);
  const roots = records(parsed, "testsuites");
  if (roots.length !== 1) {
    throw new Error("Bun JUnit report must have one testsuites root");
  }
  const suites = records(roots[0], "testsuite");
  const expected = new Set(expectedFiles.map((file) => file.slice(2)));
  const byFile = new Map<string, ParsedReleaseTestSuite>();
  for (const suite of suites) {
    const file = stringAttribute(suite, "file")?.replaceAll("\\", "/");
    if (file === undefined || file === null || !expected.has(file)) {
      throw new Error(
        `Bun JUnit report contains an unexpected suite: ${file ?? "missing file"}`
      );
    }
    if (byFile.has(file)) {
      throw new Error(`Bun JUnit report repeats suite ${file}`);
    }
    const tests = parseCount(suite, "tests");
    const failures = parseCount(suite, "failures", true);
    const errors = parseCount(suite, "errors", true);
    if (failures + errors > tests) {
      throw new Error(`Bun JUnit suite ${file} has inconsistent result counts`);
    }
    byFile.set(file, Object.freeze({ failed: failures + errors > 0, file }));
  }
  if (byFile.size !== expected.size) {
    throw new Error(
      "Bun JUnit report does not cover every requested test container"
    );
  }
  return byFile;
}

export function projectReleaseTestBatchResults(
  groups: readonly ReleaseTestBatchGroup[],
  suites: ReadonlyMap<string, ParsedReleaseTestSuite>,
  output: string
): ReadonlyMap<string, GateCommandRunResult> {
  return new Map(
    groups.map(({ checkId, files }) => {
      const failed = files.some(
        (file) => suites.get(file.slice(2))?.failed !== false
      );
      return [
        checkId,
        Object.freeze({
          exitCode: failed ? 1 : 0,
          output,
          status: "completed" as const
        })
      ];
    })
  );
}
