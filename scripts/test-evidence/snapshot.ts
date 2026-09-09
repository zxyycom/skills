import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";

const projectId = "skills-workspace";
const scopeId = "repository-native-tests-v1";
const astGrepVersion = "0.45.1";
const astGrepFileArgumentByteBudget = 20_000;
const commandOutputByteLimit = 67_108_864;

export type RepositoryTestSource = Readonly<{
  projectId: string;
  revision: string;
  scopeId: string;
}>;

export type RepositoryTestEntity = Readonly<{
  id: string;
  locators: readonly string[];
  name: string;
}>;

export type RepositoryTestSnapshot = Readonly<{
  completeness: "complete";
  entities: readonly RepositoryTestEntity[];
  schemaVersion: 2;
  source: RepositoryTestSource;
}>;

type TestCommand = Readonly<{
  files: readonly string[];
  original: string;
  runner: "bun" | "node";
  scriptName: string;
}>;

type RegisteredTest = Readonly<{
  file: string;
  line: string | null;
  name: string;
}>;

type CommandResult = Readonly<{
  exitCode: number | null;
  output: string;
}>;

type AstGrepMatch = Readonly<{
  sourcePath: string;
  variables: Readonly<Record<string, string>>;
}>;

type SnapshotOptions = Readonly<{
  expectedSource?: RepositoryTestSource;
  outputPath?: string;
  workspaceRoot: string;
}>;

function failure(message: string): Error {
  return new Error(`test-evidence snapshot: ${message}`);
}

