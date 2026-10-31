import { decisionScanFromSources } from "../../support/domain-fixture.ts";
import { prepareDecisionLifecycle } from "../../../src/lifecycle/decision-lifecycle-service.ts";
import { parseDecisionMarkdown } from "../../../src/records/decision-metadata.ts";
import { assertLifecycleRejected, evolutionRequest } from "./domain-support.ts";
import { decisionIdForTest } from "../../support/support-record-fixture.ts";
import {
  assert,
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSuccessfulSourceLifecycleCli,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("evolve replaces established relations while preserving body and lifecycle fields", () =>
  withFixtureWorkspace("evolve-established-replace", async (workspaceRoot) => {
    const successorRelativePath = "replace-established-relations";
    const successorPath = decisionFilePath(
      workspaceRoot,
      successorRelativePath
    );
    await fs.writeFile(
      successorPath,
      candidateDecisionBody({
        relations: [{ type: "修订", target: currentRelativePath }]
      }),
      "utf8"
    );
    await runSuccessfulSourceLifecycleCli([
      "publish",
      successorRelativePath,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    const activeTargetRelativePath = "use-active-replacement-target";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, activeTargetRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    await runSuccessfulSourceLifecycleCli([
      "publish",
      activeTargetRelativePath,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    const beforeText = await fs.readFile(successorPath, "utf8");
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const beforeIndex = await readIndex(indexPath);
    const beforeState = findIndexEntry(beforeIndex, successorRelativePath);
    const removedTargetBefore = findIndexEntry(
      beforeIndex,
      currentRelativePath
    );
    assert.equal(removedTargetBefore.status, "archived");
    assert.equal(
      findIndexEntry(beforeIndex, activeTargetRelativePath).status,
      "active"
    );

    const replaced = await runSuccessfulSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + successorRelativePath,
      "--relation",
      "替代=" + activeTargetRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.match(replaced, /Relation review \(committed\):/);
    assert.match(replaced, /action=replace/);
    assert.match(replaced, /removed replace-established-relations --修订-->/);
    assert.match(replaced, /added replace-established-relations --替代-->/);

    const afterText = await fs.readFile(successorPath, "utf8");
    const afterIndex = await readIndex(indexPath);
    const afterState = findIndexEntry(afterIndex, successorRelativePath);
    assert.equal(afterState.status, beforeState.status);
    assert.equal(afterState.alignment, beforeState.alignment);
    assert.equal(afterState.createdAt, beforeState.createdAt);
    assert.equal(afterState.title, beforeState.title);
    assert.equal(afterState.purpose, beforeState.purpose);
    assert.equal(afterState.background, beforeState.background);
    assert.equal(afterState.decision, beforeState.decision);
    assert.equal(
      afterText.slice(afterText.indexOf("## 目的")),
      beforeText.slice(beforeText.indexOf("## 目的"))
    );
    assert.deepEqual(afterState.relations, [
      {
        type: "替代",
        target: activeTargetRelativePath
      }
    ]);
    assert.deepEqual(
      findIndexEntry(afterIndex, currentRelativePath),
      removedTargetBefore
    );
    assert.equal(
      findIndexEntry(afterIndex, activeTargetRelativePath).status,
      "archived"
    );
    const unchanged = await runSuccessfulSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + successorRelativePath,
      "--relation",
      "替代=" + activeTargetRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.match(unchanged, /action=unchanged/);
    assert.match(unchanged, /changes: unchanged/);
  }));

test("evolve keeps an archived established successor archived during relation replacement", async () => {
  const text = candidateDecisionBody({ id: "successor" })
    .replace("status: candidate", "status: archived")
    .replace("alignment: null", "alignment: unaligned")
    .replace("createdAt: null", "createdAt: 2026-10-01T00:00:00Z");
  const scan = await decisionScanFromSources([
    { id: "prior", status: "archived" },
    { id: "successor", status: "archived", text }
  ]);
  assert.deepEqual(scan.sourceErrors, []);
  const result = prepareDecisionLifecycle(
    scan,
    evolutionRequest(["successor"], {
      successors: [
        { decisionId: decisionIdForTest("successor"), alignment: "unaligned" }
      ],
      relationOverride: {
        kind: "replace",
        relations: [{ type: "修订", target: decisionIdForTest("prior") }]
      }
    }),
    { historyBaseline: null }
  );
  assert.equal(result.status, "ok");
  if (result.status === "ok") {
    assert.equal(result.changes.length, 1);
    const errors: string[] = [];
    const after = parseDecisionMarkdown({
      errors,
      markdown: result.changes[0]!.nextText!,
      relativePath: "archive/successor.md"
    });
    assert.deepEqual(errors, []);
    assert.equal(after?.metadata.status, "archived");
    assert.equal(after?.metadata.alignment, "unaligned");
    assert.equal(after?.metadata.createdAt, "2026-10-01T00:00:00Z");
    assert.deepEqual(after?.projection.relations, [
      { type: "修订", target: "prior" }
    ]);
    assert.equal(result.changes[0]!.targetPath, undefined);
  }
});

test("evolve rejects established successor alignment mismatches without mutation", async () => {
  await assertLifecycleRejected(
    [{ id: "formal", status: "active" }],
    evolutionRequest(["formal"], {
      successors: [
        { decisionId: decisionIdForTest("formal"), alignment: "unaligned" }
      ],
      relationOverride: { kind: "replace", relations: [] }
    }),
    /alignment confirmation does not match/
  );
});
