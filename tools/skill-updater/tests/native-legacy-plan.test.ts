import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { planLegacyHandoff } from "../src/native/legacy-plan.ts";

test("legacy handoff plans only verified managed files and rejects local conflicts", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "legacy-plan-"));
  try {
    await fs.writeFile(
      path.join(root, "SKILL.md"),
      '---\nname: decision-records\nmetadata:\n  version: "109"\n---\n'
    );
    await fs.writeFile(path.join(root, "old.ts"), "abc");
    await fs.writeFile(path.join(root, "custom"), "keep");
    const legacy = {
      version: 109,
      files: {
        "SKILL.md": {
          byteLength: 58,
          sha256:
            "10963513591115589eb4e5af2a8f785244b9eb154d4cd08bb48dbe77a453db74"
        },
        "old.ts": {
          byteLength: 3,
          sha256:
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        }
      }
    };
    assert.deepEqual(
      await planLegacyHandoff(root, "decision-records", legacy, [
        "SKILL.md",
        "native-runtime.json",
        "bin/program"
      ]),
      {
        add: ["bin/program", "native-runtime.json"],
        replace: ["SKILL.md"],
        retire: ["old.ts"]
      }
    );
    await assert.rejects(
      planLegacyHandoff(root, "decision-records", legacy, [
        "SKILL.md",
        "native-runtime.json",
        "custom"
      ]),
      /conflicts with local file/
    );
    await assert.rejects(
      planLegacyHandoff(root, "decision-records", legacy, [
        "SKILL.md",
        "native-runtime.json",
        "node_modules/example"
      ]),
      /dependencies/
    );
    await assert.rejects(
      planLegacyHandoff(root, "decision-records", legacy, [
        "SKILL.md",
        "native-runtime.json",
        "OLD.ts"
      ]),
      /duplicate native path/
    );
    await fs.mkdir(path.join(root, "scripts/decision-records-sdk"), {
      recursive: true
    });
    await fs.writeFile(
      path.join(root, "scripts/decision-records.mjs"),
      "unknown"
    );
    await fs.writeFile(
      path.join(root, "scripts/decision-records-sdk/custom.d.mts"),
      "unknown"
    );
    await fs.writeFile(path.join(root, "scripts/my-own-tool.ts"), "keep");
    await assert.rejects(
      planLegacyHandoff(root, "decision-records", legacy, [
        "SKILL.md",
        "native-runtime.json"
      ]),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("scripts/decision-records.mjs") &&
        error.message.includes("scripts/decision-records-sdk/custom.d.mts")
    );
    assert.equal(
      await fs.readFile(path.join(root, "scripts/my-own-tool.ts"), "utf8"),
      "keep"
    );
    await fs.unlink(path.join(root, "scripts/decision-records.mjs"));
    await fs.unlink(
      path.join(root, "scripts/decision-records-sdk/custom.d.mts")
    );
    await planLegacyHandoff(root, "decision-records", legacy, [
      "SKILL.md",
      "native-runtime.json"
    ]);
    await fs.writeFile(path.join(root, "old.ts"), "edited");
    await assert.rejects(
      planLegacyHandoff(root, "decision-records", legacy, [
        "SKILL.md",
        "native-runtime.json"
      ]),
      /changed or missing/
    );
    assert.equal(await fs.readFile(path.join(root, "custom"), "utf8"), "keep");
    assert.equal(
      await fs.readFile(path.join(root, "old.ts"), "utf8"),
      "edited"
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