function validateExpectedSource(
  expectedSource: RepositoryTestSource | undefined
): void {
  if (expectedSource === undefined) return;
  if (
    expectedSource.projectId !== projectId ||
    expectedSource.scopeId !== scopeId ||
    !/^[a-f0-9]{64}$/u.test(expectedSource.revision)
  ) {
    throw failure("expected source does not match the repository source scope");
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

async function requireRegularProjectFile(
  workspaceRoot: string,
  relativePath: string,
  description: string
): Promise<string> {
  if (
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath.includes("\0")
  ) {
    throw failure(`${description} must be a non-empty relative path`);
  }
  const resolved = path.resolve(workspaceRoot, relativePath);
  if (!isWithin(workspaceRoot, resolved)) {
    throw failure(
      `${description} must remain inside the workspace: ${relativePath}`
    );
  }
  let stat: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    stat = await fs.lstat(resolved);
  } catch (error) {
    throw failure(
      `${description} is unavailable: ${relativePath} (${error instanceof Error ? error.message : String(error)})`
    );
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw failure(`${description} must be a regular file: ${relativePath}`);
  }
  return resolved;
}

function commandTokens(command: string, scriptName: string): readonly string[] {
  if (
    command.trim() !== command ||
    command.length === 0 ||
    /[|;&><`$\\\r\n]/u.test(command)
  ) {
    throw failure(`test script ${scriptName} has an unsupported command shape`);
  }
  const tokens = command.split(" ");
  if (tokens.some((token) => token.length === 0 || /["']/u.test(token))) {
    throw failure(
      `test script ${scriptName} must use unquoted explicit file arguments`
    );
  }
  return tokens;
}

function parseTestSegment(
  segment: string,
  scriptName: string
): Omit<TestCommand, "original" | "scriptName"> {
  const tokens = commandTokens(segment, scriptName);
  const [command, option, ...rest] = tokens;
  const runner =
    command === "bun" && option === "test"
      ? "bun"
      : command === "node" && option === "--test"
        ? "node"
        : null;
  if (runner === null || rest.length === 0) {
    throw failure(
      `test script ${scriptName} must be bun test <relative-file...> or node --test <relative-file...>`
    );
  }
  if (
    rest.some(
      (file) =>
        !file.startsWith("./") ||
        file === "./" ||
        file.includes("*") ||
        file.includes("?") ||
        file.includes("[") ||
        file.includes("]")
    )
  ) {
    throw failure(
      `test script ${scriptName} must name explicit project-relative files`
    );
  }
  return { files: rest, runner };
}

export async function parseRepositoryTestCommands(
  workspaceRoot: string
): Promise<readonly TestCommand[]> {
  const manifestPath = await requireRegularProjectFile(
    workspaceRoot,
    "package.json",
    "package manifest"
  );
  let manifest: unknown;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch (error) {
    throw failure(
      `package manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest) ||
    typeof (manifest as { scripts?: unknown }).scripts !== "object" ||
    (manifest as { scripts?: unknown }).scripts === null ||
    Array.isArray((manifest as { scripts?: unknown }).scripts)
  ) {
    throw failure("package manifest scripts must be an object");
  }
  const scripts = (manifest as { scripts: Record<string, unknown> }).scripts;
  const commands: TestCommand[] = [];
  for (const scriptName of Object.keys(scripts)
    .filter((name) => name.startsWith("test:"))
    .sort()) {
    const original = scripts[scriptName];
    if (typeof original !== "string") {
      throw failure(`test script ${scriptName} must be a string`);
    }
    const segments = original.split("&&").map((segment) => segment.trim());
    if (
      segments.length === 0 ||
      segments.some((segment) => segment.length === 0)
    ) {
      throw failure(`test script ${scriptName} has an unsupported && sequence`);
    }
    for (const segment of segments) {
      const parsed = parseTestSegment(segment, scriptName);
      const uniqueFiles = [...new Set(parsed.files)];
      if (uniqueFiles.length !== parsed.files.length) {
        throw failure(`test script ${scriptName} repeats a file target`);
      }
      for (const file of parsed.files) {
        await requireRegularProjectFile(
          workspaceRoot,
          file,
          `test script ${scriptName} target`
        );
      }
      commands.push({ ...parsed, original, scriptName });
    }
  }
  if (commands.length === 0) {
    throw failure("package manifest defines no test:* scripts");
  }
  return commands;
}

function posixRelative(workspaceRoot: string, filePath: string): string {
  const relative = path.relative(workspaceRoot, filePath);
  if (!isWithin(workspaceRoot, filePath) || relative.length === 0) {
    throw failure(`could not create a project-relative path for ${filePath}`);
  }
  return relative.split(path.sep).join("/");
}

async function runCommand(
  executable: string,
  args: readonly string[],
  workspaceRoot: string
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: workspaceRoot,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let output = "";
    let outputBytes = 0;
    let outputExceededLimit = false;
    const appendOutput = (chunk: string): void => {
      if (outputExceededLimit) return;
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > commandOutputByteLimit) {
        outputExceededLimit = true;
        child.kill();
        return;
      }
      output += chunk;
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", appendOutput);
    child.stderr.on("data", appendOutput);
    child.once("error", reject);
    child.once("close", (exitCode) => {
      if (outputExceededLimit) {
        reject(failure("subprocess output exceeded its 64 MiB safety limit"));
        return;
      }
      resolve({ exitCode, output });
    });
  });
}

async function resolveAstGrep(workspaceRoot: string): Promise<string> {
  const executable = path.join(
    workspaceRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "ast-grep.cmd" : "ast-grep"
  );
  await requireRegularProjectFile(
    workspaceRoot,
    path.relative(workspaceRoot, executable),
    "project-local ast-grep executable"
  );
  const version = await runCommand(executable, ["--version"], workspaceRoot);
  if (
    version.exitCode !== 0 ||
    version.output.trim() !== `ast-grep ${astGrepVersion}`
  ) {
    throw failure(
      `project-local ast-grep must be ${astGrepVersion}; received ${version.output.trim() || `exit ${version.exitCode}`}`
    );
  }
  return executable;
}

