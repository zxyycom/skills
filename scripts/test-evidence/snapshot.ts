import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  RepositoryTestSource,
  RepositoryTestSnapshot,
  SnapshotOptions,
  TestCommand
} from "./snapshot-types.ts";
import {
  repositoryTestProjectId,
  repositoryTestScopeId
} from "./snapshot-types.ts";
import {
  commandKey,
  legacyBunSelectors,
  parseRepositoryTestCommands,
  selector
} from "./snapshot-commands.ts";
import { snapshotFailure } from "./snapshot-files.ts";
import { collectRegistration } from "./snapshot-junit.ts";
import {
  assertSupportedRegistrationShape,
  registrationClosures,
  registrationDefinitions
} from "./snapshot-registrations.ts";
import {
  excludedSnapshotOutput,
  sourceFingerprint
} from "./snapshot-source.ts";

export type {
  RepositoryTestEntity,
  RepositoryTestSnapshot,
  RepositoryTestSource
} from "./snapshot-types.ts";
export { parseRepositoryTestCommands } from "./snapshot-commands.ts";
export { parseSkippedJUnit } from "./snapshot-junit.ts";
export { repositoryTestEvidenceSource } from "./snapshot-source.ts";

function validateExpectedSource(
  expectedSource: RepositoryTestSource | undefined
): void {
  if (expectedSource === undefined) return;
  if (
    expectedSource.projectId !== repositoryTestProjectId ||
    expectedSource.scopeId !== repositoryTestScopeId ||
    !/^[a-f0-9]{64}$/u.test(expectedSource.revision)
  ) {
    throw snapshotFailure(
      "expected source does not match the repository source scope"
    );
  }
}

function entityId(file: string, name: string): string {
  return `test:${createHash("sha256")
    .update(JSON.stringify([file, name]))
    .digest("hex")}`;
}

function addRegisteredTests(
  entities: Map<string, { locators: Set<string>; name: string }>,
  command: TestCommand,
  tests: Awaited<ReturnType<typeof collectRegistration>>
): void {
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
      throw snapshotFailure(`conflicting names for registered testcase ${id}`);
    } else {
      for (const locator of locators) existing.locators.add(locator);
    }
  }
}

async function collectRepositoryEntities(
  workspaceRoot: string,
  commands: readonly TestCommand[],
  definitions: ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>,
  reportDirectory: string
): Promise<RepositoryTestSnapshot["entities"]> {
  const entities = new Map<string, { locators: Set<string>; name: string }>();
  for (const [index, command] of commands.entries()) {
    const tests = await collectRegistration(
      workspaceRoot,
      command,
      path.join(reportDirectory, `${index}.xml`),
      definitions.get(commandKey(command)) ?? new Map()
    );
    addRegisteredTests(entities, command, tests);
  }
  return [...entities.entries()]
    .map(([id, entity]) => ({
      id,
      locators: [...entity.locators].sort(),
      name: entity.name
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function assertUnchangedSource(
  before: RepositoryTestSource,
  after: RepositoryTestSource
): void {
  if (
    before.projectId !== after.projectId ||
    before.revision !== after.revision ||
    before.scopeId !== after.scopeId
  ) {
    throw snapshotFailure(
      "source inputs changed while collecting the repository test snapshot"
    );
  }
}

export async function createRepositoryTestEvidenceSnapshot(
  options: SnapshotOptions
): Promise<RepositoryTestSnapshot> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  validateExpectedSource(options.expectedSource);
  const excludedSourcePaths = excludedSnapshotOutput(
    workspaceRoot,
    options.outputPath
  );
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
    const entities = await collectRepositoryEntities(
      workspaceRoot,
      commands,
      definitions,
      reportDirectory
    );
    assertUnchangedSource(
      before,
      await sourceFingerprint(workspaceRoot, excludedSourcePaths)
    );
    return {
      completeness: "complete",
      entities,
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
    throw snapshotFailure(
      `exclusive snapshot output already exists: ${outputPath}`
    );
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
      { encoding: "utf8", flag: "wx" }
    );
  } catch (error) {
    throw snapshotFailure(
      `could not publish exclusive snapshot output ${outputPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return snapshot;
}

function parseSnapshotArguments(argv: readonly string[]): string {
  if (argv.length !== 2 || argv[0] !== "--output" || argv[1] === undefined) {
    throw snapshotFailure(
      "usage: bun run snapshot:test-evidence -- --output <file>"
    );
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
