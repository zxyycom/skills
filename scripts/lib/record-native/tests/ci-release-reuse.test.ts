import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { zipSync } from "fflate";
import { nativeBuildRecipePaths } from "../candidate-build-recipe.ts";
import { createReusedReleaseDirectory } from "../ci-release-output.ts";
import {
  validateRuntimeRecovery,
  validateRuntimeReuse,
  type RemoteAsset
} from "../ci-release-reuse.ts";
import {
  nativeRoles,
  nativeTargets
} from "../../../../tools/skill-package/src/native-release-manifest.ts";

const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

test("reused runtime creates a missing dist but never replaces an existing output", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "native-reuse-"));
  try {
    const output = await createReusedReleaseDirectory(root);
    assert.equal(output, path.join(root, "dist", "record-cli-reused-release"));
    await fs.writeFile(path.join(output, "sentinel"), "keep");
    await assert.rejects(createReusedReleaseDirectory(root), {
      code: "EEXIST"
    });
    assert.equal(
      await fs.readFile(path.join(output, "sentinel"), "utf8"),
      "keep"
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
function runtimeFixture() {
  const recipe = Object.fromEntries(
    nativeBuildRecipePaths.map((name) => [name, "d".repeat(64)])
  );
  const source = { sha256: "a".repeat(64), files: ["Cargo.toml"] };
  const downloaded = new Map<number, Uint8Array>();
  const remoteAssets: RemoteAsset[] = [];
  const assets = nativeRoles.flatMap((role) =>
    nativeTargets.map((target) => {
      const name = `${role}-0.2.1-${target}.zip`;
      const bytes = Buffer.from(name);
      const id = downloaded.size + 1;
      downloaded.set(id, bytes);
      remoteAssets.push({
        id,
        name,
        size: bytes.length,
        digest: `sha256:${hash(bytes)}`
      });
      return { name, byteLength: bytes.length, sha256: hash(bytes) };
    })
  );
  const provenance = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      buildRevision: "b".repeat(40),
      runtimeVersion: "0.2.1",
      source,
      buildDelivery: source,
      recipe,
      platforms: Object.fromEntries(
        nativeTargets.map((target) => [target, {}])
      ),
      assets
    })
  );
  downloaded.set(99, provenance);
  remoteAssets.push({
    id: 99,
    name: "record-native-build-0.2.1.json",
    size: provenance.length,
    digest: `sha256:${hash(provenance)}`
  });
  return { recipe, source, downloaded, remoteAssets, assets, provenance };
}

test("reuse requires the pinned evidence and every published runtime byte", () => {
  const { recipe, source, downloaded, remoteAssets } = runtimeFixture();
  const input = {
    provenanceId: 99,
    source,
    recipe,
    runtimeVersion: "0.2.1",
    releaseId: 7,
    remoteAssets,
    downloaded
  };
  validateRuntimeReuse(input);
  // A renamed proof cannot turn old bytes into the new source version.
  assert.throws(
    () =>
      validateRuntimeReuse({
        ...input,
        runtimeVersion: "9.8.7",
        remoteAssets: remoteAssets.map((item) =>
          item.id === 99
            ? { ...item, name: "record-native-build-9.8.7.json" }
            : item
        )
      }),
    /runtime version does not match frozen source/
  );
  assert.throws(() =>
    validateRuntimeReuse({
      ...input,
      source: { ...source, files: ["different"] }
    })
  );
  assert.throws(() =>
    validateRuntimeReuse({
      ...input,
      recipe: { ...recipe, [nativeBuildRecipePaths[0]]: "e".repeat(64) }
    })
  );
  assert.throws(() => validateRuntimeReuse({ ...input, releaseId: 0 }));
  assert.throws(() => validateRuntimeReuse({ ...input, provenanceId: 98 }));
  assert.throws(() =>
    validateRuntimeReuse({
      ...input,
      remoteAssets: remoteAssets.map((item) =>
        item.id === 1 ? { ...item, digest: null } : item
      )
    })
  );
  // Equal-size damage distinguishes byte hashing from size-only checks, and
  // each role/target must be verified rather than only the first runtime.
  for (const asset of remoteAssets.filter((entry) => entry.id !== 99)) {
    const damaged = Uint8Array.from(downloaded.get(asset.id)!);
    damaged[0] = damaged[0]! ^ 1;
    assert.throws(() =>
      validateRuntimeReuse({
        ...input,
        downloaded: new Map(downloaded).set(asset.id, damaged)
      })
    );
  }
});

test("recovery accepts absent or partial publication but rejects conflicting published bytes", () => {
  const { recipe, source, downloaded, remoteAssets, assets, provenance } =
    runtimeFixture();
  // A failed first publication may have uploaded any strict prefix of runtime assets,
  // without uploading the separate proof. The recovery ZIP was uploaded first.
  const entries: Record<string, Uint8Array> = {
    "record-native-build-0.2.1.json": provenance
  };
  for (const item of assets) {
    const remote = remoteAssets.find((entry) => entry.name === item.name)!;
    entries[item.name] = downloaded.get(remote.id)!;
  }
  const recoveryBytes = zipSync(entries);
  const recovery = {
    id: 100,
    name: "record-native-recovery-0.2.1.zip",
    size: recoveryBytes.length,
    digest: `sha256:${hash(recoveryBytes)}`
  };
  for (const count of [0, 1, assets.length]) {
    const partial = [
      recovery,
      ...remoteAssets.filter((item) => item.id <= count)
    ];
    const partialBytes = new Map(downloaded);
    partialBytes.set(100, recoveryBytes);
    const recovered = validateRuntimeRecovery({
      source,
      recipe,
      runtimeVersion: "0.2.1",
      releaseId: 7,
      recoveryId: 100,
      remoteAssets: partial,
      downloaded: partialBytes
    });
    assert.equal(recovered.buildRevision, "b".repeat(40));
    if (count === 1) {
      const conflict = partial.map((item) =>
        item.id === 1 ? { ...item, digest: `sha256:${"f".repeat(64)}` } : item
      );
      assert.throws(() =>
        validateRuntimeRecovery({
          source,
          recipe,
          runtimeVersion: "0.2.1",
          releaseId: 7,
          recoveryId: 100,
          remoteAssets: conflict,
          downloaded: partialBytes
        })
      );
    }
  }
  const recoveryInput = {
    source,
    recipe,
    runtimeVersion: "0.2.1",
    releaseId: 7,
    recoveryId: 100,
    remoteAssets: [recovery, ...remoteAssets],
    downloaded: new Map(downloaded).set(100, recoveryBytes)
  };
  validateRuntimeRecovery(recoveryInput);
  const invalidRecovery = new Map(recoveryInput.downloaded).set(
    100,
    Buffer.from("modified")
  );
  assert.throws(() =>
    validateRuntimeRecovery({ ...recoveryInput, downloaded: invalidRecovery })
  );
  const damagedProof = Uint8Array.from(provenance);
  damagedProof[0] = damagedProof[0]! ^ 1;
  const wrongProof = new Map(recoveryInput.downloaded).set(99, damagedProof);
  assert.throws(() =>
    validateRuntimeRecovery({ ...recoveryInput, downloaded: wrongProof })
  );
});