function importSpecifiers(source: string): readonly string[] {
  const specifiers: string[] = [];
  const expression =
    /(?:import\s+(?:[^"']+?\s+from\s+)?|import\s*\()\s*["']([^"']+)["']/gu;
  for (const match of source.matchAll(expression)) {
    const specifier = match[1];
    if (specifier !== undefined) specifiers.push(specifier);
  }
  return specifiers;
}

function resolveRelativeImport(
  sourcePath: string,
  specifier: string
): readonly string[] {
  if (!specifier.startsWith(".")) return [];
  const base = path.resolve(path.dirname(sourcePath), specifier);
  if (path.extname(base) !== "") return [base];
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    path.join(base, "index.ts"),
    path.join(base, "index.js")
  ];
}

async function existingRegularFile(filePath: string): Promise<string | null> {
  try {
    const stat = await fs.lstat(filePath);
    return stat.isFile() && !stat.isSymbolicLink() ? filePath : null;
  } catch {
    return null;
  }
}

async function moduleClosure(
  workspaceRoot: string,
  entryFiles: readonly string[]
): Promise<readonly string[]> {
  const pending = [...entryFiles];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (candidate === undefined || seen.has(candidate)) continue;
    if (!isWithin(workspaceRoot, candidate)) {
      throw failure(`test import escapes the workspace: ${candidate}`);
    }
    const filePath = await existingRegularFile(candidate);
    if (filePath === null) {
      throw failure(
        `test import is not a regular file: ${posixRelative(workspaceRoot, candidate)}`
      );
    }
    seen.add(filePath);
    const source = await fs.readFile(filePath, "utf8");
    for (const specifier of importSpecifiers(source)) {
      for (const resolved of resolveRelativeImport(filePath, specifier)) {
        const existing = await existingRegularFile(resolved);
        if (existing !== null) {
          pending.push(existing);
          break;
        }
      }
    }
  }
  return [...seen].sort();
}

