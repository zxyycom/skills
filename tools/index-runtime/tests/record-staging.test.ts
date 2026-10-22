import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { openVersionControl } from "../../shared/src/version-control/index.ts";
import {
  buildStateIndexFromSnapshot,
  parseStateIndex,
  serializeStateIndex
} from "../src/index.ts";
import {
  readRecordStagePending,
  stageRecordSelection
} from "../src/record-staging.ts";
import {
  createControl,
  createDefinition,
  createGitRepositoryFixture,
  indexPath,
  runGit,
  snapshot,
  withTempRoot
} from "./staging-fixture.ts";
import { resultValue } from "./support.ts";

for (const scope of ["index", "all", "domain"]) {
  test(`record stage ${scope} reuses immutable deterministic target after two fresh acquisitions`, async () => {
    await exerciseRecordStage(scope, false);
  });
}
for (const scope of ["index", "all"]) {
  test(`record stage ${scope} rebuilds target for changed actual bytes after two fresh acquisitions`, async () => {
    await exerciseRecordStage(scope, true);
  });
}

async function exerciseRecordStage(
  scope: string,
  bytesChanged: boolean
): Promise<void> {
  if (scope !== "index" && scope !== "all" && scope !== "domain")
    throw new Error("Invalid scope fixture");
  await withTempRoot(async (tempRoot) => {
    const control = createControl();
    const source = { snapshot: snapshot({}, "empty") };
    const definition = createDefinition(source, control);
    const fixture = await createGitRepositoryFixture({
      definition,
      name: "record-equivalence",
      revision: snapshot({ A: "old A", B: "old B" }, "head"),
      source,
      tempRoot,
      workspace: snapshot({ A: "new A", B: "new B" }, "work"),
      stageOutside: true
    });
    assert.notEqual(fixture.revisionText, null);
    const parse = (text: string) =>
      resultValue(parseStateIndex({ definition, sourcePath: indexPath, text }));
    const baseline = parse(fixture.revisionText!);
    const workspace = parse(fixture.workspaceText);
    const repository = await openVersionControl(fixture.repositoryRoot);
    const revision = await repository.getCurrentRevision();
    const outsideBefore = runGit(fixture.repositoryRoot, [
      "show",
      ":outside/keep.md"
    ]);
    const workspaceBefore = await fs.readFile(
      path.join(fixture.repositoryRoot, indexPath)
    );
    let reads = 0;
    let captures = 0;
    let builds = 0;
    let serializations = 0;
    let domainPhases = 0;
    const result = await stageRecordSelection({
      repository,
      revision,
      scope,
      indexPath,
      acquire: async () => {
        const workspaceBytes = await fs.readFile(
          path.join(fixture.repositoryRoot, indexPath)
        );
        reads += 1;
        if (bytesChanged && reads === 1)
          await fs.writeFile(
            path.join(fixture.repositoryRoot, indexPath),
            Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), workspaceBytes])
          );
        const pending = await readRecordStagePending(repository, {
          scope,
          pathScope: "indexes",
          indexPath,
          contentPaths: [indexPath]
        });
        captures += 1;
        return {
          baseline,
          workspace,
          pendingIndex: scope === "domain" ? null : baseline,
          pending,
          selectedIds: ["A"],
          workspaceBytes,
          workspaceEvidence: fixture.workspaceText,
          context: null
        };
      },
      build: (target) => {
        builds += 1;
        return buildStateIndexFromSnapshot(definition, target);
      },
      serialize: (target) => {
        serializations += 1;
        return serializeStateIndex(target, definition);
      },
      prepareDomain: async (phase, target) => {
        domainPhases += 1;
        assert.equal(
          Reflect.set(phase.workspace, "namespace", "mutated"),
          false
        );
        if (target !== null) {
          assert.equal(Reflect.set(target, "namespace", "mutated"), false);
          assert.equal(
            Reflect.set(target.entries.A!, "label", "mutated"),
            false
          );
        }
        return { pending: phase.pending, updates: [], sourceFiles: [] };
      }
    });
    assert.equal(reads, 2);
    assert.equal(captures, 2);
    assert.equal(builds, scope === "domain" ? 0 : bytesChanged ? 2 : 1);
    assert.equal(serializations, scope === "domain" ? 0 : bytesChanged ? 2 : 1);
    assert.equal(domainPhases, scope === "index" ? 0 : 2);
    assert.equal(
      runGit(fixture.repositoryRoot, ["show", ":outside/keep.md"]),
      outsideBefore
    );
    assert.deepEqual(
      await fs.readFile(path.join(fixture.repositoryRoot, indexPath)),
      bytesChanged
        ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), workspaceBefore])
        : workspaceBefore
    );
    const pending: unknown = JSON.parse(
      runGit(fixture.repositoryRoot, ["show", `:${indexPath}`])
    );
    assert.ok(
      pending !== null &&
        typeof pending === "object" &&
        "entries" in pending &&
        "sourceRevision" in pending
    );
    assert.deepEqual(
      pending.entries,
      scope === "domain"
        ? { A: { id: "A", label: "old A" }, B: { id: "B", label: "old B" } }
        : { A: { id: "A", label: "new A" }, B: { id: "B", label: "old B" } }
    );
    assert.deepEqual(pending.sourceRevision, {
      metadata: "metadata:main",
      entries:
        scope === "domain"
          ? { A: "head:A", B: "head:B" }
          : { A: "work:A", B: "head:B" }
    });
    assert.deepEqual(
      result.replacement.changedPaths,
      scope === "domain" ? [] : [indexPath]
    );
  });
}
