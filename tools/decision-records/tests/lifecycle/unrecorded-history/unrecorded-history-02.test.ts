import { decisionScanFromSources } from "../../support/domain-fixture.ts";
import { prepareDecisionLifecycle } from "../../../src/lifecycle/decision-lifecycle-service.ts";
import { evolutionRequest } from "../evolution/domain-support.ts";
import { prepareUnrecordedHistoryAttention } from "../../../src/records/history/decision-history-baseline.ts";
import { decisionIdForTest } from "../../support/support-record-fixture.ts";
import {
  assert,
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  establishUnrecordedIntermediate,
  fileExists,
  findIndexEntry,
  fs,
  readIndex,
  runSourceCli,
  test,
  unrecordedIntermediateRelativePath,
  validateDecisionRecords,
  withFixtureWorkspace
} from "./support.ts";

test("evolve pauses for an unrecorded archived direct predecessor", async () => {
  const prior = "use-unrecorded-archived-target";
  const successor = "evolve-from-unrecorded-archived-target";
  const scan = await decisionScanFromSources([
    { id: prior, status: "archived" },
    { id: successor, relations: [{ type: "替代", target: prior }] }
  ]);
  assert.deepEqual(scan.sourceErrors, []);
  const request = evolutionRequest([successor], {
    keepUnrecordedHistory: false
  });
  const baseline = {
    kind: "git-head" as const,
    label: "Git HEAD" as const,
    recordedDecisionIds: new Set<import("../../../src/types.ts").DecisionId>()
  };
  const paused = prepareDecisionLifecycle(scan, request, {
    historyBaseline: baseline
  });
  assert.equal(paused.status, "attention");
  if (paused.status === "attention") {
    assert.match(
      paused.diagnostics[0]?.reason ?? "",
      /Predecessor decision use-unrecorded-archived-target has not entered Git HEAD/
    );
    assert.equal("changes" in paused, false);
  }
  const confirmed = prepareDecisionLifecycle(
    scan,
    { ...request, keepUnrecordedHistory: true },
    {
      historyBaseline: baseline,
      currentTimestamp: () => "2026-10-20T00:00:00Z"
    }
  );
  assert.equal(confirmed.status, "ok");
  if (confirmed.status === "ok") {
    assert.equal(confirmed.changes.length, 1);
    assert.match(confirmed.changes[0]!.nextText ?? "", /status: active/);
    assert.match(
      confirmed.changes[0]!.nextText ?? "",
      /type: 替代\n    target: use-unrecorded-archived-target/
    );
    assert.equal(
      confirmed.changes[0]!.decisionPath.endsWith(successor + ".md"),
      true
    );
  }
});

test("evolve lists unrecorded predecessor warnings in Decision ID order", () => {
  const result = prepareUnrecordedHistoryAttention(
    [
      {
        decisionId: decisionIdForTest("z-unrecorded-predecessor"),
        kind: "relation",
        relationType: "归并"
      },
      {
        decisionId: decisionIdForTest("a-unrecorded-predecessor"),
        kind: "relation",
        relationType: "归并"
      }
    ],
    false,
    { kind: "git-head", label: "Git HEAD", recordedDecisionIds: new Set() }
  );
  assert.ok(result);
  assert.deepEqual(
    result.diagnostics.map((d) => d.target),
    [
      "Decision history for a-unrecorded-predecessor",
      "Decision history for z-unrecorded-predecessor"
    ]
  );
  assert.ok(result.diagnostics.every((d) => d.outcome === "no-change"));
});

test("evolve discards an intermediate with explicit final relations", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-discard",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const beforeDiscard = await readIndex(indexPath);
      assert.equal(
        findIndexEntry(beforeDiscard, currentRelativePath).status,
        "archived"
      );
      assert.deepEqual(
        findIndexEntry(beforeDiscard, unrecordedIntermediateRelativePath)
          .relations,
        [{ type: "修订", target: currentRelativePath }]
      );
      const successorRelativePath = "use-discard-unrecorded-history";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      await fs.writeFile(successorPath, candidateDecisionBody(), "utf8");
      const discarded = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--discard",
        unrecordedIntermediateRelativePath,
        "--relation",
        "修订=" + currentRelativePath,
        "--delete-recorded",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.match(
        discarded.stdout,
        /discarded decision use-unrecorded-intermediate/
      );
      assert.equal(await fileExists(intermediatePath), false);
      const discardedIndex = await readIndex(indexPath);
      assert.equal(
        Object.hasOwn(
          discardedIndex.entries,
          unrecordedIntermediateRelativePath
        ),
        false
      );
      assert.deepEqual(
        findIndexEntry(discardedIndex, successorRelativePath).relations,
        [{ type: "修订", target: currentRelativePath }]
      );
      assert.deepEqual(
        (await validateDecisionRecords({ workspaceRoot })).errors,
        []
      );
    }
  ));
