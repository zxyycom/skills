import assert from "node:assert/strict";
import test from "node:test";
import {
  createPackageScriptCheck,
  releaseRequiredPackageScripts
} from "./lib/vibe-gate/checks/package-script.ts";
import {
  createSemanticGateCheck,
  semanticGateChecks
} from "./lib/vibe-gate/checks/semantic.ts";

test("package and semantic Checks configure native command argv, inherited environment, transcript and limits", () => {
  for (const script of releaseRequiredPackageScripts) {
    const check = createPackageScriptCheck(script);
    assert.equal(check.options.executable, "bun");
    assert.deepEqual(check.options.arguments, ["run", script]);
    assert.equal(check.options.environment.mode, "inherit");
    assert.equal(check.options.output.mode, "transcript");
    assert.equal(check.options.timeoutMs, 120_000);
    assert.equal(check.options.outputByteLimit, 16 * 1024 * 1024);
  }
  for (const semantic of semanticGateChecks) {
    const check = createSemanticGateCheck(semantic);
    assert.equal(check.options.executable, semantic.command.command);
    assert.deepEqual(check.options.arguments, semantic.command.args);
    assert.equal(check.options.environment.mode, "inherit");
    assert.equal(check.options.output.mode, "transcript");
  }
});
