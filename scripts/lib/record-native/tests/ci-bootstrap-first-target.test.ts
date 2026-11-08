import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { localSkillState } from "../../../../tools/skill-updater/src/installation.ts";
import { installFirstCandidate } from "../ci-bootstrap-scenarios.ts";

test("fresh bootstrap uses an empty target while legacy keeps its sentinel before activation", async () => {
  const temp = await fs.mkdtemp(
    path.join(os.tmpdir(), "bootstrap-first-target-")
  );
  try {
    for (const legacy of [false, true]) {
      const target = path.join(temp, legacy ? "legacy" : "fresh");
      if (legacy) {
        await fs.mkdir(target);
        await fs.writeFile(
          path.join(target, "SKILL.md"),
          '---\nname: decision-records\nmetadata:\n  version: "109"\n---\n'
        );
      }
      const calls: string[] = [];
      const entry = {
        async run(args: string[]) {
          const mode = args[0];
          calls.push(mode ?? "");
          const state = await localSkillState(target, "decision-records");
          assert.equal(state.state, legacy ? "versioned" : "unversioned");
          const contents = await fs.readdir(target);
          assert.equal(contents.includes("sentinel.txt"), legacy);
          if (mode === "--check") return 1;
          assert.equal(mode, "--yes");
          await fs.writeFile(
            path.join(target, "SKILL.md"),
            '---\nname: decision-records\nmetadata:\n  version: "110"\n---\n'
          );
          return 0;
        }
      };
      await installFirstCandidate(target, legacy, entry);
      assert.deepEqual(calls, ["--check", "--yes"]);
      assert.equal(
        await fs.readFile(path.join(target, "sentinel.txt"), "utf8"),
        "keep"
      );
    }
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
