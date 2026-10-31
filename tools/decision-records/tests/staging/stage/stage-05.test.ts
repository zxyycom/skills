import { stageDecisionRecords } from "../../../src/staging/decision-stage-service.ts";
import {
  stageSource,
  withStageBaseline,
  writeStageSources
} from "./domain-support.ts";
import { assert, fs, path, runGit, test } from "./support.ts";

test("stage isolates unselected invalid filesystem content from a selected revision ID", async () => {
  await withStageBaseline(
    "stage-invalid-unselected",
    [stageSource("selected")],
    async (root) => {
      await fs.writeFile(
        path.join(root, "docs/decisions/invalid.md"),
        "invalid"
      );
      const before = runGit(root, ["write-tree"]);
      const result = await stageDecisionRecords({
        decisionIds: ["selected"],
        location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
      });
      assert.equal(result.status, "ok", JSON.stringify(result));
      assert.equal(runGit(root, ["write-tree"]), before);
    }
  );
});

test("stage treats a selected old ID as a deletion without inferring a rename", async () => {
  await withStageBaseline(
    "stage-no-inference",
    [stageSource("old"), stageSource("retained")],
    async (root) => {
      await fs.rm(path.join(root, "docs/decisions/old.md"));
      await writeStageSources(root, [stageSource("replacement")]);
      const result = await stageDecisionRecords({
        decisionIds: ["old"],
        location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
      });
      assert.equal(result.status, "ok", JSON.stringify(result));
      assert.equal(
        runGit(root, [
          "ls-files",
          "docs/decisions/old.md",
          "docs/decisions/replacement.md"
        ]),
        ""
      );
      assert.match(
        runGit(root, ["show", ":docs/decisions/retained.md"]),
        /id: retained/
      );
      assert.doesNotMatch(
        runGit(root, ["show", ":docs/decisions/decision-index.json"]),
        /"old"|"replacement"/
      );
    }
  );
});

test("stage rejects a selected symlink source outside the decision root without writing pending", async (t) => {
  await withStageBaseline(
    "stage-symlink-source",
    [stageSource("selected")],
    async (root) => {
      const selected = path.join(root, "docs/decisions/selected.md");
      const outside = path.join(root, "outside.md");
      const original = await fs.readFile(selected, "utf8");
      await fs.writeFile(outside, original);
      await fs.rm(selected);
      try {
        await fs.symlink(outside, selected);
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "EPERM"
        ) {
          t.skip("symlinks unavailable");
          return;
        }
        throw error;
      }
      const before = runGit(root, ["write-tree"]);
      const result = await stageDecisionRecords({
        decisionIds: ["selected"],
        location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
      });
      assert.equal(result.status, "error");
      assert.match(JSON.stringify(result), /regular non-symlink/);
      assert.equal(runGit(root, ["write-tree"]), before);
      assert.equal(await fs.readFile(outside, "utf8"), original);
      assert.equal((await fs.lstat(selected)).isSymbolicLink(), true);
    }
  );
});
