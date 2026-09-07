import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  legacyIndexFile,
  legacyRoot,
  legacyTopicsFile,
  loadLegacyCatalog,
  sha256,
  type LegacyCase
} from "./legacy.ts";

type ExpectedSource = Readonly<{
  projectId: string;
  revision: string;
  scopeId: string;
}>;
type SnapshotEntity = Readonly<{
  id: string;
  locators: readonly string[];
  name: string;
}>;
type Snapshot = Readonly<{
  completeness: "complete" | "partial";
  entities: readonly SnapshotEntity[];
  schemaVersion: 2;
  source: ExpectedSource;
}>;
type ConvertedCase = Readonly<{
  id: string;
  sourcePath: string;
  text: string;
  title: string;
}>;
type SourceFile = Readonly<{
  bytes: Uint8Array;
  dev: number;
  ino: number;
  mode: number;
  path: string;
}>;
type MigrationIndex = Readonly<{
  definitionVersion: 6;
  entries: Readonly<
    Record<
      string,
      Readonly<{
        sourcePath: string;
        tags: readonly string[];
        testIds: readonly string[];
        title: string;
      }>
    >
  >;
  metadata: Readonly<Record<string, never>>;
  namespace: "test-evidence";
  schemaVersion: 4;
  sourceRevision: Readonly<{
    entries: Readonly<Record<string, string>>;
    metadata: string;
  }>;
}>;
export type MigrationPlan = Readonly<{
  addedPaths: readonly string[];
  cases: readonly ConvertedCase[];
  index: MigrationIndex;
  legacyCaseCount: number;
  legacyFingerprints: Readonly<Record<string, string>>;
  removedPaths: readonly string[];
  snapshotFingerprint: string;
}>;
export class MigrationError extends Error {}
const sourceFilesByPlan = new WeakMap<
  MigrationPlan,
  Readonly<Record<string, SourceFile>>
>();

export async function planTestEvidenceMigration(options: {
  expectedSource: ExpectedSource;
  snapshot: unknown;
  workspaceRoot: string;
}): Promise<MigrationPlan> {
  const snapshot = parseSnapshot(options.snapshot);
  assertExpectedSource(snapshot, options.expectedSource);
  if (snapshot.completeness !== "complete")
    throw new MigrationError("snapshot completeness must be complete");
  const legacy = await loadLegacyCatalog(options.workspaceRoot);
  const byLocator = locatorIndex(snapshot.entities);
  const converted = legacy.cases.map((legacyCase) =>
    convertCase(legacyCase, byLocator)
  );
  const mappingErrors = converted.flatMap((entry) => entry.errors);
  if (mappingErrors.length > 0)
    throw new MigrationError(
      `legacy Entries cannot map to exactly one snapshot entity:\n${mappingErrors.map((entry) => `- ${entry}`).join("\n")}`
    );
  const cases = converted.map((entry) => entry.value!);
  assertNewCases(cases);
  const root = path.join(options.workspaceRoot, ...legacyRoot.split("/"));
  await assertTargetsAvailable(root, cases);
  const sourceFiles = await captureSourceFiles(options.workspaceRoot, legacy);
  const index = buildIndex(cases);
  const removedPaths = [
    ...legacy.cases.map((entry) => entry.sourcePath),
    ...uniqueSorted(
      legacy.cases.map((entry) => `${legacyRoot}/${entry.topicId}`)
    ),
    `${legacyRoot}/${legacyTopicsFile}`
  ];
  const plan = {
    addedPaths: [
      ...cases.map((entry) => `${legacyRoot}/${entry.sourcePath}`),
      `${legacyRoot}/${legacyIndexFile}`
    ],
    cases,
    index,
    legacyCaseCount: legacy.cases.length,
    legacyFingerprints: legacy.fingerprints,
    removedPaths: uniqueSorted(removedPaths),
    snapshotFingerprint: sha256(JSON.stringify(snapshot))
  };
  sourceFilesByPlan.set(plan, sourceFiles);
  return plan;
}

