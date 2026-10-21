import assert from "node:assert/strict";
import test from "node:test";
import { createCliProgram } from "../../src/cli-args.ts";
import { resolveDecisionLifecycleRequest } from "../../src/cli-lifecycle-selection.ts";
import {
  prepareDecisionLifecycle,
  requiresDecisionHistoryBaseline
} from "../../src/decision-lifecycle-service.ts";
import { printDecisionAttention } from "../../src/cli-output.ts";
import { decisionScanFromSources } from "../domain-fixture.ts";
import { decisionIdForTest } from "../support-record-fixture.ts";

test("evolve probes group-only predecessors before preparing changes", async () => {
  const scan = await decisionScanFromSources([
    { id: "use-unrecorded-intermediate", status: "active" },
    { id: "grouped-unrecorded-successor" }
  ]);
  assert.deepEqual(scan.sourceErrors, []);
  let stdout = "";
  let stderr = "";
  let exitCode = -1;
  const io = {
    stdout: (text: string) => {
      stdout += text;
    },
    stderr: (text: string) => {
      stderr += text;
    }
  };
  const program = createCliProgram(
    async (args) => {
      assert.equal(args.command, "evolve");
      if (args.command !== "evolve")
        throw new Error("Expected evolution dispatch");
      assert.deepEqual(args.relationOverride, { kind: "source" });
      assert.equal(args.relationOverrideGroups.length, 1);
      assert.equal(args.keepUnrecordedHistory, false);
      const selected = resolveDecisionLifecycleRequest(scan, {
        ...args,
        action: "evolve"
      });
      assert.equal(selected.status, "ok", JSON.stringify(selected));
      if (selected.status !== "ok" || selected.request.action !== "evolve")
        throw new Error("Expected resolved evolution");
      assert.deepEqual(selected.request.successors[0]?.relationOverride, {
        kind: "replace",
        relations: [
          {
            type: "修订",
            target: decisionIdForTest("use-unrecorded-intermediate")
          }
        ]
      });
      assert.equal(
        requiresDecisionHistoryBaseline(scan, selected.request),
        true
      );
      const paused = prepareDecisionLifecycle(scan, selected.request, {
        historyBaseline: {
          kind: "git-head",
          label: "Git HEAD",
          recordedDecisionIds: new Set()
        }
      });
      assert.equal(paused.status, "attention", JSON.stringify(paused));
      if (paused.status !== "attention")
        throw new Error("Expected grouped predecessor attention");
      assert.equal("changes" in paused, false);
      assert.equal("relationReview" in paused, false);
      assert.equal(
        paused.diagnostics.every(
          (diagnostic) => diagnostic.outcome === "no-change"
        ),
        true
      );
      printDecisionAttention(paused, io);
      return paused.exitCode;
    },
    (code) => {
      exitCode = code;
    },
    { io }
  );
  await program.parseAsync([
    "node",
    "decision-records.ts",
    "evolve",
    "--successor",
    "aligned=grouped-unrecorded-successor",
    "--source",
    "grouped-unrecorded-successor",
    "--relation",
    "修订=use-unrecorded-intermediate"
  ]);
  assert.equal(exitCode, 1);
  assert.equal(stdout, "");
  assert.match(stderr, /command paused with warnings/);
  assert.match(
    stderr,
    /Predecessor decision use-unrecorded-intermediate has not entered Git HEAD/
  );
});
