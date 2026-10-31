import { isEstablishedDecisionRecord } from "../../../src/types.ts";
import { decisionScanFromSources } from "../../support/domain-fixture.ts";
import {
  decisionReallocationComponents,
  decisionRelationConsistencyIssues
} from "../../../src/relations/relation-graph.ts";
import { assertLifecycleRejected, evolutionRequest } from "./domain-support.ts";
import { decisionIdForTest } from "../../support/support-record-fixture.ts";
import {
  assert,
  candidateDecisionBody,
  decisionFilePath,
  establishClosedSplit,
  findIndexEntry,
  fs,
  readIndex,
  runSuccessfulSourceLifecycleCli,
  test,
  validateDecisionRecords,
  withFixtureWorkspace
} from "./support.ts";

test("evolve keeps a later reallocation separate from its archived predecessor event", async () => {
  const scan = await decisionScanFromSources([
    { id: "prior-a", status: "archived" },
    { id: "prior-b", status: "archived" },
    {
      id: "old-combined",
      status: "archived",
      relations: [
        { type: "重划", target: "prior-a" },
        { type: "重划", target: "prior-b" }
      ]
    },
    {
      id: "old-narrow",
      status: "active",
      relations: [{ type: "重划", target: "prior-a" }]
    },
    { id: "later-prior", status: "archived" },
    {
      id: "later-combined",
      status: "active",
      relations: [
        { type: "重划", target: "old-combined" },
        { type: "重划", target: "later-prior" }
      ]
    },
    {
      id: "later-narrow",
      status: "active",
      relations: [{ type: "重划", target: "old-combined" }]
    }
  ]);
  assert.deepEqual(scan.sourceErrors, []);
  assert.deepEqual(
    decisionRelationConsistencyIssues(
      scan.records.filter(isEstablishedDecisionRecord).map((record) => ({
        ...record,
        decisionId: decisionIdForTest(record.decisionId)
      }))
    ),
    []
  );
  const components = decisionReallocationComponents(
    scan.records.flatMap((record) =>
      record.projection.relations.map((relation) => ({
        source: decisionIdForTest(record.decisionId),
        target: relation.target,
        type: relation.type
      }))
    )
  );
  assert.deepEqual(
    components
      .map((c) => ({
        predecessors: [...c.predecessorIds].sort(),
        successors: [...c.successorIds].sort()
      }))
      .sort((a, b) =>
        a.predecessors.join().localeCompare(b.predecessors.join())
      ),
    [
      {
        predecessors: ["later-prior", "old-combined"],
        successors: ["later-combined", "later-narrow"]
      },
      {
        predecessors: ["prior-a", "prior-b"],
        successors: ["old-combined", "old-narrow"]
      }
    ]
  );
});

test("discard rejects a split successor that would leave an open split", async () => {
  await assertLifecycleRejected(
    [
      { id: "coarse", status: "archived" },
      {
        id: "first",
        status: "active",
        relations: [{ type: "拆分", target: "coarse" }]
      },
      {
        id: "second",
        status: "active",
        relations: [{ type: "拆分", target: "coarse" }]
      }
    ],
    {
      action: "discard",
      decisionId: decisionIdForTest("first"),
      deleteRecorded: true
    },
    /split target must have at least two direct/
  );
});

test("evolve discards one split successor when it replaces the complete closure", () =>
  withFixtureWorkspace(
    "evolve-replace-split-successor",
    async (workspaceRoot) => {
      const established = await establishClosedSplit(workspaceRoot);
      const replacementRelativePath = "replace-current-split-slice";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, replacementRelativePath),
        candidateDecisionBody(),
        "utf8"
      );

      await runSuccessfulSourceLifecycleCli([
        "evolve",
        "--successor",
        "unaligned=" + established.unalignedRelativePath,
        "--successor",
        "aligned=" + replacementRelativePath,
        "--source",
        established.unalignedRelativePath,
        "--relation",
        "拆分=" + established.coarseRelativePath,
        "--source",
        replacementRelativePath,
        "--relation",
        "拆分=" + established.coarseRelativePath,
        "--discard",
        established.alignedRelativePath,
        "--delete-recorded",
        "--root",
        workspaceRoot
      ]);

      const index = await readIndex(established.indexPath);
      assert.equal(
        Object.hasOwn(index.entries, established.alignedRelativePath),
        false
      );
      assert.deepEqual(
        findIndexEntry(index, replacementRelativePath).relations,
        [{ type: "拆分", target: established.coarseRelativePath }]
      );
      assert.deepEqual(
        (await validateDecisionRecords({ workspaceRoot })).errors,
        []
      );
    }
  ));

test("evolve adds a split successor only when every existing successor is selected", () =>
  withFixtureWorkspace("evolve-extend-split", async (workspaceRoot) => {
    const established = await establishClosedSplit(workspaceRoot);
    const thirdRelativePath = "add-third-split-slice";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, thirdRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    await runSuccessfulSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + established.alignedRelativePath,
      "--successor",
      "unaligned=" + established.unalignedRelativePath,
      "--successor",
      "aligned=" + thirdRelativePath,
      "--relation",
      "拆分=" + established.coarseRelativePath,
      "--root",
      workspaceRoot
    ]);
    const index = await readIndex(established.indexPath);
    assert.deepEqual(findIndexEntry(index, thirdRelativePath).relations, [
      {
        type: "拆分",
        target: established.coarseRelativePath
      }
    ]);
    assert.deepEqual(
      (await validateDecisionRecords({ workspaceRoot })).errors,
      []
    );
  }));

test("evolve rejects a discarded Decision ID selected as a successor without mutation", async () => {
  await assertLifecycleRejected(
    [{ id: "formal", status: "active" }],
    evolutionRequest(["formal"], { discardId: decisionIdForTest("formal") }),
    /Discarded Decision ID must not also be a successor/
  );
});
