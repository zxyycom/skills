import { withGitFixtureWorkspace } from "../../support/support-git-fixture.ts";
import { stageDecisionRecords } from "../../../src/staging/decision-stage-service.ts";
import { stageSource, writeStageSources } from "./domain-support.ts";
import { initializeGitRepository } from "../../support/support.ts";
import {
  assert,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fs,
  path,
  runGit,
  test,
  withTemporaryWorkspace,
  writeDecision
} from "./support.ts";

test("stage reports unavailable version control without writing filesystem state", () =>
  withTemporaryWorkspace("stage-no-version-control", async (workspaceRoot) => {
    const id = "use-no-git";
    await writeDecision(
      workspaceRoot,
      id,
      candidateDecisionBody()
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    const source = decisionFilePath(workspaceRoot, id);
    const before = await fs.readFile(source, "utf8");
    const result = await stageDecisionRecords({
      decisionIds: [id],
      location: { workspaceRoot: workspaceRoot, decisionsDir: "docs/decisions" }
    });
    assert.equal(result.status, "error");
    assert.match(
      JSON.stringify(result),
      /version-controlled decision workspace/
    );
    assert.equal(await fs.readFile(source, "utf8"), before);
  }));

test("stage preserves concurrent pending bytes discovered by the replacement CAS", () =>
  withGitFixtureWorkspace("stage-pending-race", async (workspaceRoot) => {
    const concurrentId = "use-concurrent-pending";
    const concurrentBody = candidateDecisionBody({
      id: concurrentId,
      title: "并发 pending 决策"
    });
    const selectedPath = decisionFilePath(workspaceRoot, currentSourcePath);
    const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
    assert.ok(descriptor);
    const readFile = fs.readFile.bind(fs);
    let reads = 0;
    let injected = false;
    Object.defineProperty(fs, "readFile", {
      ...descriptor,
      value: async (
        filePath: string,
        encoding: BufferEncoding
      ): Promise<string> => {
        // Inject after the freshness gate but while the pending snapshot is
        // being read, so the replacement CAS discovers the concurrent bytes.
        if (
          !injected &&
          path.resolve(filePath) === selectedPath &&
          ++reads === 2
        ) {
          injected = true;
          await writeDecision(workspaceRoot, concurrentId, concurrentBody);
          runGit(workspaceRoot, ["add", `docs/decisions/${concurrentId}.md`]);
        }
        return await readFile(filePath, encoding);
      }
    });
    try {
      const staged = await stageDecisionRecords({
        decisionIds: [currentDecisionId],
        location: {
          workspaceRoot: workspaceRoot,
          decisionsDir: "docs/decisions"
        }
      });
      assert.equal(staged.status, "error");
      assert.match(
        JSON.stringify(staged),
        /decision-records\.version-control-pending-conflict/
      );
    } finally {
      Object.defineProperty(fs, "readFile", descriptor);
    }
    assert.equal(injected, true);
    assert.equal(
      runGit(workspaceRoot, ["show", `:docs/decisions/${concurrentId}.md`]),
      concurrentBody
    );
  }));

test("stage rejects a missing ID when bootstrapping without a revision", async () => {
  await withTemporaryWorkspace("stage-missing-bootstrap", async (root) => {
    initializeGitRepository(root);
    await writeStageSources(root, [stageSource("existing")]);
    const before = runGit(root, ["write-tree"]);
    const result = await stageDecisionRecords({
      decisionIds: ["use-missing-bootstrap"],
      location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
    });
    assert.equal(result.status, "error");
    assert.match(JSON.stringify(result), /missing or ambiguous/);
    assert.equal(runGit(root, ["write-tree"]), before);
  });
});
