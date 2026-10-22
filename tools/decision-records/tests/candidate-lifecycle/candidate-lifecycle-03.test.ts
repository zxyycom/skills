import { withGitFixtureWorkspace } from "../support-git-fixture.ts";
import { decisionScanFromSources } from "../domain-fixture.ts";
import { prepareDecisionLifecycle } from "../../src/decision-lifecycle-service.ts";
import { decisionIdForTest } from "../support-record-fixture.ts";
import {
  assert,
  candidateDecisionBody,
  commitWorkspace,
  currentRelativePath,
  decisionFilePath,
  fileExists,
  fs,
  path,
  runSourceCli,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("discard accepts a candidate with a valid active-target relation", () =>
  withFixtureWorkspace(
    "candidate-discard-active-target",
    async (workspaceRoot) => {
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json"
      );
      const originalIndexText = await fs.readFile(indexPath, "utf8");
      const sourceRelativePath = "use-active-target-discard-source";
      const sourcePath = decisionFilePath(workspaceRoot, sourceRelativePath);
      await fs.writeFile(
        sourcePath,
        candidateDecisionBody({
          relations: [{ type: "修订", target: currentRelativePath }]
        }),
        "utf8"
      );

      const discarded = await runSourceCli([
        "discard",
        sourceRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(sourcePath), false);
      assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
    }
  ));

test("discard pauses before deleting a candidate recorded in Git HEAD", () =>
  withGitFixtureWorkspace(
    "candidate-discard-selection",
    async (workspaceRoot) => {
      const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
      const indexPath = path.join(decisionsDirectory, "decision-index.json");
      const originalIndexText = await fs.readFile(indexPath, "utf8");
      const otherCandidateRelativePath = "use-other-valid-candidate";
      const otherCandidatePath = decisionFilePath(
        workspaceRoot,
        otherCandidateRelativePath
      );
      const otherCandidateText = candidateDecisionBody();
      await fs.writeFile(otherCandidatePath, otherCandidateText, "utf8");
      const discardedRelativePath = "use-discarded-candidate";
      const discardedPath = decisionFilePath(
        workspaceRoot,
        discardedRelativePath
      );
      await fs.writeFile(discardedPath, candidateDecisionBody(), "utf8");
      commitWorkspace(workspaceRoot, "record candidate scaffolds");
      const candidateCheck = await runSourceCli([
        "check",
        "--root",
        workspaceRoot
      ]);
      assert.equal(candidateCheck.exitCode, 0, candidateCheck.stderr);
      assert.equal(candidateCheck.stderr, "");
      assert.match(candidateCheck.stdout, /2 candidate scaffolds/);
      const paused = await runSourceCli([
        "discard",
        discardedRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(paused.exitCode, 1);
      assert.match(paused.stderr, /Decision .* has entered Git HEAD/i);
      assert.match(paused.stderr, /--delete-recorded/);
      assert.equal(
        await fs.readFile(discardedPath, "utf8"),
        candidateDecisionBody()
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
      const discarded = await runSourceCli([
        "discard",
        discardedRelativePath,
        "--delete-recorded",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.match(discarded.stdout, /Discarded decision/);
      assert.match(discarded.stderr, /use-other-valid-candidate\.md/);
      assert.equal(await fileExists(discardedPath), false);
      assert.equal(
        await fs.readFile(otherCandidatePath, "utf8"),
        otherCandidateText
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
      await fs.rm(otherCandidatePath);
    }
  ));

test("discard deletes candidates omitted from the recorded baseline", async () => {
  const sourceId = "use-unrecorded-discard-candidate";
  const scan = await decisionScanFromSources([
    { id: sourceId },
    { id: "recorded", status: "active" }
  ]);
  assert.deepEqual(scan.sourceErrors, []);
  const prepared = prepareDecisionLifecycle(
    scan,
    {
      action: "discard",
      decisionId: decisionIdForTest(sourceId),
      deleteRecorded: false
    },
    {
      historyBaseline: {
        kind: "git-head",
        label: "Git HEAD",
        recordedDecisionIds: new Set([decisionIdForTest("recorded")])
      }
    }
  );
  assert.equal(prepared.status, "ok", JSON.stringify(prepared));
  if (prepared.status !== "ok") throw new Error("Expected unrecorded deletion");
  assert.equal(scan.records[0]!.source.kind, "candidate");
  if (scan.records[0]!.source.kind !== "candidate")
    throw new Error("Expected candidate source");
  assert.deepEqual(prepared.changes, [
    {
      decisionPath: scan.records[0]!.decisionPath,
      expectedText: scan.records[0]!.source.text,
      nextText: null
    }
  ]);
  await withFixtureWorkspace(
    "candidate-discard-unrecorded",
    async (workspaceRoot) => {
      const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
      const indexPath = path.join(decisionsDirectory, "decision-index.json");
      const originalIndexText = await fs.readFile(indexPath, "utf8");

      const sourceRelativePath = "use-unrecorded-discard-candidate";
      const sourcePath = decisionFilePath(workspaceRoot, sourceRelativePath);
      await fs.writeFile(sourcePath, candidateDecisionBody(), "utf8");
      const discarded = await runSourceCli([
        "discard",
        sourceRelativePath,
        "--root",
        workspaceRoot
      ]);

      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(sourcePath), false);
      assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
    }
  );
});
