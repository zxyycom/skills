import { stageDecisionRecords } from "../../../src/staging/decision-stage-service.ts";
import {
  stageSource,
  withStageBaseline,
  writeStageSources
} from "./domain-support.ts";
import { assert, fs, path, runGit, test } from "./support.ts";

test("stage selects one Decision ID when its sourcePath moves between root and archive", async () => {
  await withStageBaseline(
    "stage-archive",
    [stageSource("selected")],
    async (root) => {
      await fs.rm(path.join(root, "docs/decisions/selected.md"));
      await writeStageSources(root, [
        stageSource("selected", "archive/selected.md")
      ]);
      const result = await stageDecisionRecords({
        decisionIds: ["selected"],
        location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
      });
      assert.equal(result.status, "ok", JSON.stringify(result));
      assert.match(
        runGit(root, ["show", ":docs/decisions/archive/selected.md"]),
        /status: archived/
      );
      assert.equal(
        runGit(root, ["ls-files", "docs/decisions/selected.md"]),
        ""
      );
    }
  );
});

test("stage treats a selected new ID as an addition and preserves an unselected old ID", async () => {
  await withStageBaseline("stage-add", [stageSource("old")], async (root) => {
    await writeStageSources(root, [stageSource("added")]);
    const result = await stageDecisionRecords({
      decisionIds: ["added"],
      location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
    });
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.match(
      runGit(root, ["show", ":docs/decisions/added.md"]),
      /id: added/
    );
    assert.match(runGit(root, ["show", ":docs/decisions/old.md"]), /id: old/);
  });
});

test("stage resolves a unique Decision name after one Markdown suffix", async () => {
  await withStageBaseline(
    "stage-suffix",
    [stageSource("260710-use-source-cli")],
    async (root) => {
      const result = await stageDecisionRecords({
        decisionIds: ["use-source-cli.MD"],
        location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
      });
      assert.equal(result.status, "ok", JSON.stringify(result));
      if (result.status === "ok")
        assert.deepEqual(result.selectedIds, ["260710-use-source-cli"]);
    }
  );
});

test("stage treats a standard Decision ID as exact instead of falling back to a name", async () => {
  await withStageBaseline(
    "stage-exact-id",
    [stageSource("260710-stage-not-present")],
    async (root) => {
      const before = runGit(root, ["write-tree"]);
      const result = await stageDecisionRecords({
        decisionIds: ["260801-stage-not-present"],
        location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
      });
      assert.equal(result.status, "error");
      assert.match(JSON.stringify(result), /missing or ambiguous/);
      assert.equal(runGit(root, ["write-tree"]), before);
    }
  );
});

test("stage reports ambiguous Decision names before writing pending files", async () => {
  await withStageBaseline(
    "stage-ambiguous",
    [
      stageSource("260710-use-source-cli"),
      stageSource("260711-use-source-cli")
    ],
    async (root) => {
      const before = runGit(root, ["write-tree"]);
      const result = await stageDecisionRecords({
        decisionIds: ["use-source-cli"],
        location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
      });
      assert.equal(result.status, "error");
      assert.match(JSON.stringify(result), /missing or ambiguous/);
      assert.equal(runGit(root, ["write-tree"]), before);
    }
  );
});

test("stage resolves a filesystem-only Decision addition by name", async () => {
  await withStageBaseline(
    "stage-new-name",
    [stageSource("old")],
    async (root) => {
      await writeStageSources(root, [
        stageSource("260801-stage-filesystem-only")
      ]);
      const result = await stageDecisionRecords({
        decisionIds: ["stage-filesystem-only"],
        location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
      });
      assert.equal(result.status, "ok", JSON.stringify(result));
      if (result.status === "ok")
        assert.deepEqual(result.selectedIds, ["260801-stage-filesystem-only"]);
      assert.match(
        runGit(root, [
          "show",
          ":docs/decisions/260801-stage-filesystem-only.md"
        ]),
        /id: 260801-stage-filesystem-only/
      );
    }
  );
});

test("stage preserves one Decision ID when its semantic sourcePath is renamed", async () => {
  await withStageBaseline(
    "stage-semantic-path",
    [stageSource("selected", "before.md")],
    async (root) => {
      await fs.rm(path.join(root, "docs/decisions/before.md"));
      await writeStageSources(root, [
        stageSource("selected", "semantic-current.md", "修改后的语义来源")
      ]);
      const result = await stageDecisionRecords({
        decisionIds: ["selected"],
        location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
      });
      assert.equal(result.status, "ok", JSON.stringify(result));
      assert.match(
        runGit(root, ["show", ":docs/decisions/semantic-current.md"]),
        /修改后的语义来源/
      );
      assert.equal(runGit(root, ["ls-files", "docs/decisions/before.md"]), "");
    }
  );
});

test("stage ignores an invalid former ID basename after an ID keeps a semantic sourcePath", async () => {
  await withStageBaseline(
    "stage-former-basename",
    [stageSource("selected", "semantic-current.md")],
    async (root) => {
      await fs.writeFile(
        path.join(root, "docs/decisions/selected.md"),
        "invalid former basename"
      );
      const result = await stageDecisionRecords({
        decisionIds: ["selected"],
        location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
      });
      assert.equal(result.status, "ok", JSON.stringify(result));
      assert.match(
        runGit(root, ["show", ":docs/decisions/semantic-current.md"]),
        /id: selected/
      );
      assert.equal(
        runGit(root, ["ls-files", "docs/decisions/selected.md"]),
        ""
      );
    }
  );
});
