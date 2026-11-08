import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { zipSync } from "fflate";
import { nativeBuildRecipePaths } from "../candidate-build-recipe.ts";
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
test("reuse requires the pinned evidence and every published runtime byte", () => {
  const recipe = Object.fromEntries(
    nativeBuildRecipePaths.map((name) => [name, "d".repeat(64)])
  );
  const source = { sha256: "a".repeat(64), files: ["Cargo.toml"] };
  const downloaded = new Map<number, Uint8Array>();
  const remoteAssets: RemoteAsset[] = [];
  const assets = nativeRoles.flatMap((role) =>
    nativeTargets.map((target) => {
      const name = `${role}-0.2.0-${target}.zip`;
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
      runtimeVersion: "0.2.0",
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
    name: "record-native-build-0.2.0.json",
    size: provenance.length,
    digest: `sha256:${hash(provenance)}`
  });
  const input = {
    provenanceId: 99,
    source,
    recipe,
    releaseId: 7,
    remoteAssets,
    downloaded
  };
  validateRuntimeReuse(input);
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
  // A failed first publication may have uploaded any strict prefix of runtime assets,
  // without uploading the separate proof. The recovery ZIP was uploaded first.
  const entries: Record<string, Uint8Array> = {
    "record-native-build-0.2.0.json": provenance
  };
  for (const item of assets) {
    const remote = remoteAssets.find((entry) => entry.name === item.name)!;
    entries[item.name] = downloaded.get(remote.id)!;
  }
  const recoveryBytes = zipSync(entries);
  const recovery = {
    id: 100,
    name: "record-native-recovery-0.2.0.zip",
    size: recoveryBytes.length,
    digest: `sha256:${hash(recoveryBytes)}`
  };
  for (let count = 0; count <= 4; count++) {
    const partial = [
      recovery,
      ...remoteAssets.filter((item) => item.id <= count)
    ];
    const partialBytes = new Map(downloaded);
    partialBytes.set(100, recoveryBytes);
    const recovered = validateRuntimeRecovery({
      source,
      recipe,
      releaseId: 7,
      recoveryId: 100,
      remoteAssets: partial,
      downloaded: partialBytes
    });
    assert.equal(recovered.buildRevision, "b".repeat(40));
    if (count) {
      const conflict = partial.map((item) =>
        item.id === 1 ? { ...item, digest: `sha256:${"f".repeat(64)}` } : item
      );
      assert.throws(() =>
        validateRuntimeRecovery({
          source,
          recipe,
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
  const wrongProof = new Map(recoveryInput.downloaded).set(
    99,
    Buffer.from("modified")
  );
  assert.throws(() =>
    validateRuntimeRecovery({ ...recoveryInput, downloaded: wrongProof })
  );
  downloaded.set(1, Buffer.from("wrong"));
  assert.throws(() => validateRuntimeReuse(input));
});
