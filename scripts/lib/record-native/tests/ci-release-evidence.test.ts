import assert from "node:assert/strict";
import { test } from "node:test";
import { compareReleaseEvidence } from "../ci-release-evidence.ts";

const evidence = () => ({
  revision: "a".repeat(40),
  versions: ["0.2.0"],
  delivery: { sha256: "b".repeat(64), files: ["delivery"] },
  sources: [{ sha256: "c".repeat(64), files: ["source"] }]
});
test("formal comparison binds revision and both complete file lists", () => {
  const first = evidence();
  compareReleaseEvidence(first, evidence());
  const changed = evidence();
  changed.sources[0]!.files.push("extra");
  assert.throws(() => compareReleaseEvidence(first, changed));
  assert.throws(() =>
    compareReleaseEvidence(first, { ...evidence(), revision: "d".repeat(40) })
  );
  assert.throws(() =>
    compareReleaseEvidence(first, { ...evidence(), versions: ["0.1.0"] })
  );
});
