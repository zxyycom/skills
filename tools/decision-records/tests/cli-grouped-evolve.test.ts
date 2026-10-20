import assert from "node:assert/strict";
import test from "node:test";
import { withFixtureWorkspace, runBundledCli } from "./support.ts";
import { establishClosedSplit } from "./evolution/support.ts";

test("generated CLI accepts grouped evolve argv through in-process preflight", () =>
  withFixtureWorkspace("generated-grouped-evolve", async (workspaceRoot) => {
    const established = await establishClosedSplit(workspaceRoot);
    const result = await runBundledCli([
      "evolve",
      "--successor",
      "aligned=" + established.alignedRelativePath,
      "--successor",
      "unaligned=" + established.unalignedRelativePath,
      "--source",
      established.alignedRelativePath,
      "--relation",
      "拆分=" + established.coarseRelativePath,
      "--source",
      established.unalignedRelativePath,
      "--relation",
      "拆分=" + established.coarseRelativePath,
      "--keep-unrecorded-history",
      "--preflight",
      "--root",
      workspaceRoot
    ]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /Relation review \(preflight\):/);
    assert.equal(result.stderr, "");
  }));
