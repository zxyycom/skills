import {
  assert,
  currentRelativePath,
  decisionFilePath,
  decisionIdForTest,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceCli,
  runSuccessfulSourceCli,
  test,
  validateDecisionRecords,
  withFixtureWorkspace,
  writeIndex
} from "./support.ts";

async function createIndexMaintenanceFixture(workspaceRoot: string) {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const originalIndexText = await fs.readFile(indexPath, "utf8");
  const originalIndex = await readIndex(indexPath);
  const firstEntryId = decisionIdForTest(
    Object.keys(originalIndex.entries)[0]!
  );
  const currentDecisionPath = decisionFilePath(
    workspaceRoot,
    currentRelativePath
  );
  const currentDecision = await fs.readFile(currentDecisionPath, "utf8");

  return {
    currentDecision,
    currentDecisionPath,
    decisionsDirectory,
    firstEntryId,
    indexPath,
    originalIndex,
    originalIndexText,
    workspaceRoot
  };
}

type IndexMaintenanceFixture = Awaited<
  ReturnType<typeof createIndexMaintenanceFixture>
>;

async function assertIndexDefinitionAndProjectionValidation({
  decisionsDirectory,
  firstEntryId,
  indexPath,
  originalIndex,
  workspaceRoot
}: IndexMaintenanceFixture): Promise<void> {
  const legacyDefinition = JSON.parse(JSON.stringify(originalIndex)) as {
    definitionVersion: number;
  };
  legacyDefinition.definitionVersion = 10;
  await writeIndex(indexPath, legacyDefinition);
  const legacyCheck = await runSourceCli(["check", "--root", workspaceRoot]);
  assert.equal(legacyCheck.exitCode, 1);
  assert.match(legacyCheck.stderr, /definitionVersion|definition version/i);
  assert.match(legacyCheck.stderr, /sync-index/i);
  const rebuiltLegacyDefinition = await runSourceCli([
    "sync-index",
    "--root",
    workspaceRoot
  ]);
  assert.equal(
    rebuiltLegacyDefinition.exitCode,
    0,
    rebuiltLegacyDefinition.stderr
  );
  assert.equal((await readIndex(indexPath)).definitionVersion, 11);

  const copiedContractPath = path.join(
    decisionsDirectory,
    "decision-record-rules.md"
  );
  await fs.writeFile(copiedContractPath, "# Copied contract\n", "utf8");
  const withCopiedContract = await validateDecisionRecords({ workspaceRoot });
  assert.ok(
    withCopiedContract.errors.some((error) =>
      error.includes(
        "decision-record-rules.md must start with YAML frontmatter"
      )
    )
  );
  await fs.rm(copiedContractPath);

  const mismatchedPathIndex = {
    ...originalIndex,
    entries: {
      ...originalIndex.entries,
      [firstEntryId]: {
        ...originalIndex.entries[firstEntryId]!,
        sourcePath: "mismatched-id.md"
      }
    }
  };
  await writeIndex(indexPath, mismatchedPathIndex);
  assert.ok(
    (await validateDecisionRecords({ workspaceRoot })).errors.some((error) =>
      error.includes("sourcePath")
    )
  );
}

async function assertCanonicalIndexRebuild({
  indexPath,
  originalIndex,
  originalIndexText,
  workspaceRoot
}: IndexMaintenanceFixture): Promise<void> {
  await fs.writeFile(indexPath, originalIndexText, "utf8");
  await fs.rm(indexPath);
  assert.match(
    await runSuccessfulSourceCli(["sync-index", "--root", workspaceRoot]),
    /Rebuilt .*decision-index\.json from decision Markdown files/
  );
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
  assert.equal((await readIndex(indexPath)).schemaVersion, 4);
  assert.deepEqual(
    (await readIndex(indexPath)).metadata,
    originalIndex.metadata
  );
  assert.deepEqual(
    (await validateDecisionRecords({ workspaceRoot })).errors,
    []
  );
}

