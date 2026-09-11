import assert from "node:assert/strict";
import test from "node:test";
import { stageTestEvidenceIndex, syncTestEvidenceIndex } from "../src/core.ts";
import { commitFixture, exec, fixture, fs, path } from "./core-test-support.ts";

test("stage validates selection before Git and preserves an existing pending index", async () => {
  const root = await fixture();
  const invalid = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["not-a-case-id"]
  });
  assert.equal(invalid.state, "selection-invalid");
  await assert.rejects(fs.lstat(path.join(root, ".git")));
  const unavailable = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(unavailable.state, "revision-read-failed");
  await assert.rejects(
    fs.lstat(path.join(root, "docs/test-evidence/test-evidence-index.json"))
  );

  const stagedRoot = await commitFixture();
  await fs.appendFile(
    path.join(stagedRoot, "docs/test-evidence/cases/access.md"),
    "\n"
  );
  await syncTestEvidenceIndex({ workspaceRoot: stagedRoot, mode: "write" });
  const indexPath = "docs/test-evidence/test-evidence-index.json";
  await exec("git", ["add", indexPath], { cwd: stagedRoot });
  const pending = await exec("git", ["show", `:${indexPath}`], {
    cwd: stagedRoot
  });
  const conflict = await stageTestEvidenceIndex({
    workspaceRoot: stagedRoot,
    caseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(conflict.state, "pending-conflict");
  assert.equal(
    (await exec("git", ["show", `:${indexPath}`], { cwd: stagedRoot })).stdout,
    pending.stdout
  );
});

test("stage overlays only selected Case revisions onto the Git baseline", async () => {
  const root = await commitFixture();
  const indexPath = "docs/test-evidence/test-evidence-index.json";
  const baseline = JSON.parse(
    (await exec("git", ["show", `HEAD:${indexPath}`], { cwd: root })).stdout
  );
  await fs.appendFile(
    path.join(root, "docs/test-evidence/cases/access.md"),
    "\n"
  );
  await fs.appendFile(
    path.join(root, "docs/test-evidence/cases/second.md"),
    "\n"
  );
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const staged = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(staged.status, "ok");
  const overlay = JSON.parse(
    (await exec("git", ["show", `:${indexPath}`], { cwd: root })).stdout
  );
  assert.notEqual(
    overlay.sourceRevision.entries["AUTH-ROLE-ACCESS-001"],
    baseline.sourceRevision.entries["AUTH-ROLE-ACCESS-001"]
  );
  assert.equal(
    overlay.sourceRevision.entries["AUTH-ROLE-ACCESS-002"],
    baseline.sourceRevision.entries["AUTH-ROLE-ACCESS-002"]
  );
});

test("stage supports bootstrap, unchanged selections, missing IDs, and an empty target", async () => {
  const bootstrap = await commitFixture(false);
  await syncTestEvidenceIndex({ workspaceRoot: bootstrap, mode: "write" });
  const bootstrapped = await stageTestEvidenceIndex({
    workspaceRoot: bootstrap,
    caseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(bootstrapped.status, "ok", JSON.stringify(bootstrapped));
  assert.deepEqual(
    Object.keys(
      JSON.parse(
        (
          await exec(
            "git",
            ["show", ":docs/test-evidence/test-evidence-index.json"],
            { cwd: bootstrap }
          )
        ).stdout
      ).entries
    ),
    ["AUTH-ROLE-ACCESS-001"]
  );

  const root = await commitFixture();
  const indexPath = "docs/test-evidence/test-evidence-index.json";
  const cachedBefore = await exec("git", ["show", `:${indexPath}`], {
    cwd: root
  });
  const workingBefore = await fs.readFile(path.join(root, indexPath), "utf8");
  const unchanged = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(unchanged.status, "ok");
  assert.equal(unchanged.state, "unchanged");
  assert.equal(
    (await exec("git", ["diff", "--cached", "--name-only"], { cwd: root }))
      .stdout,
    ""
  );
  const missing = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["AUTH-ROLE-ACCESS-999"]
  });
  assert.equal(missing.state, "selection-invalid");
  assert.ok(
    missing.diagnostics.some(
      (entry) => entry.code === "state-index.selected-id-missing"
    )
  );
  assert.equal(
    await fs.readFile(path.join(root, indexPath), "utf8"),
    workingBefore
  );
  assert.equal(
    (await exec("git", ["show", `:${indexPath}`], { cwd: root })).stdout,
    cachedBefore.stdout
  );

  await fs.rm(path.join(root, "docs/test-evidence/cases/access.md"));
  await fs.rm(path.join(root, "docs/test-evidence/cases/second.md"));
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const emptied = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["AUTH-ROLE-ACCESS-001", "AUTH-ROLE-ACCESS-002"]
  });
  assert.equal(emptied.status, "ok");
  const emptyIndex = JSON.parse(
    (
      await exec(
        "git",
        ["show", ":docs/test-evidence/test-evidence-index.json"],
        { cwd: root }
      )
    ).stdout
  );
  assert.deepEqual(emptyIndex.entries, {});
});