function parseSnapshot(input: unknown): Snapshot {
  if (
    !isRecord(input) ||
    keys(input) !== "completeness,entities,schemaVersion,source" ||
    input.schemaVersion !== 2 ||
    (input.completeness !== "complete" && input.completeness !== "partial") ||
    !isRecord(input.source) ||
    keys(input.source) !== "projectId,revision,scopeId" ||
    !Array.isArray(input.entities)
  ) {
    throw new MigrationError(
      "snapshot must use schemaVersion 2 with source, completeness, and entities"
    );
  }
  const source = input.source as Record<string, unknown>;
  for (const field of ["projectId", "scopeId", "revision"] as const)
    if (!isSingleLine(source[field]))
      throw new MigrationError(
        `snapshot source.${field} must be non-empty single-line text`
      );
  const entities: SnapshotEntity[] = [];
  for (const entity of input.entities) {
    if (
      !isRecord(entity) ||
      keys(entity) !== "id,locators,name" ||
      typeof entity.id !== "string" ||
      !isSingleLine(entity.name) ||
      !Array.isArray(entity.locators)
    ) {
      throw new MigrationError("snapshot has an invalid entity");
    }
    const id = entity.id as string;
    if (!isOpaqueToken(id))
      throw new MigrationError(`snapshot entity ID is invalid: ${id}`);
    const locators = entity.locators as unknown[];
    if (
      locators.length === 0 ||
      !locators.every(isSingleLine) ||
      new Set(locators).size !== locators.length ||
      !isSorted(locators as string[])
    )
      throw new MigrationError(`snapshot entity ${id} has invalid locators`);
    entities.push({
      id,
      locators: locators as string[],
      name: entity.name as string
    });
  }
  if (
    new Set(entities.map((entry) => entry.id)).size !== entities.length ||
    !isSorted(entities.map((entry) => entry.id))
  )
    throw new MigrationError("snapshot entity IDs must be unique and sorted");
  return {
    completeness: input.completeness,
    entities,
    schemaVersion: 2,
    source: source as ExpectedSource
  };
}
function assertExpectedSource(
  snapshot: Snapshot,
  expected: ExpectedSource
): void {
  for (const key of ["projectId", "scopeId", "revision"] as const)
    if (!isSingleLine(expected[key]) || snapshot.source[key] !== expected[key])
      throw new MigrationError(
        `snapshot source.${key} does not match expected source`
      );
}
function locatorIndex(
  entities: readonly SnapshotEntity[]
): ReadonlyMap<string, readonly SnapshotEntity[]> {
  const result = new Map<string, SnapshotEntity[]>();
  for (const entity of entities)
    for (const locator of entity.locators) {
      const values = result.get(locator) ?? [];
      values.push(entity);
      result.set(locator, values);
    }
  return result;
}
function convertCase(
  legacyCase: LegacyCase,
  entities: ReadonlyMap<string, readonly SnapshotEntity[]>
): { errors: readonly string[]; value?: ConvertedCase } {
  const entityIds = new Set<string>();
  const errors: string[] = [];
  for (const entry of legacyCase.entries) {
    try {
      const matches = new Map<string, SnapshotEntity>();
      for (const locator of legacyEntryLocators(entry))
        for (const entity of entities.get(locator) ?? [])
          matches.set(entity.id, entity);
      if (matches.size !== 1)
        throw new MigrationError("cannot map to exactly one snapshot entity");
      entityIds.add(matches.values().next().value!.id);
    } catch (error) {
      errors.push(`${legacyCase.id} Entry ${messageOf(error)}: ${entry}`);
    }
  }
  if (errors.length > 0) return { errors };
  const testIds = [...entityIds].sort(compare);
  const tags = [legacyCase.topicId];
  const text = [
    `### Case ${legacyCase.id}: ${legacyCase.title}`,
    "",
    "Tests:",
    ...testIds.map((id) => `- \`${id}\``),
    "",
    "Tags:",
    ...tags.map((tag) => `- \`${tag}\``),
    "",
    "Contract:",
    ...legacyCase.contract.map((item) => `- ${item}`),
    "",
    "Proves:",
    ...legacyCase.proves.map((item) => `- ${item}`),
    ""
  ].join("\n");
  return {
    errors,
    value: {
      id: legacyCase.id,
      sourcePath: `cases/${legacyCase.id.toLowerCase()}.md`,
      text,
      title: legacyCase.title
    }
  };
}
function legacyEntryLocators(entry: string): readonly string[] {
  const direct = entry.match(/^(\S+) > (\S(?:.*\S)?)$/u);
  if (direct !== null)
    return [entry, `${projectRelativeFile(direct[1]!)} > ${direct[2]!}`];
  const selector = entry.match(
    /^(?:[A-Z_][A-Z0-9_]*=[^\s]+\s+)*(?:bun test|node --test) --test-name-pattern=(?:"\^(.+)\$"|'\^(.+)\$') (?:\.\/)?([^\s]+)$/u
  );
  if (selector === null)
    throw new MigrationError(
      `legacy Entry is not an exact file/full-name locator: ${entry}`
    );
  const name = unescapeSelectorName(selector[1] ?? selector[2] ?? "");
  const file = projectRelativeFile(selector[3]!);
  if (name === "")
    throw new MigrationError("is not an exact file/full-name locator");
  const runner = entry.includes("bun test") ? "bun test" : "node --test";
  const normalizedSelectors = [file, `./${file}`].map(
    (selectorFile) =>
      `${runner} --test-name-pattern="^${escapeSelectorName(name)}$" ${selectorFile}`
  );
  return uniqueSorted([entry, ...normalizedSelectors, `${file} > ${name}`]);
}
function projectRelativeFile(value: string): string {
  const normalized = value.replace(/^\.\//u, "");
  if (!isProjectRelativePath(normalized))
    throw new MigrationError("is not an exact file/full-name locator");
  return normalized;
}
function unescapeSelectorName(value: string): string {
  return value.replace(/\\(.)/gu, "$1");
}
function escapeSelectorName(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
function assertNewCases(cases: readonly ConvertedCase[]): void {
  if (
    new Set(cases.map((entry) => entry.id)).size !== cases.length ||
    new Set(cases.map((entry) => entry.sourcePath)).size !== cases.length
  )
    throw new MigrationError("converted Case identities or paths collide");
}
async function assertTargetsAvailable(
  root: string,
  cases: readonly ConvertedCase[]
): Promise<void> {
  const casesDirectory = path.join(root, "cases");
  if (await exists(casesDirectory))
    throw new MigrationError(
      `${legacyRoot}/cases already exists; migration refuses to merge into an existing target`
    );
  for (const converted of cases)
    if (await exists(path.join(root, ...converted.sourcePath.split("/"))))
      throw new MigrationError(
        `target already exists: ${legacyRoot}/${converted.sourcePath}`
      );
}
function buildIndex(cases: readonly ConvertedCase[]): MigrationIndex {
  const entries: Record<
    string,
    {
      sourcePath: string;
      tags: readonly string[];
      testIds: readonly string[];
      title: string;
    }
  > = Object.create(null);
  const revisions: Record<string, string> = Object.create(null);
  for (const entry of [...cases].sort((a, b) => compare(a.id, b.id))) {
    const parsed = parseConvertedCase(entry.text);
    entries[entry.id] = {
      title: entry.title,
      sourcePath: entry.sourcePath,
      tags: parsed.tags,
      testIds: parsed.tests
    };
    revisions[entry.id] = sha256(
      JSON.stringify([entry.sourcePath, entry.text.replace(/\r\n/gu, "\n")])
    );
  }
  return {
    schemaVersion: 4,
    namespace: "test-evidence",
    definitionVersion: 6,
    metadata: {},
    sourceRevision: { entries: revisions, metadata: sha256("{}") },
    entries
  };
}
function parseConvertedCase(text: string): { tags: string[]; tests: string[] } {
  const tests = valuesAfter(text, "Tests:");
  const tags = valuesAfter(text, "Tags:");
  if (
    tests.length === 0 ||
    tags.length === 0 ||
    !isSorted(tests) ||
    !isSorted(tags) ||
    new Set(tests).size !== tests.length ||
    new Set(tags).size !== tags.length ||
    !tags.every((tag) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(tag))
  )
    throw new MigrationError("generated Case violates D1");
  return { tags, tests };
}
function valuesAfter(text: string, heading: string): string[] {
  const lines = text.split("\n");
  const start = lines.indexOf(heading);
  const values: string[] = [];
  for (
    let index = start + 1;
    index < lines.length && (lines[index] ?? "") !== "";
    index += 1
  ) {
    const match = lines[index]?.match(/^- `([^`\r\n]+)`$/u);
    if (match === null || match === undefined) return [];
    values.push(match[1]!);
  }
  return values;
}

export async function writeTestEvidenceMigration(options: {
  expectedSource: ExpectedSource;
  snapshot: unknown;
  workspaceRoot: string;
}): Promise<MigrationPlan> {
  const plan = await planTestEvidenceMigration(options);
  const root = path.join(options.workspaceRoot, ...legacyRoot.split("/"));
  const backupDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "test-evidence-migration-")
  );
  const created: Array<{ path: string; text: string }> = [];
  const overwritten: SourceFile[] = [];
  const removed: SourceFile[] = [];
  try {
    await revalidatePlan(options, plan);
    const oldIndexPath = path.join(root, legacyIndexFile);
    const oldIndex = await captureExpectedSource(plan, oldIndexPath);
    overwritten.push(oldIndex);
    await fs.writeFile(
      path.join(backupDirectory, "old-index"),
      oldIndex.bytes,
      { mode: oldIndex.mode }
    );
    const casesDirectory = path.join(root, "cases");
    await fs.mkdir(casesDirectory, { mode: 0o755 });
    for (const entry of plan.cases) {
      const target = path.join(root, ...entry.sourcePath.split("/"));
      await fs.writeFile(target, entry.text, { mode: 0o644, flag: "wx" });
      created.push({ path: target, text: entry.text });
    }
    const indexText = `${JSON.stringify(plan.index, null, 2)}\n`;
    await fs.writeFile(oldIndexPath, indexText, {
      mode: oldIndex.mode,
      flag: "w"
    });
    created.push({ path: oldIndexPath, text: indexText });
    for (const sourcePath of plan.removedPaths.filter(
      (entry) => entry.endsWith(".md") || entry.endsWith(legacyTopicsFile)
    )) {
      const absolute = path.join(
        options.workspaceRoot,
        ...sourcePath.split("/")
      );
      const captured = await captureExpectedSource(plan, absolute);
      removed.push(captured);
      await fs.writeFile(
        path.join(backupDirectory, `${removed.length}`),
        captured.bytes,
        { mode: captured.mode }
      );
      await fs.unlink(absolute);
    }
    for (const sourcePath of plan.removedPaths.filter(
      (entry) => !entry.endsWith(".md") && !entry.endsWith(legacyTopicsFile)
    ))
      await fs.rmdir(
        path.join(options.workspaceRoot, ...sourcePath.split("/"))
      );
    return plan;
  } catch (error) {
    const incomplete = await restoreMigration(
      created,
      overwritten,
      removed,
      path.join(root, "cases")
    );
    throw new MigrationError(
      `migration failed${incomplete ? "; recovery incomplete because concurrent changes were preserved" : "; original bytes restored"}: ${messageOf(error)}`
    );
  } finally {
    await fs.rm(backupDirectory, { recursive: true, force: true });
  }
}
async function revalidatePlan(
  options: {
    expectedSource: ExpectedSource;
    snapshot: unknown;
    workspaceRoot: string;
  },
  plan: MigrationPlan
): Promise<void> {
  const current = await planTestEvidenceMigration(options);
  if (
    JSON.stringify(current.legacyFingerprints) !==
      JSON.stringify(plan.legacyFingerprints) ||
    current.snapshotFingerprint !== plan.snapshotFingerprint
  )
    throw new MigrationError("legacy source or snapshot changed before write");
}
async function captureSourceFiles(
  workspaceRoot: string,
  legacy: Awaited<ReturnType<typeof loadLegacyCatalog>>
): Promise<Readonly<Record<string, SourceFile>>> {
  const paths = [
    path.join(workspaceRoot, ...legacyRoot.split("/"), legacyIndexFile),
    path.join(workspaceRoot, ...legacyRoot.split("/"), legacyTopicsFile),
    ...legacy.cases.map((entry) =>
      path.join(workspaceRoot, ...entry.sourcePath.split("/"))
    )
  ].sort(compare);
  const result: Record<string, SourceFile> = Object.create(null);
  for (const filePath of paths) result[filePath] = await captureFile(filePath);
  return result;
}
async function captureExpectedSource(
  plan: MigrationPlan,
  filePath: string
): Promise<SourceFile> {
  const expected = sourceFilesByPlan.get(plan)?.[filePath];
  if (expected === undefined)
    throw new MigrationError(
      `source was not present during preflight: ${filePath}`
    );
  const current = await captureFile(filePath);
  if (
    current.dev !== expected.dev ||
    current.ino !== expected.ino ||
    !sameBytes(current.bytes, expected.bytes)
  )
    throw new MigrationError(
      `legacy source changed before replacement: ${filePath}`
    );
  return current;
}
async function captureFile(filePath: string): Promise<SourceFile> {
  const stat = await fs.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new MigrationError(`${filePath} is not a regular file`);
  return {
    bytes: await fs.readFile(filePath),
    dev: stat.dev,
    ino: stat.ino,
    mode: stat.mode & 0o777,
    path: filePath
  };
}
async function restoreMigration(
  created: readonly { path: string; text: string }[],
  overwritten: readonly SourceFile[],
  removed: readonly SourceFile[],
  createdCasesDirectory: string
): Promise<boolean> {
  let incomplete = false;
  for (const entry of [...created].reverse()) {
    try {
      const current = await fs.readFile(entry.path, "utf8");
      if (current === entry.text) await fs.unlink(entry.path);
      else incomplete = true;
    } catch {
      /* already absent */
    }
  }
  try {
    await fs.rmdir(createdCasesDirectory);
  } catch (error: unknown) {
    if (!isRecord(error) || error.code !== "ENOENT") incomplete = true;
  }
  for (const entry of [...overwritten, ...removed].reverse()) {
    try {
      const stat = await lstat(entry.path);
      if (stat === null) {
        await fs.mkdir(path.dirname(entry.path), { recursive: true });
        await fs.writeFile(entry.path, entry.bytes, {
          mode: entry.mode,
          flag: "wx"
        });
      } else {
        incomplete = true;
      }
    } catch {
      incomplete = true;
    }
  }
  return incomplete;
}
function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    left.every((byte, index) => byte === right[index])
  );
}
function lstat(filePath: string) {
  return fs.lstat(filePath).catch((error: unknown) => {
    if (isRecord(error) && error.code === "ENOENT") return null;
    throw error;
  });
}
function isOpaqueToken(value: string): boolean {
  return (
    value.length > 0 &&
    value.trim() === value &&
    !/[\s`]/u.test(value) &&
    !hasAsciiControlCharacter(value)
  );
}
function hasAsciiControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) return true;
  }
  return false;
}
function isSingleLine(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !/[\r\n]/u.test(value)
  );
}
function isProjectRelativePath(value: string): boolean {
  return (
    !path.posix.isAbsolute(value) &&
    !value.split("/").includes("..") &&
    !value.includes("\\") &&
    value !== ""
  );
}
function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compare);
}
function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function isSorted(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || (values[index - 1] ?? "") < value
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>): string {
  return Object.keys(value).sort(compare).join(",");
}
function exists(filePath: string): Promise<boolean> {
  return fs
    .lstat(filePath)
    .then(() => true)
    .catch((error: unknown) =>
      isRecord(error) && error.code === "ENOENT" ? false : Promise.reject(error)
    );
}
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(argv: readonly string[]): Promise<void> {
  const parsed = parseArgs(argv);
  const raw = await fs.readFile(
    path.resolve(parsed.root, parsed.snapshot),
    "utf8"
  );
  const snapshot: unknown = JSON.parse(raw);
  const input = {
    expectedSource: {
      projectId: parsed.project,
      revision: parsed.revision,
      scopeId: parsed.scope
    },
    snapshot,
    workspaceRoot: parsed.root
  };
  const result = parsed.write
    ? await writeTestEvidenceMigration(input)
    : await planTestEvidenceMigration(input);
  process.stdout.write(
    `${JSON.stringify({ ...result, mode: parsed.write ? "write" : "dry-run" }, null, 2)}\n`
  );
}
function parseArgs(argv: readonly string[]): {
  project: string;
  revision: string;
  root: string;
  scope: string;
  snapshot: string;
  write: boolean;
} {
  let snapshot: string | null = null,
    project: string | null = null,
    scope: string | null = null,
    revision: string | null = null,
    root = process.cwd(),
    write = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") {
      if (write) throw new MigrationError("--write may appear once");
      write = true;
      continue;
    }
    if (
      arg === "--snapshot" ||
      arg === "--expect-project" ||
      arg === "--expect-scope" ||
      arg === "--expect-revision" ||
      arg === "--root"
    ) {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--"))
        throw new MigrationError(`${arg} requires a value`);
      if (arg === "--snapshot") {
        if (snapshot !== null)
          throw new MigrationError("--snapshot may appear once");
        snapshot = value;
      }
      if (arg === "--expect-project") {
        if (project !== null)
          throw new MigrationError("--expect-project may appear once");
        project = value;
      }
      if (arg === "--expect-scope") {
        if (scope !== null)
          throw new MigrationError("--expect-scope may appear once");
        scope = value;
      }
      if (arg === "--expect-revision") {
        if (revision !== null)
          throw new MigrationError("--expect-revision may appear once");
        revision = value;
      }
      if (arg === "--root") root = path.resolve(value);
      continue;
    }
    throw new MigrationError(`unknown argument: ${arg}`);
  }
  if (
    snapshot === null ||
    project === null ||
    scope === null ||
    revision === null
  )
    throw new MigrationError(
      "--snapshot, --expect-project, --expect-scope, and --expect-revision are required"
    );
  return { project, revision, root, scope, snapshot, write };
}
if (import.meta.main)
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${messageOf(error)}\n`);
    process.exitCode = 1;
  });