async function assertSourceAndIndexDriftHandling({
  currentDecision,
  currentDecisionPath,
  indexPath,
  originalIndexText,
  workspaceRoot
}: IndexMaintenanceFixture): Promise<void> {
  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace(
      "purpose: 确保生成后的 CLI 能在独立运行环境中读取并校验决策记录。\n",
      ""
    ),
    "utf8"
  );
  assert.ok(
    (await validateDecisionRecords({ workspaceRoot })).errors.some((error) =>
      error.includes("frontmatter is missing purpose")
    )
  );
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  const ordinaryUnalignedDecision = currentDecision.replace(
    "alignment: aligned",
    "alignment: unaligned"
  );
  await fs.writeFile(currentDecisionPath, ordinaryUnalignedDecision, "utf8");
  await runSuccessfulSourceCli(["sync-index", "--root", workspaceRoot]);
  assert.deepEqual(
    (await validateDecisionRecords({ workspaceRoot })).errors,
    []
  );
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");
  await fs.writeFile(indexPath, originalIndexText, "utf8");

  const invalidEstablishedSource = currentDecision.replace(
    "alignment: aligned",
    "alignment: null"
  );
  await fs.writeFile(currentDecisionPath, invalidEstablishedSource, "utf8");
  const indexBeforeInvalidSource = await fs.readFile(indexPath, "utf8");
  for (const args of [["check"], ["sync-index"]] as const) {
    const rejected = await runSourceCli([...args, "--root", workspaceRoot]);
    assert.equal(rejected.exitCode, 1, `${args[0]}: ${rejected.stderr}`);
    assert.equal(rejected.stdout, "", args[0]);
    assert.match(rejected.stderr, /alignment/i, args[0]);
    assert.match(rejected.stderr, /use-generated-cli\.md/, args[0]);
    assert.equal(
      await fs.readFile(currentDecisionPath, "utf8"),
      invalidEstablishedSource,
      args[0]
    );
    assert.equal(
      await fs.readFile(indexPath, "utf8"),
      indexBeforeInvalidSource,
      args[0]
    );
  }
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");
  await fs.writeFile(indexPath, originalIndexText, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace(
      "\n## 目的\n" +
        "- 确保生成后的 CLI 能在独立运行环境中读取并校验决策记录。\n",
      "\n"
    ),
    "utf8"
  );
  const listWithInvalidRecord = await runSourceCli([
    "list",
    "--root",
    workspaceRoot
  ]);
  assert.equal(listWithInvalidRecord.exitCode, 0, listWithInvalidRecord.stderr);
  assert.match(listWithInvalidRecord.stdout, /- use-generated-cli /);
  const traceWithInvalidRecord = await runSourceCli([
    "trace",
    currentRelativePath,
    "--json",
    "--root",
    workspaceRoot
  ]);
  assert.equal(
    traceWithInvalidRecord.exitCode,
    0,
    traceWithInvalidRecord.stderr
  );
  const invalidRecordTrace = JSON.parse(traceWithInvalidRecord.stdout) as {
    entries: Record<string, unknown>;
  };
  assert.ok("260710-use-source-cli" in invalidRecordTrace.entries);
  assert.doesNotMatch(traceWithInvalidRecord.stdout, /sourcePath/);
  assert.ok(
    (await validateDecisionRecords({ workspaceRoot })).errors.some(
      (error) =>
        error.includes(currentRelativePath) &&
        error.includes('body must start with "## 目的"')
    )
  );
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace("title: 使用生成 CLI", "title: 很短"),
    "utf8"
  );
  assert.ok(
    (await validateDecisionRecords({ workspaceRoot })).errors.some(
      (error) =>
        error.includes("title projection must contain 4 to 100") &&
        error.includes("actual 2")
    )
  );
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace(
      "relations:\n" +
        "  - type: 修订\n" +
        "    target: 260710-use-source-cli\n",
      "relations: []\n"
    ),
    "utf8"
  );
  const traceWithRelationDrift = await runSourceCli([
    "trace",
    "260710-use-source-cli.md",
    "--json",
    "--root",
    workspaceRoot
  ]);
  assert.equal(
    traceWithRelationDrift.exitCode,
    0,
    traceWithRelationDrift.stderr
  );
  const relationDriftTrace = JSON.parse(traceWithRelationDrift.stdout) as {
    entries: Record<
      string,
      { relations: Array<{ target: string; type: string }> }
    >;
  };
  assert.deepEqual(relationDriftTrace.entries["use-generated-cli"]?.relations, [
    { target: "260710-use-source-cli", type: "修订" }
  ]);
  assert.ok(
    (await validateDecisionRecords({ workspaceRoot })).errors.some((error) =>
      error.includes("out of sync")
    )
  );
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  const driftedDecision = currentDecision.replace(
    "title: 使用生成 CLI",
    "title: 使用同步后的生成 CLI"
  );
  await fs.writeFile(currentDecisionPath, driftedDecision, "utf8");
  const driftedList = await runSourceCli(["list", "--root", workspaceRoot]);
  assert.equal(driftedList.exitCode, 0, driftedList.stderr);
  assert.match(driftedList.stdout, /\] 使用生成 CLI/);
  assert.doesNotMatch(driftedList.stdout, /\] 使用同步后的生成 CLI/);
  await runSuccessfulSourceCli(["sync-index", "--root", workspaceRoot]);
  const synchronizedIndex = await readIndex(indexPath);
  const synchronizedEntry = findIndexEntry(
    synchronizedIndex,
    currentRelativePath
  );
  assert.equal(synchronizedEntry.title, "使用同步后的生成 CLI");
  assert.equal(synchronizedEntry.status, "active");
  assert.equal(synchronizedEntry.alignment, "aligned");
  assert.equal(synchronizedEntry.createdAt, "2026-07-11T14:15:16+08:00");
}

async function runIndexMaintenanceAssertions(
  workspaceRoot: string
): Promise<void> {
  const fixture = await createIndexMaintenanceFixture(workspaceRoot);
  await assertIndexDefinitionAndProjectionValidation(fixture);
  await assertCanonicalIndexRebuild(fixture);
  await assertSourceAndIndexDriftHandling(fixture);
}

test("index maintenance detects drift and synchronizes canonical decision states", () =>
  withFixtureWorkspace("index-maintenance", runIndexMaintenanceAssertions));
