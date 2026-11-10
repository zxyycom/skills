import assert from "node:assert/strict";
import { test } from "node:test";
import { compareEvidence } from "../ci-frozen.ts";
import { nativeRuntimeVersion } from "../capture.ts";

test("cross-platform frozen inputs require matching revision and each private version", () => {
  const a = {
    revision: "a".repeat(40),
    versions: ["0.1.0", "0.1.1"],
    delivery: { sha256: "3".repeat(64), files: ["package.json"] },
    sources: [
      { sha256: "1".repeat(64), files: ["Cargo.toml"] },
      { sha256: "2".repeat(64), files: ["Cargo.toml"] }
    ]
  };
  assert.doesNotThrow(() => compareEvidence(a, structuredClone(a)));
  const wrongRevision = { ...a, revision: "b".repeat(40) };
  assert.throws(() => compareEvidence(a, wrongRevision), /revisions differ/);
  const wrongDelivery = structuredClone(a);
  wrongDelivery.delivery.sha256 = "4".repeat(64);
  assert.throws(() => compareEvidence(a, wrongDelivery), /delivery source/);
  const wrongB = structuredClone(a);
  wrongB.sources[1]!.sha256 = "3".repeat(64);
  assert.throws(() => compareEvidence(a, wrongB), /0.1.1/);
  const wrongList = structuredClone(a);
  wrongList.sources[0]!.files.push("extra");
  assert.throws(() => compareEvidence(a, wrongList), /0.1.0/);
  assert.throws(() => compareEvidence(a, {}));
});

test("formal runtime version comes from the frozen package manifest", () => {
  const source = (content: string) => [
    { path: "Cargo.toml", data: Buffer.from(content) }
  ];
  assert.equal(
    nativeRuntimeVersion(
      source(
        '[package]\nname = "record-cli"\nversion = "4.5.6"\n[dependencies]\nversion = "1.0.0"\n'
      )
    ),
    "4.5.6"
  );
  assert.equal(
    nativeRuntimeVersion(source('[package]\nversion = "4.5.7"\n')),
    "4.5.7"
  );
  assert.throws(() =>
    nativeRuntimeVersion(source('[package]\nversion = "bad"\n'))
  );
  assert.throws(() =>
    nativeRuntimeVersion(
      source('[package]\nversion = "1.0.0"\nversion = "2.0.0"\n')
    )
  );
  assert.throws(() =>
    nativeRuntimeVersion(
      source('[package]\nversion = "1.0.0"\nversion = "bad"\n')
    )
  );
  assert.throws(() => nativeRuntimeVersion([]));
});
