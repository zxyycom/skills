import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { metadataEntries } from "./search-metadata-window-fixture.ts";
import {
  currentDecisionId,
  decisionIdForTest,
  readIndex,
  runSourceCli,
  withFixtureWorkspace,
  writeIndex
} from "./support.ts";

test("Decision metadata CLI window exposes defaults custom limits and one overflow warning", async () => {
  await withFixtureWorkspace("metadata-window-cli", async (workspaceRoot) => {
    const original = await readIndex(workspaceRoot);
    const index = {
      ...original,
      entries: { ...original.entries },
      sourceRevision: {
        ...original.sourceRevision,
        entries: { ...original.sourceRevision.entries }
      }
    };
    for (const { id, state } of await metadataEntries(101)) {
      index.entries[decisionIdForTest(id)] = state;
      index.sourceRevision.entries[decisionIdForTest(id)] =
        index.sourceRevision.entries[currentDecisionId]!;
    }
    await writeIndex(
      path.join(workspaceRoot, "docs/decisions/decision-index.json"),
      index
    );
    for (const [limitArgs, returned] of [
      [[], 100],
      [["--limit", "3"], 3],
      [["--limit", "1000"], 101]
    ] as const) {
      const result = await runSourceCli([
        "search",
        "window-needle",
        "--in",
        "metadata",
        "--root",
        workspaceRoot,
        ...limitArgs
      ]);
      assert.equal(result.exitCode, 0, result.stderr);
      assert.match(
        result.stdout,
        new RegExp(`Counts: matched=101 precision=exact returned=${returned}`)
      );
      assert.match(
        result.stdout,
        /Coverage: scan=complete results=(complete|limited) previews=n\/a/
      );
      assert.equal(
        result.stderr,
        returned < 101
          ? "[decision-records.query-warning] search results limited: max-records\n"
          : ""
      );
      assert.equal(result.stdout.match(/^- active /gm)?.length, returned);
    }
  });
  const help = await runSourceCli(["help", "search"]);
  assert.equal(help.exitCode, 0, help.stderr);
  assert.match(help.stdout, /--limit <count>/);
  assert.match(help.stdout, /default: 100, maximum:\s+1000/);
  assert.match(help.stdout, /exact matched counts/);
  assert.match(
    help.stdout,
    /Content keeps its fixed 20-record budget and rejects --limit/
  );
});

test("Decision metadata window rejects invalid limits and content limit arguments before collection failures", async () => {
  for (const value of [
    "0",
    "-1",
    "1.5",
    "1001",
    "01",
    "no",
    "9007199254740992"
  ]) {
    const result = await runSourceCli([
      "search",
      "window-needle",
      "--in",
      "metadata",
      "--limit",
      value
    ]);
    assert.equal(result.exitCode, 2, value);
    assert.equal(result.stdout, "", value);
    assert.match(result.stderr, /limit/);
  }
  for (const args of [
    ["--limit", "1"],
    ["--in", "content", "--limit", "1"],
    ["--in", "metadata", "--limit", "1", "--limit", "2"]
  ]) {
    const result = await runSourceCli(["search", "window-needle", ...args]);
    assert.equal(result.exitCode, 2);
    assert.equal(result.stdout, "");
    assert.match(
      result.stderr,
      /--limit requires --in metadata|must not be repeated/
    );
  }
});
