import { buildStageIndexText } from "../../src/decision-stage-prepare.ts";
import * as v from "valibot";
import { stageSource, stageTarget } from "./domain-support.ts";
import { normalizeDecisionSelectorInput } from "../../src/decision-path.ts";
import {
  readFilesystemDecisionCandidates,
  resolveFilesystemDecisionSource
} from "../../src/decision-stage-sources.ts";
import { assert, fs, path, test, withTemporaryWorkspace } from "./support.ts";

test("stage selects one Decision ID when its sourcePath moves between root and archive", async () => {
  const before = stageSource("selected");
  const after = stageSource("selected", "archive/selected.md");
  const target = await stageTarget([before], [after], ["selected"]);
  assert.deepEqual(target.selectedIds, ["selected"]);
  assert.deepEqual(
    target.sources.map((source) => source.sourcePath),
    ["archive/selected.md"]
  );
  assert.deepEqual(
    target.sourceFiles.map((file) => file.path),
    ["docs/decisions/archive/selected.md"]
  );
  const projected = await buildStageIndexText(
    target.sources,
    "docs/decisions/decision-index.json"
  );
  assert.equal(projected.status, "ok", JSON.stringify(projected));
  if (projected.status !== "ok")
    throw new Error("Expected archived projection");
  const index = v.parse(
    v.object({
      entries: v.record(
        v.string(),
        v.object({ sourcePath: v.string(), status: v.string() })
      )
    }),
    JSON.parse(projected.value) as unknown
  );
  assert.deepEqual(Object.keys(index.entries), ["selected"]);
  assert.equal(index.entries.selected?.sourcePath, "archive/selected.md");
  assert.equal(index.entries.selected?.status, "archived");
});

test("stage treats a selected new ID as an addition and preserves an unselected old ID", async () => {
  const old = stageSource("old");
  const added = stageSource("added");
  const target = await stageTarget([old], [old, added], ["added"]);
  assert.deepEqual(
    target.sources.map((s) => s.decisionId),
    ["added", "old"]
  );
});

test("stage resolves a unique Decision name after one Markdown suffix", async () => {
  const source = stageSource("260710-use-source-cli");
  const target = await stageTarget(
    [source],
    [source],
    [normalizeDecisionSelectorInput("use-source-cli.MD")]
  );
  assert.deepEqual(target.selectedIds, [source.source.decisionId]);
});

test("stage treats a standard Decision ID as exact instead of falling back to a name", async () => {
  const source = stageSource("260710-stage-not-present");
  await assert.rejects(
    stageTarget([source], [source], ["260801-stage-not-present"]),
    /Selected Decision ID does not exist in the revision or filesystem: 260801-stage-not-present/
  );
});

test("stage reports ambiguous Decision names before writing pending files", async () => {
  const first = stageSource("260710-use-source-cli");
  const second = stageSource("260711-use-source-cli");
  await assert.rejects(
    stageTarget([first], [first, second], ["use-source-cli"]),
    /Selected Decision name is ambiguous.*260710-use-source-cli, 260711-use-source-cli/
  );
});

test("stage resolves a filesystem-only Decision addition by name", async () => {
  const old = stageSource("old");
  const added = stageSource("260801-stage-filesystem-only");
  const target = await stageTarget(
    [old],
    [old, added],
    ["stage-filesystem-only"]
  );
  assert.deepEqual(target.selectedIds, [added.source.decisionId]);
  assert.deepEqual(
    target.sources.map((s) => s.decisionId),
    [added.source.decisionId, "old"]
  );
});

test("stage preserves one Decision ID when its semantic sourcePath is renamed", async () => {
  const before = stageSource("selected", "before.md");
  const after = stageSource(
    "selected",
    "semantic-current.md",
    "修改后的语义来源"
  );
  const target = await stageTarget([before], [after], ["selected"]);
  assert.equal(target.sources.length, 1);
  assert.equal(target.sources[0]?.sourcePath, "semantic-current.md");
  assert.match(target.sources[0]?.text ?? "", /修改后的语义来源/);
  assert.deepEqual(
    target.sourceFiles.map((f) => f.path),
    ["docs/decisions/semantic-current.md"]
  );
});

test("stage ignores an invalid former ID basename after an ID keeps a semantic sourcePath", async () => {
  await withTemporaryWorkspace("stage-former-basename", async (root) => {
    const source = stageSource("selected", "semantic-current.md");
    await fs.writeFile(
      path.join(root, source.source.sourcePath),
      source.source.text
    );
    await fs.writeFile(
      path.join(root, "selected.md"),
      "invalid former basename"
    );
    const candidates = await readFilesystemDecisionCandidates(
      root,
      "docs/decisions"
    );
    assert.equal(
      resolveFilesystemDecisionSource(
        candidates,
        source.source.decisionId,
        "semantic-current.md"
      )?.source.text,
      source.source.text
    );
  });
});
