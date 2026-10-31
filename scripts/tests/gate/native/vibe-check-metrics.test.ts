import assert from "node:assert/strict";
import test from "node:test";
import { createVibeNativeChecks } from "../../../lib/vibe-gate.ts";

test("production metrics block findings without waivers and use the bundled function analyzer", () => {
  const checks = createVibeNativeChecks();
  for (const checkId of ["file-metrics", "function-metrics"]) {
    const check = checks.find((candidate) => candidate.checkId === checkId);
    assert.ok(check?.options, `missing production ${checkId} options`);
    assert.deepEqual(Reflect.get(check.options, "findingWaivers"), []);
    const codeAreas = Reflect.get(check.options, "codeAreas");
    assert.ok(codeAreas !== null && typeof codeAreas === "object");
    assert.ok(Object.keys(codeAreas).length > 0);
    for (const area of Object.values(codeAreas)) {
      assert.ok(area !== null && typeof area === "object");
      assert.equal(Reflect.get(area, "findingPolicy"), "blocking");
    }
    if (checkId === "function-metrics") {
      assert.equal(Object.hasOwn(check.options, "scanner"), false);
    }
  }
});
