import { assertEvolutionRejected } from "./domain-support.ts";
import {
  assert,
  candidateDecisionBody,
  decisionFilePath,
  establishClosedSplit,
  fs,
  runSourceLifecycleCli,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("evolve rejects a split extension that omits an existing successor before writing", () =>
  withFixtureWorkspace("evolve-omit-split", async (workspaceRoot) => {
    const established = await establishClosedSplit(workspaceRoot);
    const thirdRelativePath = "omit-existing-split-slice";
    const thirdPath = decisionFilePath(workspaceRoot, thirdRelativePath);
    const thirdCandidate = candidateDecisionBody();
    await fs.writeFile(thirdPath, thirdCandidate, "utf8");
    const indexBefore = await fs.readFile(established.indexPath, "utf8");
    const rejected = await runSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + established.alignedRelativePath,
      "--successor",
      "aligned=" + thirdRelativePath,
      "--relation",
      "拆分=" + established.coarseRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stderr, /selected successor set must equal/);
    assert.match(rejected.stderr, /keep-future-split-slice/);
    assert.equal(await fs.readFile(thirdPath, "utf8"), thirdCandidate);
    assert.equal(await fs.readFile(established.indexPath, "utf8"), indexBefore);
  }));

test("evolve rejects one selected split successor", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "active" },
      { id: "first", relations: [{ type: "拆分", target: "predecessor" }] }
    ],
    ["first"],
    /requires at least two explicitly selected/u
  );
});

test("evolve rejects mixed split and non-split successor relations", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "active" },
      { id: "first", relations: [{ type: "拆分", target: "predecessor" }] },
      { id: "second", relations: [{ type: "修订", target: "predecessor" }] }
    ],
    ["first", "second"],
    /exactly one 拆分 relation and no other/u
  );
});

test("evolve rejects unsupported multi-successor shapes without split relations", async () => {
  await assertEvolutionRejected(
    [{ id: "first" }, { id: "second" }],
    ["first", "second"],
    /supported only by the closed 拆分 strategy/u
  );
});

test("evolve rejects a pure merge with fewer than two predecessors", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "active" },
      { id: "first", relations: [{ type: "归并", target: "predecessor" }] }
    ],
    ["first"],
    /requires at least two predecessors/u
  );
});
