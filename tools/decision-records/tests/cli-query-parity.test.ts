import assert from "node:assert/strict";
import test from "node:test";
import { validateDecisionRecords } from "../src/index.ts";
import { withFixtureWorkspace, runBundledCli } from "./support.ts";

test("decision check preserves source, bundled API, and in-process CLI parity", () =>
  withFixtureWorkspace("query-parity", async (workspaceRoot) => {
    const source = await validateDecisionRecords({ workspaceRoot });
    const bundled =
      await import("../../../skills/decision-records/scripts/decision-records.ts");
    const bundledResult = await bundled.validateDecisionRecords({
      workspaceRoot
    });
    assert.deepEqual(bundledResult, source);
    const result = await runBundledCli(["check", "--root", workspaceRoot]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Decision records check passed/);
  }));
