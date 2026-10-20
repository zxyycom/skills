import { withGitFixtureWorkspace } from "../support-git-fixture.ts";
import { stageDecisionRecords } from "../../src/decision-stage-service.ts";
import { stageTarget } from "./domain-support.ts";
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

test("stage rejects selected source drift before replacing the pending snapshot", async () => {
  for (const mutation of ["change"] as const) {
    await withGitFixtureWorkspace(
      `stage-selected-drift-${mutation}`,
      async (workspaceRoot) => {
        const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
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
            if (path.resolve(filePath) === sourcePath && ++reads === 3) {
              injected = true;
              if (mutation === "change") {
                await fs.writeFile(
                  sourcePath,
                  (await readFile(sourcePath, "utf8")).replace(
                    "使用生成 CLI",
                    "并发改写 CLI"
                  ),
                  "utf8"
                );
              } else if (mutation === "delete") {
                await fs.rm(sourcePath);
              } else {
                await fs.rename(
                  sourcePath,
                  decisionFilePath(
                    workspaceRoot,
                    `archive/${currentDecisionId}`
                  )
                );
              }
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
            /changed before staging|changed after snapshot|failed to verify selected/i
          );
        } finally {
          Object.defineProperty(fs, "readFile", descriptor);
        }
        assert.equal(injected, true, mutation);
        assert.equal(
          runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
          ""
        );
      }
    );
  }
});

test("stage rejects a missing ID when bootstrapping without a revision", async () => {
  await assert.rejects(
    stageTarget([], [], ["use-missing-bootstrap"]),
    /Selected Decision name does not exist/
  );
});
