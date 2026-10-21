import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { unrecordedPredecessorWarnings } from "../src/validation-history.ts";
import { unrecordedPredecessorWarnings as distributedWarnings } from "../../../skills/investigation-report/scripts/runtime/tools/investigation-report/src/validation-history.ts";
import { loadInvestigationIndex } from "../src/investigation-state-index.ts";
import { investigationRoot, withTempRoot } from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";
import { git, initializeGit } from "./git-support.ts";
import {
  runGeneratedInvestigationCliSmoke,
  type InvestigationCliResult
} from "./cli-support.ts";

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

test("history predecessor checks batch large HEAD source lists in source and distribution", async () => {
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
      names.map((name) => `100644 blob ${blob}\t${name}\n`).join("")
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
      queries.length > 2,
      "the real CLI must split history path queries"
    );
    assert.ok(queries.every((line) => Buffer.byteLength(line) < 28_000));
  });
});
