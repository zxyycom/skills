import { createCliProgram } from "../../../src/cli/arguments/cli-args.ts";
import { resolveDecisionLifecycleRequest } from "../../../src/cli/commands/cli-lifecycle-selection.ts";
import {
  prepareDecisionLifecycle,
  requiresDecisionHistoryBaseline
} from "../../../src/lifecycle/decision-lifecycle-service.ts";
import { printDecisionAttention } from "../../../src/cli/output/cli-output.ts";
import { decisionScanFromSources } from "../../support/domain-fixture.ts";
import { decisionIdForTest } from "../../support/support-record-fixture.ts";
import path from "node:path";
import {
  archivedRelativePath,
  assert,
  candidateDecisionBody,
  decisionFilePath,
  establishUnrecordedIntermediate,
  fileExists,
  findIndexEntry,
  fs,
  readIndex,
  runSourceCli,
  test,
  unrecordedIntermediateRelativePath,
  withFixtureWorkspace
} from "./support.ts";

test("evolve discard accepts source-empty final relations", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-implicit-empty",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const successorRelativePath = "accept-source-empty-discard";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      const successorCandidate = candidateDecisionBody();
      await fs.writeFile(successorPath, successorCandidate, "utf8");
      const discarded = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--discard",
        unrecordedIntermediateRelativePath,
        "--delete-recorded",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(intermediatePath), false);
      assert.deepEqual(
        findIndexEntry(await readIndex(indexPath), successorRelativePath)
          .relations,
        []
      );
    }
  ));

test("evolve discard accepts an unrelated archived final relation", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-relation-boundary",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const successorRelativePath = "accept-unrelated-discard-upstream";
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
        "修订=" + archivedRelativePath,
        "--delete-recorded",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(intermediatePath), false);
      assert.deepEqual(
        findIndexEntry(await readIndex(indexPath), successorRelativePath)
          .relations,
        [{ type: "修订", target: archivedRelativePath }]
      );
    }
  ));

test("evolve discard pauses before preparing deletion of a recorded decision", async () => {
  const scan = await decisionScanFromSources([
    { id: "prior", status: "archived" },
    {
      id: "intermediate",
      status: "active",
      relations: [{ type: "修订", target: "prior" }]
    },
    { id: "successor" }
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
      assert.equal(args.discardId, "intermediate");
      assert.equal(args.deleteRecorded, false);
      assert.equal(args.keepUnrecordedHistory, false);
      const selected = resolveDecisionLifecycleRequest(scan, {
        ...args,
        action: "evolve"
      });
      assert.equal(selected.status, "ok", JSON.stringify(selected));
      if (selected.status !== "ok")
        throw new Error("Expected resolved evolution");
      assert.equal(
        requiresDecisionHistoryBaseline(scan, selected.request),
        true
      );
      const paused = prepareDecisionLifecycle(scan, selected.request, {
        historyBaseline: {
          kind: "git-head",
          label: "Git HEAD",
          recordedDecisionIds: new Set(
            ["prior", "intermediate"].map(decisionIdForTest)
          )
        }
      });
      assert.equal(paused.status, "attention", JSON.stringify(paused));
      if (paused.status !== "attention")
        throw new Error("Expected recorded deletion attention");
      assert.equal("changes" in paused, false);
      assert.equal("relationReview" in paused, false);
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
    "aligned=successor",
    "--discard",
    "intermediate",
    "--relation",
    "修订=prior"
  ]);
  assert.equal(exitCode, 1);
  assert.equal(stdout, "");
  assert.match(stderr, /has entered Git HEAD/);
  assert.match(stderr, /--delete-recorded/);
});

test("evolve discard flag prepares deletion and establishment without a history baseline", async () => {
  const scan = await decisionScanFromSources([
    { id: "intermediate", status: "active" },
    { id: "successor" }
  ]);
  assert.deepEqual(scan.sourceErrors, []);
  let exitCode = -1;
  const program = createCliProgram(
    async (args) => {
      assert.equal(args.command, "evolve");
      if (args.command !== "evolve")
        throw new Error("Expected evolution dispatch");
      assert.equal(args.discardId, "intermediate");
      assert.equal(args.deleteRecorded, true);
      assert.equal(args.keepUnrecordedHistory, false);
      assert.deepEqual(args.relationOverride, { kind: "source" });
      const selected = resolveDecisionLifecycleRequest(scan, {
        ...args,
        action: "evolve"
      });
      assert.equal(selected.status, "ok", JSON.stringify(selected));
      if (selected.status !== "ok")
        throw new Error("Expected resolved evolution");
      assert.equal(
        requiresDecisionHistoryBaseline(scan, selected.request),
        false
      );
      const prepared = prepareDecisionLifecycle(scan, selected.request, {
        historyBaseline: null,
        currentTimestamp: () => "2026-10-20T00:00:00Z"
      });
      assert.equal(prepared.status, "ok", JSON.stringify(prepared));
      if (prepared.status !== "ok")
        throw new Error("Expected deletion and establishment plan");
      assert.equal(prepared.changes.length, 2);
      const discarded = prepared.changes.find(
        (change) => path.basename(change.decisionPath) === "intermediate.md"
      );
      assert.equal(discarded?.nextText, null);
      const successor = prepared.changes.find(
        (change) => path.basename(change.decisionPath) === "successor.md"
      );
      assert.match(successor?.nextText ?? "", /status: active/);
      assert.match(successor?.nextText ?? "", /relations: \[\]/);
      assert.deepEqual(
        prepared.relationReview?.sources.map((source) => source.after),
        [[]]
      );
      return 0;
    },
    (code) => {
      exitCode = code;
    },
    { io: { stdout: () => {}, stderr: () => {} } }
  );
  await program.parseAsync([
    "node",
    "decision-records.ts",
    "evolve",
    "--successor",
    "aligned=successor",
    "--discard",
    "intermediate",
    "--delete-recorded"
  ]);
  assert.equal(exitCode, 0);
});
