import { createCliProgram } from "../../../src/cli/arguments/cli-args.ts";
import { resolveDecisionLifecycleRequest } from "../../../src/cli/commands/cli-lifecycle-selection.ts";
import {
  prepareDecisionLifecycle,
  requiresDecisionHistoryBaseline
} from "../../../src/lifecycle/decision-lifecycle-service.ts";
import { printDecisionAttention } from "../../../src/cli/output/cli-output.ts";
import { decisionScanFromSources } from "../../support/domain-fixture.ts";
import { decisionIdForTest } from "../../support/support-record-fixture.ts";
import {
  assert,
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  establishUnrecordedIntermediate,
  fs,
  runSourceCli,
  test,
  unrecordedIntermediateRelativePath,
  withFixtureWorkspace
} from "./support.ts";

test("evolve discard flag still pauses for an unrecorded final predecessor", async () => {
  const scan = await decisionScanFromSources([
    { id: "intermediate", status: "active" },
    { id: "use-unrecorded-final-predecessor", status: "active" },
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
      assert.equal(args.deleteRecorded, true);
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
          recordedDecisionIds: new Set([decisionIdForTest("intermediate")])
        }
      });
      assert.equal(paused.status, "attention", JSON.stringify(paused));
      if (paused.status !== "attention")
        throw new Error("Expected predecessor history attention");
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
    "aligned=successor",
    "--discard",
    "intermediate",
    "--delete-recorded",
    "--relation",
    "修订=use-unrecorded-final-predecessor"
  ]);
  assert.equal(exitCode, 1);
  assert.equal(stdout, "");
  assert.match(
    stderr,
    /Predecessor decision use-unrecorded-final-predecessor has not entered Git HEAD/
  );
  assert.match(stderr, /--keep-unrecorded-history/);
});

test("evolve discard leaves an unselected candidate reference for its later publication", () =>
  withFixtureWorkspace(
    "referenced-evolution-discard",
    async (workspaceRoot) => {
      const { intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const referencingRelativePath = "reference-unrecorded-intermediate";
      const referencingPath = decisionFilePath(
        workspaceRoot,
        referencingRelativePath
      );
      const referencingCandidate = candidateDecisionBody({
        relations: [
          { type: "修订", target: unrecordedIntermediateRelativePath }
        ]
      });
      await fs.writeFile(referencingPath, referencingCandidate, "utf8");
      const successorRelativePath = "reject-referenced-discard";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      const successorCandidate = candidateDecisionBody();
      await fs.writeFile(successorPath, successorCandidate, "utf8");

      const rejected = await runSourceCli([
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
      assert.equal(rejected.exitCode, 0, rejected.stderr);
      assert.match(await fs.readFile(successorPath, "utf8"), /status: active/);
      assert.equal(
        await fs.readFile(referencingPath, "utf8"),
        referencingCandidate
      );
      await assert.rejects(fs.access(intermediatePath), { code: "ENOENT" });
      const later = await runSourceCli([
        "publish",
        referencingRelativePath,
        "--alignment",
        "aligned",
        "--root",
        workspaceRoot
      ]);
      assert.equal(later.exitCode, 1);
      assert.match(
        later.stderr,
        new RegExp(unrecordedIntermediateRelativePath)
      );
      assert.equal(
        await fs.readFile(referencingPath, "utf8"),
        referencingCandidate
      );
    }
  ));
