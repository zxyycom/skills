import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionBody } from "../src/record.ts";
import { decisionScanFromSources } from "./domain-fixture.ts";
import { validateDecisionRecords } from "../src/index.ts";
import { decisionIdFromSourcePath } from "../src/decision-path.ts";
import {
  decisionRelationConsistencyIssues,
  decisionReallocationComponents
} from "../src/relation-graph.ts";
import type { DecisionRelationConsistencyRecord } from "../src/relation-graph.ts";
import { normalizeRelationSummary } from "../src/relation-summary.ts";
import {
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  findIndexEntry,
  readIndex,
  withFixtureWorkspace
} from "./support.ts";

test("reallocation components preserve relation roles and isolate disconnected graphs", () => {
  const firstPredecessor = decisionId("use-first-predecessor.md");
  const secondPredecessor = decisionId("use-second-predecessor.md");
  const thirdPredecessor = decisionId("use-third-predecessor.md");
  const firstSuccessor = decisionId("use-first-successor.md");
  const secondSuccessor = decisionId("use-second-successor.md");
  const thirdSuccessor = decisionId("use-third-successor.md");

  const components = decisionReallocationComponents([
    {
      source: firstSuccessor,
      target: firstPredecessor,
      type: "重划"
    },
    {
      source: firstSuccessor,
      target: secondPredecessor,
      type: "重划"
    },
    {
      source: secondSuccessor,
      target: firstPredecessor,
      type: "重划"
    },
    {
      source: thirdSuccessor,
      target: thirdPredecessor,
      type: "重划"
    }
  ]);

  assert.deepEqual(
    components.map((component) => ({
      predecessors: [...component.predecessorIds].sort(),
      successors: [...component.successorIds].sort()
    })),
    [
      {
        predecessors: [firstPredecessor, secondPredecessor],
        successors: [firstSuccessor, secondSuccessor]
      },
      {
        predecessors: [thirdPredecessor],
        successors: [thirdSuccessor]
      }
    ]
  );
});

test("candidate relations are checked prospectively without entering the established graph", () =>
  withFixtureWorkspace("candidate-relation-preview", async (workspaceRoot) => {
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const targetCandidateRelativePath = "use-candidate-relation-target";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, targetCandidateRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    const candidateRelativePath = "use-forward-looking-relation";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, candidateRelativePath),
      candidateDecisionBody({
        relations: [{ type: "修订", target: targetCandidateRelativePath }]
      }),
      "utf8"
    );

    const validation = await validateDecisionRecords({ workspaceRoot });
    assert.deepEqual(validation.errors, []);
    assert.equal(validation.activationCandidateCount, 2);
    const index = await readIndex(indexPath);
    assert.equal(Object.hasOwn(index.entries, candidateRelativePath), false);
    assert.equal(
      Object.hasOwn(index.entries, targetCandidateRelativePath),
      false
    );
    assert.equal(findIndexEntry(index, currentRelativePath).status, "active");
  }));

test("candidate reallocation relations remain prospective until a complete transaction", async () => {
  const scan = await decisionScanFromSources([
    { id: "predecessor", status: "active" },
    { id: "candidate", relations: [{ type: "重划", target: "predecessor" }] }
  ]);
  assert.deepEqual(scan.sourceErrors, []);
  assert.equal(
    scan.records.filter((record) => record.activationCandidate).length,
    1
  );
  assert.equal(
    scan.records.find((record) => record.decisionId === "predecessor")?.status,
    "active"
  );
});

test("candidate relation validation rejects missing targets", async () => {
  const errors: string[] = [];
  const document = await validateDecisionBody({
    body: candidateDecisionBody({
      id: "candidate",
      relations: [{ type: "修订", target: "missing-target" }]
    }),
    errors,
    sourcePath: "candidate.md",
    targetExists: (target) => target === "predecessor"
  });
  assert.equal(document, null);
  assert.match(errors.join("\n"), /target does not exist/u);
});

test("candidate relation validation rejects self references", async () => {
  const errors: string[] = [];
  const document = await validateDecisionBody({
    body: candidateDecisionBody({
      id: "candidate",
      relations: [{ type: "修订", target: "candidate" }]
    }),
    errors,
    sourcePath: "candidate.md",
    targetExists: (target) => target === "predecessor"
  });
  assert.equal(document, null);
  assert.match(errors.join("\n"), /must not relate to itself/u);
});

