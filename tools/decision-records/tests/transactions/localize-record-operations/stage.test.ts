import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pendingObjectPath } from "../../../../shared/tests/record-stage-evidence.ts";
import {
  a,
  b,
  fixture,
  formal,
  stage,
  sync
} from "../../support/support-local-contracts.ts";
import {
  candidateDecisionBody,
  decisionFilePath,
  runGit,
  withTemporaryWorkspace
} from "../../support/support.ts";

const indexPath = (root: string) =>
  path.join(root, "docs/decisions/decision-index.json");

test("Decision domain stage preserves an unreadable caller-owned pending index when HEAD and workspace locate the selection", async () => {
  await withTemporaryWorkspace(
    "domain-unneeded-index-payload",
    async (root) => {
      await fixture(root, true);
      await formal(root, a, "选择来源新版本");
      await sync(root);
      const index = await fs.readFile(indexPath(root));
      await fs.writeFile(
        indexPath(root),
        "caller-owned missing pending index payload\n"
      );
      runGit(root, ["add", "docs/decisions/decision-index.json"]);
      await fs.writeFile(indexPath(root), index);
      await fs.unlink(
        pendingObjectPath(root, "docs/decisions/decision-index.json")
      );
      const pendingIndex = runGit(root, [
        "ls-files",
        "--stage",
        "docs/decisions/decision-index.json"
      ]);
      const result = await stage(root, [a], "domain");
      assert.equal(result.status, "ok", JSON.stringify(result));
      assert.equal(
        runGit(root, [
          "ls-files",
          "--stage",
          "docs/decisions/decision-index.json"
        ]),
        pendingIndex
      );
      assert.match(
        runGit(root, ["show", ":docs/decisions/" + a + ".md"]),
        /选择来源新版本/
      );
      assert.deepEqual(await fs.readFile(indexPath(root)), index);
    }
  );
});
test("Decision domain stage deletes a canonical pending-only source without requiring a valid pending index", async () => {
  for (const missingPayload of [false, true]) {
    await withTemporaryWorkspace(
      "domain-canonical-pending-only",
      async (root) => {
        await fixture(root, true);
        const id = "261024-canonical-pending-only";
        await formal(root, id, "待撤销新增");
        await sync(root);
        assert.equal((await stage(root, [id], "domain")).status, "ok");
        await fs.unlink(decisionFilePath(root, id));
        await sync(root);
        const index = await fs.readFile(indexPath(root));
        const corrupt =
          "caller-owned canonical pending index " + missingPayload + "\n";
        await fs.writeFile(indexPath(root), corrupt);
        runGit(root, ["add", "docs/decisions/decision-index.json"]);
        await fs.writeFile(indexPath(root), index);
        if (missingPayload)
          await fs.unlink(
            pendingObjectPath(root, "docs/decisions/decision-index.json")
          );
        const pendingIndex = runGit(root, [
          "ls-files",
          "--stage",
          "docs/decisions/decision-index.json"
        ]);
        const result = await stage(root, [id], "domain");
        assert.equal(result.status, "ok", JSON.stringify(result));
        assert.equal(
          runGit(root, ["ls-files", "docs/decisions/" + id + ".md"]),
          ""
        );
        assert.equal(
          runGit(root, [
            "ls-files",
            "--stage",
            "docs/decisions/decision-index.json"
          ]),
          pendingIndex
        );
        if (!missingPayload)
          assert.equal(
            runGit(root, ["show", ":docs/decisions/decision-index.json"]),
            corrupt
          );
        assert.deepEqual(await fs.readFile(indexPath(root)), index);
      }
    );
  }
});
test("Decision domain stage removes a third old path from the usable pending index while preserving that index and unselected payloads", async () => {
  await withTemporaryWorkspace("domain-three-locations", async (root) => {
    await fixture(root, true);
    const directory = path.join(root, "docs/decisions");
    const headOld = path.join(directory, "head-old.md");
    const stagedOld = path.join(directory, "staged-old.md");
    const current = path.join(directory, "current.md");
    await fs.rename(decisionFilePath(root, a), headOld);
    await sync(root);
    runGit(root, ["add", "."]);
    runGit(root, ["commit", "-m", "head old locator"]);
    await fs.rename(headOld, stagedOld);
    await sync(root);
    assert.equal((await stage(root, [a], "all")).status, "ok");
    const pendingIndexBytes = runGit(root, [
      "show",
      ":docs/decisions/decision-index.json"
    ]);
    const pendingIndexEntry = runGit(root, [
      "ls-files",
      "--stage",
      "docs/decisions/decision-index.json"
    ]);
    const otherPath = "docs/decisions/" + b + ".md";
    const other = await fs.readFile(decisionFilePath(root, b));
    await fs.writeFile(
      decisionFilePath(root, b),
      "unselected partial staged bytes\n"
    );
    runGit(root, ["add", otherPath]);
    runGit(root, ["update-index", "--chmod=+x", otherPath]);
    await fs.writeFile(decisionFilePath(root, b), other);
    const otherEntry = runGit(root, ["ls-files", "--stage", otherPath]);
    await fs.rename(stagedOld, current);
    await sync(root);
    const workspaceIndex = await fs.readFile(indexPath(root));
    const result = await stage(root, [a], "domain");
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.equal(
      runGit(root, [
        "ls-files",
        "docs/decisions/staged-old.md",
        "docs/decisions/head-old.md"
      ]),
      ""
    );
    assert.match(
      runGit(root, ["show", ":docs/decisions/current.md"]),
      new RegExp("id: " + a)
    );
    assert.equal(
      runGit(root, [
        "ls-files",
        "--stage",
        "docs/decisions/decision-index.json"
      ]),
      pendingIndexEntry
    );
    assert.equal(
      runGit(root, ["show", ":docs/decisions/decision-index.json"]),
      pendingIndexBytes
    );
    assert.equal(runGit(root, ["ls-files", "--stage", otherPath]), otherEntry);
    assert.equal(
      runGit(root, ["show", ":" + otherPath]),
      "unselected partial staged bytes\n"
    );
    assert.deepEqual(await fs.readFile(indexPath(root)), workspaceIndex);
  });
});
test("Decision domain stage does not hide failures of a selected source identified by a usable pending locator", async () => {
  for (const fault of ["payload", "identity"] as const) {
    await withTemporaryWorkspace(
      "domain-selected-pending-" + fault,
      async (root) => {
        await fixture(root, true);
        const stagedOld = path.join(root, "docs/decisions/staged-selected.md");
        await fs.rename(decisionFilePath(root, a), stagedOld);
        await sync(root);
        assert.equal((await stage(root, [a], "all")).status, "ok");
        const current = path.join(root, "docs/decisions/current-selected.md");
        await fs.rename(stagedOld, current);
        await sync(root);
        if (fault === "payload")
          await fs.unlink(
            pendingObjectPath(root, "docs/decisions/staged-selected.md")
          );
        else {
          await fs.writeFile(
            stagedOld,
            candidateDecisionBody({ id: "261024-other-identity" })
          );
          runGit(root, ["add", "docs/decisions/staged-selected.md"]);
          await fs.unlink(stagedOld);
        }
        const before = runGit(root, ["ls-files", "--stage"]);
        const index = await fs.readFile(indexPath(root));
        const result = await stage(root, [a], "domain");
        assert.equal(result.status, "error");
        if (fault === "identity")
          assert.match(
            JSON.stringify(result),
            /identity differs from its published locator/
          );
        assert.equal(runGit(root, ["ls-files", "--stage"]), before);
        assert.deepEqual(await fs.readFile(indexPath(root)), index);
        assert.match(
          await fs.readFile(current, "utf8"),
          new RegExp("id: " + a)
        );
      }
    );
  }
});