function astGrepFileBatches(
  workspaceRoot: string,
  filePaths: readonly string[]
): readonly (readonly string[])[] {
  const relativePaths = [
    ...new Set(
      filePaths.map((filePath) => posixRelative(workspaceRoot, filePath))
    )
  ].sort();
  const batches: string[][] = [];
  let batch: string[] = [];
  let argumentBytes = 0;
  for (const relativePath of relativePaths) {
    const nextBytes = Buffer.byteLength(relativePath) + 1;
    if (
      batch.length > 0 &&
      argumentBytes + nextBytes > astGrepFileArgumentByteBudget
    ) {
      batches.push(batch);
      batch = [];
      argumentBytes = 0;
    }
    batch.push(relativePath);
    argumentBytes += nextBytes;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

function parseAstGrepMatches(
  value: unknown,
  workspaceRoot: string,
  expectedSourcePaths: ReadonlySet<string>
): readonly AstGrepMatch[] {
  if (!Array.isArray(value)) {
    throw failure("ast-grep result is not an array");
  }
  return value.map((candidate) => {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      throw failure("ast-grep result contains a non-object match");
    }
    const match = candidate as Record<string, unknown>;
    const file = match.file;
    if (typeof file !== "string" || file.length === 0 || file.includes("\0")) {
      throw failure("ast-grep match does not identify a source file");
    }
    const resolvedFile = path.resolve(workspaceRoot, file);
    const sourcePath = posixRelative(workspaceRoot, resolvedFile);
    if (!expectedSourcePaths.has(sourcePath)) {
      throw failure(`ast-grep returned an unexpected source file: ${file}`);
    }
    const variables: Record<string, string> = {};
    const metaVariables = match.metaVariables;
    if (metaVariables === undefined) {
      return { sourcePath, variables };
    }
    if (
      typeof metaVariables !== "object" ||
      metaVariables === null ||
      Array.isArray(metaVariables)
    ) {
      throw failure(`ast-grep match has invalid meta variables: ${sourcePath}`);
    }
    const single = (metaVariables as Record<string, unknown>).single;
    if (single === undefined) {
      return { sourcePath, variables };
    }
    if (
      typeof single !== "object" ||
      single === null ||
      Array.isArray(single)
    ) {
      throw failure(
        `ast-grep match has invalid single variables: ${sourcePath}`
      );
    }
    for (const [name, rawVariable] of Object.entries(single)) {
      if (
        typeof rawVariable !== "object" ||
        rawVariable === null ||
        Array.isArray(rawVariable) ||
        typeof (rawVariable as Record<string, unknown>).text !== "string"
      ) {
        throw failure(
          `ast-grep match has an invalid ${name} variable: ${sourcePath}`
        );
      }
      variables[name] = (rawVariable as { text: string }).text;
    }
    return { sourcePath, variables };
  });
}

async function astGrepJson(
  executable: string,
  workspaceRoot: string,
  pattern: string,
  filePaths: readonly string[]
): Promise<readonly AstGrepMatch[]> {
  const expectedSourcePaths = new Set(
    filePaths.map((filePath) => posixRelative(workspaceRoot, filePath))
  );
  const matches: AstGrepMatch[] = [];
  const batches = astGrepFileBatches(workspaceRoot, filePaths);
  if (batches.length === 0) {
    throw failure("ast-grep batch requires at least one source file");
  }
  for (const batch of batches) {
    const result = await runCommand(
      executable,
      ["run", "--pattern", pattern, "--lang", "ts", ...batch, "--json=compact"],
      workspaceRoot
    );
    if (result.exitCode !== 0 && result.exitCode !== 1) {
      throw failure(
        `ast-grep failed for a ${batch.length}-file batch: ${result.output.trim()}`
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.output);
    } catch (error) {
      throw failure(
        `ast-grep returned invalid JSON for a ${batch.length}-file batch: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    matches.push(
      ...parseAstGrepMatches(parsed, workspaceRoot, expectedSourcePaths)
    );
  }
  return matches;
}

async function assertSupportedRegistrationShape(
  workspaceRoot: string,
  commands: readonly TestCommand[]
): Promise<void> {
  const executable = await resolveAstGrep(workspaceRoot);
  const entries = commands.flatMap(({ files }) =>
    files.map((file) => path.resolve(workspaceRoot, file))
  );
  const closure = await moduleClosure(workspaceRoot, [...new Set(entries)]);
  for (const pattern of [
    "t.test($$$)",
    "it($$$)",
    "suite($$$)",
    "test($$$, () => { $$$ test($$$) $$$ })",
    "test($$$, async () => { $$$ test($$$) $$$ })"
  ]) {
    const firstMatch = (
      await astGrepJson(executable, workspaceRoot, pattern, closure)
    )[0];
    if (firstMatch !== undefined) {
      throw failure(
        `unsupported registration shape ${pattern} in ${firstMatch.sourcePath}`
      );
    }
  }
  for (const filePath of closure) {
    const source = await fs.readFile(filePath, "utf8");
    if (
      /from\s*["'](?:node|bun):test["']/u.test(source) &&
      /\b(?:test|describe)\s+as\s+/u.test(source)
    ) {
      throw failure(
        `unsupported aliased test API import in ${posixRelative(workspaceRoot, filePath)}`
      );
    }
  }
}

function commandKey(command: TestCommand): string {
  return `${command.scriptName}\0${command.original}\0${command.files.join("\0")}`;
}

async function registrationClosures(
  workspaceRoot: string,
  commands: readonly TestCommand[]
): Promise<ReadonlyMap<string, readonly string[]>> {
  const byCommand = new Map<string, readonly string[]>();
  for (const command of commands) {
    byCommand.set(
      commandKey(command),
      await moduleClosure(
        workspaceRoot,
        command.files.map((file) => path.resolve(workspaceRoot, file))
      )
    );
  }
  return byCommand;
}

function testNameFromAstMatch(match: AstGrepMatch): string | null {
  const literal = match.variables.NAME;
  if (literal === undefined || !literal.startsWith('"')) return null;
  try {
    const name: unknown = JSON.parse(literal);
    return typeof name === "string" && name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

function parameterizedTestNames(match: AstGrepMatch): readonly string[] {
  const variable = match.variables.VALUE;
  const values = match.variables.VALUES;
  const template = match.variables.NAME;
  if (
    typeof variable !== "string" ||
    typeof values !== "string" ||
    typeof template !== "string" ||
    !/^[$A-Z_a-z][$\w]*$/u.test(variable) ||
    template.length < 2 ||
    !template.startsWith("`") ||
    !template.endsWith("`")
  ) {
    return [];
  }
  let matrix: unknown;
  try {
    matrix = JSON.parse(values);
  } catch {
    return [];
  }
  if (
    !Array.isArray(matrix) ||
    !matrix.every(
      (value) =>
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    )
  ) {
    return [];
  }
  const body = template.slice(1, -1);
  const marker = `\${${variable}}`;
  if (body.includes("\\") || body.split(marker).length !== 2) return [];
  return matrix.map((value) => body.replace(marker, String(value)));
}

async function registrationDefinitions(
  workspaceRoot: string,
  closures: ReadonlyMap<string, readonly string[]>
): Promise<ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>> {
  const executable = await resolveAstGrep(workspaceRoot);
  const files = new Set<string>();
  for (const closure of closures.values()) {
    for (const file of closure) files.add(file);
  }
  const definitionsByName = new Map<string, Set<string>>();
  const filePaths = [...files].sort();
  const addDefinitions = (
    sourcePath: string,
    names: readonly string[]
  ): void => {
    for (const name of names) {
      const paths = definitionsByName.get(name) ?? new Set<string>();
      paths.add(sourcePath);
      definitionsByName.set(name, paths);
    }
  };
  const staticMatches = await astGrepJson(
    executable,
    workspaceRoot,
    "test($NAME, $$$)",
    filePaths
  );
  for (const match of staticMatches) {
    const name = testNameFromAstMatch(match);
    if (name !== null) addDefinitions(match.sourcePath, [name]);
  }
  const parameterizedMatches = await astGrepJson(
    executable,
    workspaceRoot,
    "for (const $VALUE of $VALUES) { $$$ test($NAME, $$$) $$$ }",
    filePaths
  );
  for (const match of parameterizedMatches) {
    addDefinitions(match.sourcePath, parameterizedTestNames(match));
  }
  const scoped = new Map<string, ReadonlyMap<string, readonly string[]>>();
  for (const [key, closure] of closures) {
    const allowed = new Set(
      closure.map((file) => posixRelative(workspaceRoot, file))
    );
    const byName = new Map<string, readonly string[]>();
    for (const [name, candidates] of definitionsByName) {
      const paths = [...candidates].filter((candidate) =>
        allowed.has(candidate)
      );
      if (paths.length > 0) byName.set(name, paths);
    }
    scoped.set(key, byName);
  }
  return scoped;
}

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
    throw failure(`JUnit ${name} elements must be objects`);
  }
  return candidates as readonly Record<string, unknown>[];
}

function hasElements(record: Record<string, unknown>, name: string): boolean {
  const value = record[name];
  return value !== undefined && (!Array.isArray(value) || value.length > 0);
}

export function parseSkippedJUnit(
  report: string,
  expectedFiles: ReadonlySet<string>
): readonly RegisteredTest[] {
  if (/<!DOCTYPE/iu.test(report)) {
    throw failure(
      "JUnit report must not contain a DTD or external entity declaration"
    );
  }
  const validation = XMLValidator.validate(report);
  if (validation !== true) {
    throw failure(`JUnit report is not valid XML: ${validation.err.msg}`);
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
    throw failure(
      `JUnit report could not be parsed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (
    typeof document !== "object" ||
    document === null ||
    Array.isArray(document)
  ) {
    throw failure("JUnit report must have an object document root");
  }
  const root = (document as Record<string, unknown>).testsuites;
  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    throw failure("JUnit report must have a testsuites root");
  }
  const rootRecord = root as Record<string, unknown>;
  const rootTests = attribute(rootRecord, "tests");
  if (rootTests === null || !/^\d+$/u.test(rootTests)) {
    throw failure("JUnit testsuites must declare a non-negative tests count");
  }
  for (const name of ["failures", "errors"]) {
    const value = attribute(rootRecord, name);
    if (value !== null && value !== "0") {
      throw failure(`JUnit report must declare zero ${name}`);
    }
  }
  const tests: RegisteredTest[] = [];
  const visitSuite = (suite: Record<string, unknown>): void => {
    const declared = attribute(suite, "tests");
    if (declared === null || !/^\d+$/u.test(declared)) {
      throw failure("JUnit testsuite must declare a non-negative tests count");
    }
    for (const name of ["failures", "errors"]) {
      const value = attribute(suite, name);
      if (value !== null && value !== "0") {
        throw failure(`JUnit report must declare zero ${name}`);
      }
    }
    if (hasElements(suite, "failure") || hasElements(suite, "error")) {
      throw failure(
        "JUnit registration report must not contain failures or errors"
      );
    }
    const cases = values(suite, "testcase");
    if (Number(declared) !== cases.length) {
      throw failure(
        "JUnit testsuite tests count does not match testcase elements"
      );
    }
    for (const testcase of cases) {
      if (hasElements(testcase, "failure") || hasElements(testcase, "error")) {
        throw failure(
          "JUnit registration report must not contain failures or errors"
        );
      }
      const file = attribute(testcase, "file");
      const name = attribute(testcase, "name");
      if (file === null || name === null || !hasElements(testcase, "skipped")) {
        throw failure(
          "each JUnit testcase must declare file, name, and skipped status"
        );
      }
      const normalizedFile = file.replaceAll("\\", "/");
      if (!expectedFiles.has(normalizedFile)) {
        throw failure(
          `JUnit testcase references an unexpected file: ${normalizedFile}`
        );
      }
      tests.push({
        file: normalizedFile,
        line: attribute(testcase, "line"),
        name
      });
    }
    for (const child of values(suite, "testsuite")) visitSuite(child);
  };
  for (const suite of values(rootRecord, "testsuite")) visitSuite(suite);
  if (Number(rootTests) !== tests.length) {
    throw failure(
      `JUnit report tests count ${rootTests} does not match ${tests.length} testcase elements`
    );
  }
  if (tests.length === 0) {
    throw failure("JUnit registration report contains no testcases");
  }
  const identities = new Set<string>();
  for (const test of tests) {
    const identity = `${test.file}\0${test.name}`;
    if (identities.has(identity)) {
      throw failure(
        `JUnit registration report repeats testcase ${test.file} > ${test.name}`
      );
    }
    identities.add(identity);
  }
  return tests;
}

async function collectRegistration(
  workspaceRoot: string,
  command: TestCommand,
  reportPath: string,
  definitions: ReadonlyMap<string, readonly string[]>
): Promise<readonly RegisteredTest[]> {
  const result = await runCommand(
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
    throw failure(
      `Bun registration failed for ${command.scriptName} (${command.original}): ${result.output.trim()}`
    );
  }
  let report: string;
  try {
    report = await fs.readFile(reportPath, "utf8");
  } catch (error) {
    throw failure(
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
      throw failure(
        `registered testcase ${test.file} > ${test.name} must map to exactly one static test declaration in ${command.scriptName}; found ${candidates.length}`
      );
    }
    return { ...test, file: candidates[0] ?? test.file };
  });
}

async function trackedSourceFiles(
  workspaceRoot: string,
  excludedSourcePaths: ReadonlySet<string>
): Promise<readonly string[]> {
  const result = await runCommand(
    "git",
    [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "scripts",
      "tools",
      "skills"
    ],
    workspaceRoot
  );
  if (result.exitCode !== 0) {
    throw failure(
      `git ls-files failed while fingerprinting source inputs: ${result.output.trim()}`
    );
  }
  return result.output
    .split("\0")
    .filter((entry) => entry.length > 0)
    .filter((entry) => !excludedSourcePaths.has(entry.replaceAll("\\", "/")))
    .filter((entry) => /\.(?:[cm]?[jt]s|json)$/u.test(entry))
    .sort();
}

function outputSourcePath(
  workspaceRoot: string,
  outputPath: string | undefined
): string | null {
  if (outputPath === undefined) return null;
  const resolved = path.resolve(workspaceRoot, outputPath);
  return isWithin(workspaceRoot, resolved)
    ? posixRelative(workspaceRoot, resolved)
    : null;
}

async function sourceFingerprint(
  workspaceRoot: string,
  excludedSourcePaths: ReadonlySet<string> = new Set()
): Promise<RepositoryTestSource> {
  const fixedInputs = [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json"
  ];
  const sources = [
    ...new Set([
      ...fixedInputs,
      ...(await trackedSourceFiles(workspaceRoot, excludedSourcePaths))
    ])
  ].sort();
  const digest = createHash("sha256");
  for (const relativePath of sources) {
    digest.update(relativePath.replaceAll("\\", "/"));
    digest.update("\0");
    try {
      const filePath = await requireRegularProjectFile(
        workspaceRoot,
        relativePath,
        "source fingerprint input"
      );
      digest.update(await fs.readFile(filePath));
    } catch (error) {
      if (fixedInputs.includes(relativePath)) throw error;
      const candidate = path.resolve(workspaceRoot, relativePath);
      try {
        await fs.lstat(candidate);
      } catch {
        digest.update("<missing-from-worktree>");
        digest.update("\0");
        continue;
      }
      throw error;
    }
    digest.update("\0");
  }
  const astGrep = await resolveAstGrep(workspaceRoot);
  const astVersion = await runCommand(astGrep, ["--version"], workspaceRoot);
  const bunVersion = await runCommand("bun", ["--version"], workspaceRoot);
  const nodeVersion = await runCommand("node", ["--version"], workspaceRoot);
  if (
    astVersion.exitCode !== 0 ||
    bunVersion.exitCode !== 0 ||
    nodeVersion.exitCode !== 0
  ) {
    throw failure(
      "could not fingerprint required Bun, Node, and ast-grep versions"
    );
  }
  digest.update(
    JSON.stringify({
      arch: process.arch,
      astGrep: astVersion.output.trim(),
      bun: bunVersion.output.trim(),
      node: nodeVersion.output.trim(),
      platform: process.platform
    })
  );
  return { projectId, revision: digest.digest("hex"), scopeId };
}

export async function repositoryTestEvidenceSource(
  workspaceRoot: string,
  options: Readonly<{ outputPath?: string }> = {}
): Promise<RepositoryTestSource> {
  const root = path.resolve(workspaceRoot);
  const output = outputSourcePath(root, options.outputPath);
  return await sourceFingerprint(
    root,
    output === null ? new Set<string>() : new Set<string>([output])
  );
}

function entityId(file: string, name: string): string {
  return `test:${createHash("sha256")
    .update(JSON.stringify([file, name]))
    .digest("hex")}`;
}

function selector(command: TestCommand): string {
  return command.runner === "bun"
    ? `bun test ${command.files.join(" ")}`
    : `node --test ${command.files.join(" ")}`;
}

function legacyBunSelectors(
  command: TestCommand,
  name: string
): readonly string[] {
  if (command.runner !== "bun") return [];
  const pattern = `^${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`;
  return command.files.map(
    (file) => `bun test --test-name-pattern="${pattern}" ${file}`
  );
}

export async function createRepositoryTestEvidenceSnapshot(
  options: SnapshotOptions
): Promise<RepositoryTestSnapshot> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  validateExpectedSource(options.expectedSource);
  const output = outputSourcePath(workspaceRoot, options.outputPath);
  const excludedSourcePaths =
    output === null ? new Set<string>() : new Set<string>([output]);
  const commands = await parseRepositoryTestCommands(workspaceRoot);
  await assertSupportedRegistrationShape(workspaceRoot, commands);
  const closures = await registrationClosures(workspaceRoot, commands);
  const definitions = await registrationDefinitions(workspaceRoot, closures);
  const before =
    options.expectedSource ??
    (await sourceFingerprint(workspaceRoot, excludedSourcePaths));
  const reportDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills-test-evidence-")
  );
  try {
    const entities = new Map<string, { locators: Set<string>; name: string }>();
    for (const [index, command] of commands.entries()) {
      const reportPath = path.join(reportDirectory, `${index}.xml`);
      const tests = await collectRegistration(
        workspaceRoot,
        command,
        reportPath,
        definitions.get(commandKey(command)) ?? new Map()
      );
      for (const test of tests) {
        const id = entityId(test.file, test.name);
        const directLocator = `${test.file} > ${test.name}`;
        const locators = [
          directLocator,
          `${selector(command)} :: ${directLocator}`,
          ...legacyBunSelectors(command, test.name)
        ];
        const existing = entities.get(id);
        if (existing === undefined) {
          entities.set(id, { locators: new Set(locators), name: test.name });
        } else if (existing.name !== test.name) {
          throw failure(`conflicting names for registered testcase ${id}`);
        } else {
          for (const locator of locators) existing.locators.add(locator);
        }
      }
    }
    const after = await sourceFingerprint(workspaceRoot, excludedSourcePaths);
    if (
      before.projectId !== after.projectId ||
      before.revision !== after.revision ||
      before.scopeId !== after.scopeId
    ) {
      throw failure(
        "source inputs changed while collecting the repository test snapshot"
      );
    }
    return {
      completeness: "complete",
      entities: [...entities.entries()]
        .map(([id, entity]) => ({
          id,
          locators: [...entity.locators].sort(),
          name: entity.name
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      schemaVersion: 2,
      source: before
    };
  } finally {
    await fs.rm(reportDirectory, { force: true, recursive: true });
  }
}

export async function writeRepositoryTestEvidenceSnapshot(
  workspaceRoot: string,
  outputPath: string,
  options: Readonly<{ expectedSource?: RepositoryTestSource }> = {}
): Promise<RepositoryTestSnapshot> {
  const root = path.resolve(workspaceRoot);
  const resolvedOutput = path.resolve(root, outputPath);
  try {
    await fs.lstat(resolvedOutput);
    throw failure(`exclusive snapshot output already exists: ${outputPath}`);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
  const snapshot = await createRepositoryTestEvidenceSnapshot({
    ...options,
    outputPath: resolvedOutput,
    workspaceRoot: root
  });
  try {
    await fs.writeFile(
      resolvedOutput,
      `${JSON.stringify(snapshot, null, 2)}\n`,
      {
        encoding: "utf8",
        flag: "wx"
      }
    );
  } catch (error) {
    throw failure(
      `could not publish exclusive snapshot output ${outputPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return snapshot;
}

function parseSnapshotArguments(argv: readonly string[]): string {
  if (argv.length !== 2 || argv[0] !== "--output" || argv[1] === undefined) {
    throw failure("usage: bun run snapshot:test-evidence -- --output <file>");
  }
  return argv[1];
}

export async function runSnapshotCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<void> {
  const output = parseSnapshotArguments(argv);
  const snapshot = await writeRepositoryTestEvidenceSnapshot(
    process.cwd(),
    output
  );
  process.stdout.write(
    `${JSON.stringify({ output, source: snapshot.source, entityCount: snapshot.entities.length })}\n`
  );
}

if (import.meta.main) {
  runSnapshotCli().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
