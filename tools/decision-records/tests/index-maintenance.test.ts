import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../src/index.ts";
import {
  currentRelativePath,
  decisionIdForTest,
  decisionFilePath,
  findIndexEntry,
  readIndex,
  runSourceCli,
  runSuccessfulSourceCli,
  withFixtureWorkspace,
  writeIndex
} from "./support.ts";

test("index maintenance detects drift and synchronizes canonical decision states", () => (
  withFixtureWorkspace("index-maintenance", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const originalIndexText = await fs.readFile(indexPath, "utf8");
  const originalIndex = await readIndex(indexPath);
  const firstEntryId = decisionIdForTest(Object.keys(originalIndex.entries)[0]!);
  const currentDecisionPath = decisionFilePath(
    workspaceRoot,
    currentRelativePath
  );
  const currentDecision = await fs.readFile(currentDecisionPath, "utf8");

  const copiedContractPath = path.join(
    decisionsDirectory,
    "decision-record-rules.md"
  );
  await fs.writeFile(copiedContractPath, "# Copied contract\n", "utf8");
  const withCopiedContract = await validateDecisionRecords({ workspaceRoot });
  assert.ok(withCopiedContract.errors.some(
    (error) => error.includes(
      "decision-record-rules.md must start with YAML frontmatter"
    )
  ));
  await fs.rm(copiedContractPath);

  await fs.writeFile(
    indexPath,
    JSON.stringify({ ...originalIndex, unsupported: true }, null, 2) + "\n",
    "utf8"
  );
  const withUnsupportedIndexField = await validateDecisionRecords({
    workspaceRoot
  });
  assert.ok(withUnsupportedIndexField.errors.some(
    (error) => error.includes(
      'unsupported Invalid key: Expected never but received "unsupported"'
    )
  ));

  await fs.writeFile(
    indexPath,
    JSON.stringify({ schemaVersion: 2, records: [] }, null, 2) + "\n",
    "utf8"
  );
  const withUnsupportedSchemaVersion = await validateDecisionRecords({
    workspaceRoot
  });
  assert.ok(withUnsupportedSchemaVersion.errors.some(
    (error) => error.includes("schema version 2 is unsupported; expected 3")
  ));
  const listWithInvalidIndex = await runSourceCli([
    "list",
    "--root",
    workspaceRoot
  ]);
  assert.equal(listWithInvalidIndex.exitCode, 1);
  assert.match(listWithInvalidIndex.stderr, /Decision records command failed/);

  const invalidTimestampIndex = structuredClone(originalIndex);
  invalidTimestampIndex.entries[firstEntryId]!.state.createdAt = "2026-07-10";
  await writeIndex(indexPath, invalidTimestampIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("createdAt must be an RFC 3339 timestamp")
  ));

  const mismatchedPathIndex = {
    ...originalIndex,
    entries: {
      ...originalIndex.entries,
      [firstEntryId]: {
        ...originalIndex.entries[firstEntryId]!,
        state: {
          ...originalIndex.entries[firstEntryId]!.state,
          sourcePath: "mismatched-id.md"
        }
      }
    }
  };
  await writeIndex(indexPath, mismatchedPathIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("sourcePath")
  ));

  const invalidRevisionIndex = structuredClone(originalIndex);
  invalidRevisionIndex.sourceRevision = {
    ...invalidRevisionIndex.sourceRevision,
    entries: {
      ...invalidRevisionIndex.sourceRevision.entries,
      [firstEntryId]: "not-a-sha256"
    }
  };
  await writeIndex(indexPath, invalidRevisionIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes(
      "must be a sha256 decision source fingerprint"
    )
  ));

  const fractionalTimestampIndex = structuredClone(originalIndex);
  fractionalTimestampIndex.entries[firstEntryId]!.state.createdAt =
    "2026-07-10T09:10:11.123+08:00";
  await writeIndex(indexPath, fractionalTimestampIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("precise to seconds")
  ));

  const invalidAlignmentIndex = structuredClone(originalIndex);
  findIndexEntry(invalidAlignmentIndex, currentRelativePath).alignment = null;
  await writeIndex(indexPath, invalidAlignmentIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes(
      "alignment must be aligned or unaligned when status is active"
    )
  ));

  const shortProjectionIndex = structuredClone(originalIndex);
  shortProjectionIndex.entries[firstEntryId]!.state.title = "短";
  await writeIndex(indexPath, shortProjectionIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("actual 1")
  ));

  const longProjectionIndex = structuredClone(originalIndex);
  longProjectionIndex.entries[firstEntryId]!.state.purpose = "长".repeat(101);
  await writeIndex(indexPath, longProjectionIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("actual 101")
  ));

  await fs.writeFile(indexPath, originalIndexText, "utf8");
  await fs.rm(indexPath);
  assert.match(
    await runSuccessfulSourceCli([
      "sync-index",
      "--write",
      "--root",
      workspaceRoot
    ]),
    /Rebuilt .*decision-index\.json from decision Markdown files/
  );
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
  assert.equal((await readIndex(indexPath)).schemaVersion, 3);
  assert.deepEqual((await readIndex(indexPath)).metadata, originalIndex.metadata);
  assert.deepEqual(
    (await validateDecisionRecords({ workspaceRoot })).errors,
    []
  );

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace(
      "purpose: 确保生成后的 CLI 能在独立运行环境中读取并校验决策记录。\n",
      ""
    ),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("frontmatter is missing purpose")
  ));
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  const ordinaryUnalignedDecision = currentDecision.replace(
    "alignment: aligned",
    "alignment: unaligned"
  );
  await fs.writeFile(
    currentDecisionPath,
    ordinaryUnalignedDecision,
    "utf8"
  );
  await runSuccessfulSourceCli([
    "sync-index",
    "--write",
    "--root",
    workspaceRoot
  ]);
  assert.deepEqual(
    (await validateDecisionRecords({ workspaceRoot })).errors,
    []
  );
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");
  await fs.writeFile(indexPath, originalIndexText, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace(
      "\n## 目的\n"
        + "- 确保生成后的 CLI 能在独立运行环境中读取并校验决策记录。\n",
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
  assert.match(listWithInvalidRecord.stdout, /use-generated-cli\.md/);
  const traceWithInvalidRecord = await runSourceCli([
    "trace",
    currentRelativePath,
    "--root",
    workspaceRoot
  ]);
  assert.equal(traceWithInvalidRecord.exitCode, 0, traceWithInvalidRecord.stderr);
  assert.match(traceWithInvalidRecord.stdout, /260710-use-source-cli\.md/);
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes(currentRelativePath)
      && error.includes('body must start with "## 目的"')
  ));
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace("title: 使用生成 CLI", "title: 很短"),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("title projection must contain 4 to 100")
      && error.includes("actual 2")
  ));
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace(
      "relations:\n"
        + "  - type: 修订\n"
        + "    target: 260710-use-source-cli.md\n",
      "relations: []\n"
    ),
    "utf8"
  );
  const traceWithRelationDrift = await runSourceCli([
    "trace",
    "260710-use-source-cli.md",
    "--root",
    workspaceRoot
  ]);
  assert.equal(traceWithRelationDrift.exitCode, 0, traceWithRelationDrift.stderr);
  assert.match(
    traceWithRelationDrift.stdout,
    /use-generated-cli\.md --修订--> 260710-use-source-cli\.md/
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("out of sync")
  ));
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  const driftedDecision = currentDecision.replace(
    "title: 使用生成 CLI",
    "title: 使用同步后的生成 CLI"
  );
  await fs.writeFile(currentDecisionPath, driftedDecision, "utf8");
  const driftedList = await runSourceCli([
    "list",
    "--root",
    workspaceRoot
  ]);
  assert.equal(driftedList.exitCode, 0, driftedList.stderr);
  assert.match(driftedList.stdout, /title: 使用生成 CLI/);
  assert.doesNotMatch(driftedList.stdout, /title: 使用同步后的生成 CLI/);
  await runSuccessfulSourceCli([
    "sync-index",
    "--write",
    "--root",
    workspaceRoot
  ]);
  const synchronizedIndex = await readIndex(indexPath);
  const synchronizedEntry = findIndexEntry(
    synchronizedIndex,
    currentRelativePath
  );
  assert.equal(
    synchronizedEntry.title,
    "使用同步后的生成 CLI"
  );
  assert.equal(synchronizedEntry.status, "active");
  assert.equal(synchronizedEntry.alignment, "aligned");
  assert.equal(
    synchronizedEntry.createdAt,
    "2026-07-11T14:15:16+08:00"
  );
  })
));
