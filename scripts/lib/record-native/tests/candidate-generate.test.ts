import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parse } from "yaml";
import { candidateLock } from "../candidate-lock.ts";
import { digestNativeSource } from "../capture.ts";
import { generatePrivateNativeCandidate } from "../candidate-generate.ts";
import { stageNativeCandidateInputs } from "../staging.ts";

test("candidate lock retains only reachable frozen updater dependencies", async () => {
  const lock = await fs.readFile("skills/decision-records/pnpm-lock.yaml");
  const original = parse(lock.toString());
  const names = ["@types/node", "fflate", "valibot", "yaml"];
  const dependencies = Object.fromEntries(
    names.map((name) => [
      name,
      original.importers["."].dependencies[name].specifier
    ])
  );
  const manifest = Buffer.from(JSON.stringify({ dependencies }));
  const pruned = parse(candidateLock(manifest, lock).toString());
  assert.deepEqual(
    Object.keys(pruned.packages).sort(),
    [
      "@types/node@26.6.5",
      "fflate@0.8.3",
      "undici-types@8.9.0",
      "valibot@1.5.0",
      "yaml@2.9.1"
    ].sort()
  );
  assert.deepEqual(
    Object.keys(pruned.snapshots).sort(),
    Object.keys(pruned.packages).sort()
  );
  delete original.snapshots["undici-types@8.9.0"];
  assert.throws(
    () => candidateLock(manifest, Buffer.from(JSON.stringify(original))),
    /dependency record missing/
  );
});

test("frozen candidate generation refuses missing or mismatched delivery inputs", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "native-frozen-generation-")
  );
  try {
    const source = [{ path: "Cargo.toml", data: Buffer.from("fixture") }];
    const delivery = [{ path: "package.json", data: Buffer.from("{}") }];
    const snapshot = {
      skills: { skills: [], filesBySkill: new Map() },
      source,
      sourceHash: digestNativeSource(source),
      delivery,
      deliveryHash: digestNativeSource(delivery)
    };
    const stage = await stageNativeCandidateInputs(root, snapshot);
    await assert.rejects(
      generatePrivateNativeCandidate(stage, snapshot, "0.1.0", "unused"),
      /frozen candidate generator missing/
    );
    const wrong = { ...snapshot, deliveryHash: "0".repeat(64) };
    await assert.rejects(
      generatePrivateNativeCandidate(stage, wrong, "0.1.0", "unused"),
      /staged delivery differs/
    );
    await fs.writeFile(path.join(stage, "delivery/package.json"), "changed");
    await assert.rejects(
      generatePrivateNativeCandidate(stage, snapshot, "0.1.0", "unused"),
      /staged delivery differs/
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
