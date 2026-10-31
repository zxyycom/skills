import {
  parseJsonObject,
  jsonObjectMember,
  prepareUpdatedSelectedStageIndex as prepare
} from "./support.ts";
import { onWorkspaceIndexRead } from "../../../../shared/tests/record-stage-evidence.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  runGit as git,
  withTemporaryWorkspace as withTempRoot
} from "../../support/support.ts";
import {
  a,
  b,
  stage as stageDecision
} from "../../support/support-local-contracts.ts";

const indexRelativePath = "docs/decisions/decision-index.json";
const stage = (root: string, scope: "all") => stageDecision(root, [a], scope);

async function observeIndexParses<T>(
  observe: (text: string) => void,
  run: () => Promise<T>
): Promise<T> {
  const original = JSON.parse;
  JSON.parse = (
    text: string,
    reviver?: (this: unknown, key: string, value: unknown) => unknown
  ): unknown => {
    const value: unknown = original(text, reviver);
    observe(text);
    return value;
  };
  try {
    return await run();
  } finally {
    JSON.parse = original;
  }
}

test("Decision stage all reuses its verified locator index without reparsing the expanded snapshot", async () => {
  await withTempRoot("stage-all-locator-parse-reuse", async (root) => {
    await prepare(root);
    const pendingText = git(root, ["show", `:${indexRelativePath}`]);
    const workspaceText = await fs.readFile(
      path.join(root, indexRelativePath),
      "utf8"
    );
    assert.notEqual(workspaceText, pendingText);
    let pendingParses = 0;
    let workspaceParses = 0;
    let workspaceReads = 0;
    const result = await observeIndexParses(
      (text) => {
        if (text === pendingText) pendingParses += 1;
        if (text === workspaceText) workspaceParses += 1;
      },
      () =>
        onWorkspaceIndexRead(
          root,
          indexRelativePath,
          async () => {
            workspaceReads += 1;
          },
          () => stage(root, "all")
        )
    );
    assert.equal(result.status, "ok", JSON.stringify(result));
    // Fixed HEAD plus one locator parse in each independently acquired phase.
    assert.equal(pendingParses, 3);
    assert.equal(workspaceParses, 1);
    assert.equal(workspaceReads, 2);
    const entries = jsonObjectMember(
      parseJsonObject(git(root, ["show", `:${indexRelativePath}`])),
      "entries"
    );
    assert.equal(jsonObjectMember(entries, a).title, "Updated selected");
    assert.equal(jsonObjectMember(entries, b).title, "原始 B");
  });
});

test("Decision stage all rejects pending drift between locator parsing and snapshot extension without writing", async () => {
  await withTempRoot("stage-all-locator-extension-drift", async (root) => {
    await prepare(root);
    const pendingText = git(root, ["show", `:${indexRelativePath}`]);
    const indexPath = path.join(root, indexRelativePath);
    const workspaceText = await fs.readFile(indexPath, "utf8");
    const selectedPath = path.join(root, "docs/decisions/" + a + ".md");
    const selectedText = await fs.readFile(selectedPath, "utf8");
    const concurrentPath = path.join(root, "concurrent-index.json");
    await fs.writeFile(concurrentPath, pendingText + "\n");
    const oid = git(root, ["hash-object", "-w", concurrentPath]).trim();
    let pendingParses = 0;
    let winner = "";
    const result = await observeIndexParses(
      (text) => {
        if (text !== pendingText) return;
        pendingParses += 1;
        if (pendingParses !== 2) return;
        // HEAD was parsed first; replace P after the preparation locator parse.
        git(root, [
          "update-index",
          "--cacheinfo",
          "100644",
          oid,
          indexRelativePath
        ]);
        winner = git(root, ["ls-files", "--stage"]);
      },
      () => stage(root, "all")
    );
    assert.equal(pendingParses, 2);
    assert.notEqual(winner, "");
    assert.equal(result.status, "error", JSON.stringify(result));
    assert.match(JSON.stringify(result), /pending-conflict/);
    assert.equal(git(root, ["ls-files", "--stage"]), winner);
    assert.equal(
      git(root, ["show", `:${indexRelativePath}`]),
      pendingText + "\n"
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), workspaceText);
    assert.equal(await fs.readFile(selectedPath, "utf8"), selectedText);
  });
});