test("candidate relation validation rejects repeated targets", async () => {
  const errors: string[] = [];
  const document = await validateDecisionBody({
    body: candidateDecisionBody({
      id: "candidate",
      relations: [
        { type: "修订", target: "predecessor" },
        { type: "替代", target: "predecessor" }
      ]
    }),
    errors,
    sourcePath: "candidate.md",
    targetExists: (target) => target === "predecessor"
  });
  assert.equal(document, null);
  assert.match(errors.join("\n"), /repeats relationship target/u);
});

test("strict relation checks reject undersized pure merges", async () => {
  const scan = await decisionScanFromSources([
    { id: "predecessor", status: "archived" },
    { id: "another-predecessor", status: "archived" },
    {
      id: "successor",
      status: "active",
      relations: [{ type: "归并", target: "predecessor" }]
    }
  ]);
  assert.match(
    scan.sourceErrors.join("\n"),
    /pure 归并 relation set must have at least two/u
  );
});

test("strict relation checks reject open splits", async () => {
  const scan = await decisionScanFromSources([
    { id: "predecessor", status: "archived" },
    { id: "another-predecessor", status: "archived" },
    {
      id: "successor",
      status: "active",
      relations: [{ type: "拆分", target: "predecessor" }]
    }
  ]);
  assert.match(
    scan.sourceErrors.join("\n"),
    /at least two direct 拆分 successors/u
  );
});

test("strict relation checks reject impure split successors", async () => {
  const scan = await decisionScanFromSources([
    { id: "predecessor", status: "archived" },
    { id: "another-predecessor", status: "archived" },
    {
      id: "successor",
      status: "active",
      relations: [
        { type: "拆分", target: "predecessor" },
        { type: "修订", target: "another-predecessor" }
      ]
    }
  ]);
  assert.match(
    scan.sourceErrors.join("\n"),
    /拆分 successor must have exactly one direct 拆分 relation/u
  );
});

test("strict relation checks reject undersized reallocation components", async () => {
  const scan = await decisionScanFromSources([
    { id: "predecessor", status: "archived" },
    { id: "another-predecessor", status: "archived" },
    {
      id: "successor",
      status: "active",
      relations: [{ type: "重划", target: "predecessor" }]
    }
  ]);
  assert.match(
    scan.sourceErrors.join("\n"),
    /重划 component must have at least two direct/u
  );
});

function decisionId(value: string) {
  const decisionId = decisionIdFromSourcePath(value);
  if (decisionId === null) {
    throw new Error("Expected a valid Decision ID: " + value);
  }
  return decisionId;
}

test("relation summaries normalize blank input and enforce the Unicode single-line boundary", () => {
  assert.deepEqual(normalizeRelationSummary(" \t "), {});
  assert.deepEqual(normalizeRelationSummary(" \n "), {});
  assert.deepEqual(normalizeRelationSummary("  保留=原因  "), {
    summary: "保留=原因"
  });
  assert.deepEqual(normalizeRelationSummary("😀".repeat(40)), {
    summary: "😀".repeat(40)
  });
  assert.match(
    relationSummaryIssue(normalizeRelationSummary("😀".repeat(41))),
    /at most 40 Unicode code points/u
  );
  assert.match(
    relationSummaryIssue(normalizeRelationSummary("first\nsecond")),
    /single-line/u
  );
});

function relationSummaryIssue(
  result: ReturnType<typeof normalizeRelationSummary>
): string {
  assert.ok("issue" in result);
  return result.issue;
}

test("decision graph accepts deep archived revision chains and preserves late-cycle source identities", () => {
  const ids = Array.from({ length: 12000 }, (_, i) =>
    decisionId(`chain-${String(i).padStart(5, "0")}.md`)
  );
  const records: DecisionRelationConsistencyRecord[] = ids.map((id, i) => ({
    decisionId: id,
    sourcePath: `archive/${id}.md`,
    status: "archived",
    projection: {
      title: "链节点",
      purpose: "验证合法深链",
      background: "共享结构验证",
      decision: "沿直接前序演进",
      relations:
        i + 1 === ids.length ? [] : [{ target: ids[i + 1]!, type: "修订" }]
    }
  }));
  assert.deepEqual(decisionRelationConsistencyIssues(records), []);
  records[11999]!.projection.relations = [
    { target: ids[11997]!, type: "修订" }
  ];
  assert.deepEqual(decisionRelationConsistencyIssues(records), [
    {
      message:
        "Decision relations must not form a cycle: chain-11997 -> chain-11998 -> chain-11999 -> chain-11997",
      sourceIds: [ids[11997], ids[11998], ids[11999]]
    }
  ]);
});
