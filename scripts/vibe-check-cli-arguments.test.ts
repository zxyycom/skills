import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  createGateInvocationDirectory,
  resolveGateInvocation
} from "./vibe-check.ts";

test("CLI parses release tags, diagnostics, baselines, and compatibility alias", () => {
  assert.equal(
    createGateInvocationDirectory(
      "/workspace",
      new Date("2026-09-09T01:02:03.456Z"),
      "fixture-id"
    ),
    path.join(
      "/workspace",
      ".log/vibe-check/invocations/20260909T010203456Z-fixture-id"
    )
  );
  assert.deepEqual(resolveGateInvocation([]), {
    cold: false,
    diagnosticLog: false,
    tags: []
  });
  assert.deepEqual(resolveGateInvocation(["--diagnostic-log"]), {
    cold: false,
    diagnosticLog: true,
    tags: []
  });
  assert.deepEqual(resolveGateInvocation(["--full"]), {
    baselineRef: "HEAD",
    cold: false,
    diagnosticLog: false,
    tags: ["release"]
  });
  assert.deepEqual(resolveGateInvocation(["--tag", "release"]), {
    baselineRef: "HEAD",
    cold: false,
    diagnosticLog: false,
    tags: ["release"]
  });
  assert.deepEqual(
    resolveGateInvocation([
      "--diagnostic-log",
      "--baseline-ref",
      "origin/release",
      "--full"
    ]),
    {
      baselineRef: "origin/release",
      cold: false,
      diagnosticLog: true,
      tags: ["release"]
    }
  );
  assert.deepEqual(resolveGateInvocation(["--full", "--cold"]), {
    baselineRef: "HEAD",
    cold: true,
    diagnosticLog: false,
    tags: ["release"]
  });
});

test("CLI rejects misplaced, duplicate, unknown, and malformed arguments", () => {
  assert.equal(resolveGateInvocation(["--cold"]), null);
  assert.equal(
    resolveGateInvocation(["--baseline-ref", "origin/release"]),
    null
  );
  assert.equal(
    resolveGateInvocation([
      "--diagnostic-log",
      "--baseline-ref",
      "origin/release"
    ]),
    null
  );
  assert.equal(
    resolveGateInvocation([
      "--baseline-ref",
      "origin/release",
      "--diagnostic-log"
    ]),
    null
  );
  for (const invalidBaseline of [
    "",
    " origin/release",
    "origin/release ",
    "-origin/release",
    "origin/release\0suffix",
    "origin/release\nsuffix",
    "origin/release\rsuffix"
  ]) {
    assert.equal(
      resolveGateInvocation(["--full", "--baseline-ref", invalidBaseline]),
      null
    );
  }
  assert.equal(
    resolveGateInvocation(["--full", "--baseline-ref", "--full"]),
    null
  );
  assert.equal(resolveGateInvocation(["--tag"]), null);
  assert.equal(resolveGateInvocation(["--tag", "unknown"]), null);
  assert.equal(
    resolveGateInvocation(["--tag", "release", "--tag", "release"]),
    null
  );
  assert.equal(resolveGateInvocation(["--tag", "release", "--full"]), null);
  assert.equal(
    resolveGateInvocation(["--diagnostic-log", "--diagnostic-log"]),
    null
  );
});
