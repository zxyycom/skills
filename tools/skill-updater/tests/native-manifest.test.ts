import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseNativeRelease,
  parseNativeReleasePair,
  parseNativeRuntimeDescriptor,
  selectNativeAsset,
  verifyNativeAsset
} from "../../skill-package/src/native-release-manifest.ts";
import { validateSkillReleaseManifest } from "../../skill-package/src/release-manifest.ts";

test("native manifest validates asset identity without changing the generic projection", () => {
  const hash = "a".repeat(64);
  const asset = (name: string) => ({ name, byteLength: 12, sha256: hash });
  const role = "decision-records";
  const native = {
    schemaVersion: 1,
    runtimeVersion: "0.1.0",
    sourceHash: hash,
    package: asset("decision-records-native.zip"),
    targets: {
      "x86_64-unknown-linux-gnu": asset(
        "decision-records-0.1.0-x86_64-unknown-linux-gnu.zip"
      ),
      "x86_64-pc-windows-msvc": asset(
        "decision-records-0.1.0-x86_64-pc-windows-msvc.zip"
      )
    },
    bootstrap: asset("record-native-installer.zip")
  };
  const manifest = {
    schemaVersion: 1,
    skills: { [role]: { version: 110, native }, "novel-cards": { version: 1 } }
  };
  assert.deepEqual(validateSkillReleaseManifest(manifest), {
    success: true,
    output: {
      schemaVersion: 1,
      skills: { [role]: { version: 110 }, "novel-cards": { version: 1 } }
    }
  });
  const investigation = {
    ...native,
    package: asset("investigation-report-native.zip"),
    targets: {
      "x86_64-unknown-linux-gnu": asset(
        "investigation-report-0.1.0-x86_64-unknown-linux-gnu.zip"
      ),
      "x86_64-pc-windows-msvc": asset(
        "investigation-report-0.1.0-x86_64-pc-windows-msvc.zip"
      )
    }
  };
  const pair = {
    ...manifest,
    skills: {
      ...manifest.skills,
      "investigation-report": { version: 99, native: investigation }
    }
  };
  assert.equal(
    parseNativeReleasePair(pair)["investigation-report"].version,
    99
  );
  assert.throws(() =>
    parseNativeReleasePair({
      ...pair,
      skills: {
        ...pair.skills,
        "investigation-report": {
          version: 99,
          native: { ...investigation, sourceHash: "b".repeat(64) }
        }
      }
    })
  );
  const matching = {
    name: "sample.zip",
    byteLength: 3,
    sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  };
  verifyNativeAsset(matching, new TextEncoder().encode("abc"));
  assert.throws(() =>
    verifyNativeAsset(matching, new TextEncoder().encode("abd"))
  );
  assert.throws(() =>
    verifyNativeAsset(matching, new TextEncoder().encode("ab"))
  );
  assert.equal(
    selectNativeAsset([{ name: "sample.zip", url: "x" }], "sample.zip").url,
    "x"
  );
  assert.throws(() => selectNativeAsset([], "sample.zip"));
  assert.throws(() =>
    selectNativeAsset(
      [{ name: "sample.zip" }, { name: "sample.zip" }],
      "sample.zip"
    )
  );
  const release = parseNativeRelease(manifest, role);
  const descriptor = {
    schemaVersion: 1,
    role,
    runtimeVersion: "0.1.0",
    sourceHash: hash,
    targets: ["x86_64-pc-windows-msvc", "x86_64-unknown-linux-gnu"]
  };
  assert.deepEqual(
    parseNativeRuntimeDescriptor(descriptor, role, release),
    descriptor
  );
  assert.throws(() =>
    parseNativeRuntimeDescriptor(
      { ...descriptor, sourceHash: "b".repeat(64) },
      role,
      release
    )
  );
  assert.throws(() =>
    parseNativeRuntimeDescriptor(
      {
        ...descriptor,
        targets: [descriptor.targets[0], descriptor.targets[0]]
      },
      role,
      release
    )
  );
  for (const bad of [
    { ...native, package: asset("decision-records.zip") },
    { ...native, bootstrap: asset("../record-native-installer.zip") },
    { ...native, sourceHash: "BAD" },
    {
      ...native,
      targets: {
        ...native.targets,
        "x86_64-unknown-linux-gnu": {
          ...native.targets["x86_64-unknown-linux-gnu"],
          byteLength: 0
        }
      }
    },
    {
      ...native,
      targets: {
        ...native.targets,
        "x86_64-pc-windows-msvc": native.targets["x86_64-unknown-linux-gnu"]
      }
    }
  ])
    assert.throws(() =>
      parseNativeRelease(
        { ...manifest, skills: { [role]: { version: 110, native: bad } } },
        role
      )
    );
});

test("three-role release set requires resource and validates shared identity while pair reads old manifests", async () => {
  const { fixture } =
    await import("../../../scripts/lib/record-native/tests/candidate-publish-fixture.ts");
  const { parseNativeReleaseSet } =
    await import("../../skill-package/src/native-release-manifest.ts");
  const { manifest } = fixture();
  assert.ok(parseNativeReleaseSet(manifest)["resource-records"]);
  const old = structuredClone(manifest);
  delete old.skills["resource-records"];
  assert.equal(parseNativeReleasePair(old)["resource-records"], undefined);
  assert.throws(
    () => parseNativeReleaseSet(old),
    /resource-records release missing/
  );
  const bad = structuredClone(manifest);
  const entry = bad.skills["resource-records"] as {
    version: number;
    native: { sourceHash: string };
  };
  entry.native.sourceHash = "f".repeat(64);
  assert.throws(() => parseNativeReleasePair(bad), /share a build/);
});
