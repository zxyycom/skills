import fs from "node:fs/promises";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { RegisteredTest, TestCommand } from "./snapshot-types.ts";
import { runSnapshotCommand, snapshotFailure } from "./snapshot-files.ts";

function attribute(
  record: Record<string, unknown>,
  name: string
): string | null {
  const value = record[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function values(
  record: Record<string, unknown>,
  name: string
): readonly Record<string, unknown>[] {
  const value = record[name];
  if (value === undefined) return [];
  const candidates = Array.isArray(value) ? value : [value];
  if (
    candidates.some(
      (candidate) =>
        typeof candidate !== "object" ||
        candidate === null ||
        Array.isArray(candidate)
    )
  ) {
    throw snapshotFailure(`JUnit ${name} elements must be objects`);
  }
  return candidates as readonly Record<string, unknown>[];
}

function hasElements(record: Record<string, unknown>, name: string): boolean {
  const value = record[name];
  return value !== undefined && (!Array.isArray(value) || value.length > 0);
}

function assertZeroFailures(record: Record<string, unknown>): void {
  for (const name of ["failures", "errors"]) {
    const value = attribute(record, name);
    if (value !== null && value !== "0") {
      throw snapshotFailure(`JUnit report must declare zero ${name}`);
    }
  }
}

function parseJUnitDocument(report: string): Record<string, unknown> {
  if (/<!DOCTYPE/iu.test(report)) {
    throw snapshotFailure(
      "JUnit report must not contain a DTD or external entity declaration"
    );
  }
  const validation = XMLValidator.validate(report);
  if (validation !== true) {
    throw snapshotFailure(
      `JUnit report is not valid XML: ${validation.err.msg}`
    );
  }
  let document: unknown;
  try {
    document = new XMLParser({
      attributeNamePrefix: "",
      ignoreAttributes: false,
      isArray: (name) =>
        name === "testsuite" ||
        name === "testcase" ||
        name === "skipped" ||
        name === "failure" ||
        name === "error",
      parseAttributeValue: false,
      parseTagValue: false,
      processEntities: false
    }).parse(report);
  } catch (error) {
    throw snapshotFailure(
      `JUnit report could not be parsed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (
    typeof document !== "object" ||
    document === null ||
    Array.isArray(document)
  ) {
    throw snapshotFailure("JUnit report must have an object document root");
  }
  return document as Record<string, unknown>;
}

function collectSuiteTests(
  suite: Record<string, unknown>,
  expectedFiles: ReadonlySet<string>,
  tests: RegisteredTest[]
): void {
  const declared = attribute(suite, "tests");
  if (declared === null || !/^\d+$/u.test(declared)) {
    throw snapshotFailure(
      "JUnit testsuite must declare a non-negative tests count"
    );
  }
  assertZeroFailures(suite);
  if (hasElements(suite, "failure") || hasElements(suite, "error")) {
    throw snapshotFailure(
      "JUnit registration report must not contain failures or errors"
    );
  }
  const cases = values(suite, "testcase");
  if (Number(declared) !== cases.length) {
    throw snapshotFailure(
      "JUnit testsuite tests count does not match testcase elements"
    );
  }
  for (const testcase of cases) {
    if (hasElements(testcase, "failure") || hasElements(testcase, "error")) {
      throw snapshotFailure(
        "JUnit registration report must not contain failures or errors"
      );
    }
    const file = attribute(testcase, "file");
    const name = attribute(testcase, "name");
    if (file === null || name === null || !hasElements(testcase, "skipped")) {
      throw snapshotFailure(
        "each JUnit testcase must declare file, name, and skipped status"
      );
    }
    const normalizedFile = file.replaceAll("\\", "/");
    if (!expectedFiles.has(normalizedFile)) {
      throw snapshotFailure(
        `JUnit testcase references an unexpected file: ${normalizedFile}`
      );
    }
    tests.push({
      file: normalizedFile,
      line: attribute(testcase, "line"),
      name
    });
  }
  for (const child of values(suite, "testsuite")) {
    collectSuiteTests(child, expectedFiles, tests);
  }
}

export function parseSkippedJUnit(
  report: string,
  expectedFiles: ReadonlySet<string>
): readonly RegisteredTest[] {
  const document = parseJUnitDocument(report);
  const root = document.testsuites;
  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    throw snapshotFailure("JUnit report must have a testsuites root");
  }
  const rootRecord = root as Record<string, unknown>;
  const rootTests = attribute(rootRecord, "tests");
  if (rootTests === null || !/^\d+$/u.test(rootTests)) {
    throw snapshotFailure(
      "JUnit testsuites must declare a non-negative tests count"
    );
  }
  assertZeroFailures(rootRecord);
  const tests: RegisteredTest[] = [];
  for (const suite of values(rootRecord, "testsuite")) {
    collectSuiteTests(suite, expectedFiles, tests);
  }
  if (Number(rootTests) !== tests.length) {
    throw snapshotFailure(
      `JUnit report tests count ${rootTests} does not match ${tests.length} testcase elements`
    );
  }
  if (tests.length === 0) {
    throw snapshotFailure("JUnit registration report contains no testcases");
  }
  const identities = new Set<string>();
  for (const test of tests) {
    const identity = `${test.file}\0${test.name}`;
    if (identities.has(identity)) {
      throw snapshotFailure(
        `JUnit registration report repeats testcase ${test.file} > ${test.name}`
      );
    }
    identities.add(identity);
  }
  return tests;
}

export async function collectRegistration(
  workspaceRoot: string,
  command: TestCommand,
  reportPath: string,
  definitions: ReadonlyMap<string, readonly string[]>
): Promise<readonly RegisteredTest[]> {
  const result = await runSnapshotCommand(
    process.execPath.includes("bun") ? process.execPath : "bun",
    [
      "test",
      ...command.files,
      "--pass-with-no-tests",
      "--test-name-pattern=a^",
      "--reporter=junit",
      `--reporter-outfile=${reportPath}`
    ],
    workspaceRoot
  );
  if (result.exitCode !== 0) {
    throw snapshotFailure(
      `Bun registration failed for ${command.scriptName} (${command.original}): ${result.output.trim()}`
    );
  }
  let report: string;
  try {
    report = await fs.readFile(reportPath, "utf8");
  } catch (error) {
    throw snapshotFailure(
      `Bun registration did not publish a JUnit report for ${command.scriptName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const registered = parseSkippedJUnit(
    report,
    new Set(command.files.map((file) => file.slice(2).replaceAll("\\", "/")))
  );
  return registered.map((test) => {
    const candidates = definitions.get(test.name) ?? [];
    if (candidates.length !== 1) {
      throw snapshotFailure(
        `registered testcase ${test.file} > ${test.name} must map to exactly one static test declaration in ${command.scriptName}; found ${candidates.length}`
      );
    }
    return { ...test, file: candidates[0] ?? test.file };
  });
}
