import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { unrecordedPredecessorWarnings } from "../../src/records/validation/validation-history.ts";
import { unrecordedPredecessorWarnings as distributedWarnings } from "../../../../skills/investigation-report/scripts/runtime/tools/investigation-report/src/records/validation/validation-history.ts";
import { loadInvestigationIndex } from "../../src/index/investigation-state-index.ts";
import { investigationRoot, withTempRoot } from "../support/fixture-support.ts";
import { writeCollection } from "../support/collection-support.ts";
import { git, initializeGit } from "../support/git-support.ts";
import {
  runGeneratedInvestigationCliSmoke,
  type InvestigationCliResult
} from "../cli/cli-support.ts";

function gitWithInput(
  root: string,
  args: readonly string[],
  input: string
): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    input,
    windowsHide: true
  }).trim();
}

test("history predecessor checks read only indexed predecessors despite large unrelated HEAD namespaces", async () => {
  await withTempRoot("history-pathspec-batching", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      { id: "next", relations: [{ type: "补充", target: "base" }] }
    ]);
    initializeGit(root);
    const blob = gitWithInput(
      root,
      ["hash-object", "-w", "--stdin"],
      "legacy report\n"
    );
    const baseBlob = git(root, [
      "rev-parse",
      "HEAD:docs/investigations/base.md"
    ]).trim();
    const indexBlob = git(root, [
      "rev-parse",
      "HEAD:docs/investigations/investigation-index.json"
    ]).trim();
    const names = [
      "base.md",
      ...Array.from(
        { length: 200 },
        (_, index) => `report-${index}-${"x".repeat(200)}.md`
      )
    ];
    const reportsTree = gitWithInput(
      root,
      ["mktree"],
      names
        .map(
          (name) =>
            `100644 blob ${name === "base.md" ? baseBlob : blob}\t${name}\n`
        )
        .join("") + `100644 blob ${indexBlob}\tinvestigation-index.json\n`
    );
    const docsTree = gitWithInput(
      root,
      ["mktree"],
      `040000 tree ${reportsTree}\tinvestigations\n`
    );
    const tree = gitWithInput(
      root,
      ["mktree"],
      `040000 tree ${docsTree}\tdocs\n`
    );
    const revision = gitWithInput(
      root,
      ["commit-tree", tree, "-p", git(root, ["rev-parse", "HEAD"]).trim()],
      "large history source list\n"
    );
    git(root, ["update-ref", "HEAD", revision]);
    const loaded = await loadInvestigationIndex({
      investigationsDirectory: investigationRoot(root)
    });
    assert.equal(loaded.status, "ok");
    if (loaded.status !== "ok") return;
    const states = new Map(Object.entries(loaded.value.entries));
    assert.deepEqual(
      await unrecordedPredecessorWarnings(investigationRoot(root), states),
      []
    );
    assert.deepEqual(
      await distributedWarnings(investigationRoot(root), states),
      []
    );
    const tracePath = path.join(root, "cli-git-trace.jsonl");
    const previousTrace = process.env.GIT_TRACE2_EVENT;
    process.env.GIT_TRACE2_EVENT = tracePath;
    let terminal: InvestigationCliResult;
    try {
      terminal = runGeneratedInvestigationCliSmoke(root, ["check"]);
    } finally {
      if (previousTrace === undefined) delete process.env.GIT_TRACE2_EVENT;
      else process.env.GIT_TRACE2_EVENT = previousTrace;
    }
    assert.equal(terminal.status, 0, terminal.stderr);
    assert.match(terminal.stdout, /2 reports checked; full index current/u);
    assert.doesNotMatch(
      terminal.stderr,
      /history-check-unavailable|E2BIG|ENAMETOOLONG|前序报告 base 尚未进入/u
    );
    const queries = (await fs.readFile(tracePath, "utf8"))
      .split("\n")
      .filter(
        (line) => line.includes('"event":"start"') && line.includes('"ls-tree"')
      );
    assert.ok(
      queries.length <= 5,
      "the real CLI locates only its historical index and selected predecessor"
    );
    assert.ok(queries.every((line) => Buffer.byteLength(line) < 28_000));
  });
});

test("HEAD predecessor verification batches many real report payloads at the domain entry", async () => {
  await withTempRoot("history-many-predecessors", async (root) => {
    const ids = Array.from({ length: 30 }, (_, i) => `base-${i}`);
    await writeCollection(root, [
      ...ids.map((id) => ({ id })),
      ...ids.map((target, index) => ({
        id: `next-${index}`,
        relations: [{ type: "补充" as const, target }]
      }))
    ]);
    initializeGit(root);
    const loaded = await loadInvestigationIndex({
      investigationsDirectory: investigationRoot(root)
    });
    assert.equal(loaded.status, "ok");
    if (loaded.status !== "ok") return;
    const trace = path.join(root, "history-many-trace.jsonl");
    const previous = process.env.GIT_TRACE2_EVENT;
    process.env.GIT_TRACE2_EVENT = trace;
    try {
      assert.deepEqual(
        await unrecordedPredecessorWarnings(
          investigationRoot(root),
          new Map(Object.entries(loaded.value.entries))
        ),
        []
      );
    } finally {
      if (previous === undefined) delete process.env.GIT_TRACE2_EVENT;
      else process.env.GIT_TRACE2_EVENT = previous;
    }
    const starts = (await fs.readFile(trace, "utf8"))
      .split("\n")
      .filter((line) => line.includes('"event":"start"'));
    assert.ok(starts.filter((line) => line.includes('"ls-tree"')).length <= 2);
    assert.ok(starts.filter((line) => line.includes('"cat-file"')).length <= 2);
  });
});
