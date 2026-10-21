import { stageSource, stageTarget } from "./domain-support.ts";
import * as v from "valibot";
import { buildStageIndexText } from "../../src/decision-stage-prepare.ts";
import {
  readFilesystemDecisionCandidates,
  verifySelectedFilesystemSources
} from "../../src/decision-stage-sources.ts";
import { assert, fs, path, test, withTemporaryWorkspace } from "./support.ts";

test("stage isolates unselected invalid filesystem content from a selected revision ID", async () => {
  await withTemporaryWorkspace("stage-invalid-unselected", async (root) => {
    const source = stageSource("selected");
    await fs.writeFile(path.join(root, "selected.md"), source.source.text);
    await fs.writeFile(path.join(root, "invalid.md"), "invalid");
    const candidates = await readFilesystemDecisionCandidates(
      root,
      "docs/decisions"
    );
    assert.equal(candidates.sources.size, 1);
    assert.ok("error" in candidates.paths.get("invalid.md")!);
    await verifySelectedFilesystemSources(root, "docs/decisions", [
      { decisionId: source.source.decisionId, source }
    ]);
  });
});

test("stage treats a selected old ID as a deletion without inferring a rename", async () => {
  const old = stageSource("old");
  const replacement = stageSource("replacement");
  const retained = stageSource("retained");
  const target = await stageTarget(
    [old, retained],
    [replacement, retained],
    ["old"]
  );
  assert.deepEqual(target.sources, [retained.source]);
  assert.deepEqual(target.selectedSources, [
    { decisionId: "old", source: null }
  ]);
  assert.deepEqual(target.sourceFiles, [retained.file]);
  const projected = await buildStageIndexText(
    target.sources,
    "docs/decisions/decision-index.json"
  );
  assert.equal(projected.status, "ok", JSON.stringify(projected));
  if (projected.status !== "ok")
    throw new Error("Expected deletion projection");
  const index = v.parse(
    v.object({ entries: v.record(v.string(), v.unknown()) }),
    JSON.parse(projected.value) as unknown
  );
  assert.deepEqual(Object.keys(index.entries), ["retained"]);
});

test("stage rejects a selected symlink source outside the decision root without writing pending", async (t) => {
  await withTemporaryWorkspace("stage-symlink-source", async (root) => {
    const directory = path.join(root, "decisions");
    await fs.mkdir(directory);
    const source = stageSource("selected");
    const outside = path.join(root, "outside.md");
    await fs.writeFile(outside, source.source.text);
    const selected = path.join(directory, "selected.md");
    try {
      await fs.symlink(outside, selected);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EPERM") {
        t.skip("symlinks unavailable");
        return;
      }
      throw error;
    }
    await assert.rejects(
      verifySelectedFilesystemSources(directory, "docs/decisions", [
        { decisionId: source.source.decisionId, source }
      ]),
      /regular non-symlink/
    );
    assert.equal(await fs.readFile(outside, "utf8"), source.source.text);
    assert.equal((await fs.lstat(selected)).isSymbolicLink(), true);
  });
});
