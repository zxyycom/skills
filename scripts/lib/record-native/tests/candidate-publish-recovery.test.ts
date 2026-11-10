import assert from "node:assert/strict";
import test from "node:test";
import { fixture, commit, hash } from "./candidate-publish-fixture.ts";
import {
  publishCandidateRelease,
  type CandidatePublishRemote
} from "../candidate-publish.ts";
import {
  validateRuntimeRecovery,
  type RemoteAsset
} from "../ci-release-reuse.ts";

test("rolling upload verifies recovery before runtime and resumes from exact published bytes", async () => {
  const release = fixture(false, "0.2.1");
  let tag: string | undefined;
  let notes = "";
  let latest: { tag: string; id: number } | undefined;
  let next = 1;
  let interrupt = true;
  const events: string[] = [];
  const stored = new Map<
    string,
    {
      id: number;
      name: string;
      size: number;
      digest: string;
      bytes: Uint8Array;
    }
  >();
  const remote: CandidatePublishRemote = {
    async readTag() {
      return tag;
    },
    async readRelease() {
      events.push("read");
      return tag ? [...stored.values()] : undefined;
    },
    async readReleaseId() {
      return tag ? 17 : undefined;
    },
    async readNotes() {
      return notes;
    },
    async updateNotes(_tag, value) {
      notes = value;
    },
    async readLatest() {
      return latest;
    },
    async markLatest() {
      latest = { tag: "skills-latest", id: 17 };
    },
    async updateRollingTag(value) {
      tag = value;
    },
    async createRelease(_tag, value, _assets, _rolling, valueNotes) {
      tag = value;
      notes = valueNotes;
    },
    async upload(_tag, asset) {
      events.push(`upload:${asset.name}`);
      if (
        interrupt &&
        asset.name === "investigation-report-0.2.1-x86_64-unknown-linux-gnu.zip"
      ) {
        interrupt = false;
        throw new Error("interrupt after first runtime");
      }
      stored.set(asset.name, {
        id: next++,
        name: asset.name,
        size: asset.size,
        digest: asset.digest,
        bytes: Uint8Array.from(asset.bytes)
      });
    },
    async deleteLegacy() {
      throw new Error("unexpected legacy deletion");
    }
  };
  const request = {
    release,
    mode: "rolling" as const,
    commit,
    packageHash: hash
  };
  assert.equal(
    (await publishCandidateRelease(request, remote)).status,
    "failed"
  );
  const firstUpload = events.findIndex((event) => event.startsWith("upload:"));
  assert.equal(events[firstUpload], "upload:record-native-recovery-0.2.1.zip");
  assert.equal(events[firstUpload + 1], "read");
  assert.ok(stored.has("decision-records-0.2.1-x86_64-unknown-linux-gnu.zip"));
  assert.ok(!stored.has("record-native-build-0.2.1.json"));
  const remoteAssets: RemoteAsset[] = [...stored.values()];
  const downloaded = new Map(
    [...stored.values()].map((entry) => [entry.id, entry.bytes])
  );
  const recovered = validateRuntimeRecovery({
    runtimeVersion: "0.2.1",
    releaseId: 17,
    recoveryId: stored.get("record-native-recovery-0.2.1.zip")!.id,
    source: { sha256: hash, files: [] },
    recipe: release.provenance.recipeHashes,
    remoteAssets,
    downloaded
  });
  assert.equal(recovered.assets.length, 4);
  const prior = stored.get(
    "decision-records-0.2.1-x86_64-unknown-linux-gnu.zip"
  )!;
  const conflict = { ...prior, digest: `sha256:${"0".repeat(64)}` };
  stored.set(prior.name, conflict);
  assert.match(
    (await publishCandidateRelease(request, remote)).error!,
    /immutable runtime conflict/
  );
  assert.deepEqual(stored.get(prior.name), conflict);
  stored.set(prior.name, prior);
  assert.equal(
    (await publishCandidateRelease(request, remote)).status,
    "updated"
  );
  const runtimes = release.assets.filter((entry) =>
    /^(decision-records|investigation-report)-0\.2\.1-/.test(entry.asset.name)
  );
  assert.equal(runtimes.length, 4);
  for (const asset of runtimes) {
    assert.deepEqual(
      stored.get(asset.asset.name)?.bytes,
      Uint8Array.from(asset.bytes)
    );
  }
  assert.ok(stored.has("record-native-build-0.2.1.json"));
  assert.ok(stored.has("skill-release-manifest.json"));
});
