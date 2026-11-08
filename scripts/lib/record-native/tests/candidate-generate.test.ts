import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { digestNativeSource } from "../capture.ts";
import { generatePrivateNativeCandidate } from "../candidate-generate.ts";
import { stageNativeCandidateInputs } from "../staging.ts";

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
