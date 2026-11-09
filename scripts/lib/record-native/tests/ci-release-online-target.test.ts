import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { installOnlineTarget } from "../ci-release-online-target.ts";

const installation = pathToFileURL(
  path.resolve("tools/skill-updater/src/installation.ts")
).href;

test("online bootstrap uses an empty fresh target and preserves an existing sentinel", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "online-first-target-"));
  try {
    for (const existing of [false, true]) {
      const target = path.join(temp, existing ? "existing" : "fresh");
      const script = path.join(temp, `${existing ? "existing" : "fresh"}.mjs`);
      const log = path.join(temp, `${existing ? "existing" : "fresh"}.log`);
      if (existing) {
        await fs.mkdir(target);
        await fs.writeFile(
          path.join(target, "SKILL.md"),
          '---\nname: decision-records\nmetadata:\n  version: "109"\n---\n'
        );
      }
      await fs.writeFile(
        script,
        `
        import assert from "node:assert/strict";
        import fs from "node:fs/promises";
        import path from "node:path";
        import { localSkillState } from ${JSON.stringify(installation)};
        const args = process.argv.slice(2);
        assert.deepEqual(args.slice(-2), ["--release-tag", "skills-latest"]);
        const destination = args[args.indexOf("--target-dir") + 1];
        const state = await localSkillState(destination, "decision-records");
        assert.equal(state.state, ${JSON.stringify(existing ? "versioned" : "unversioned")});
        assert.equal((await fs.readdir(destination)).includes("sentinel.txt"), ${existing});
        await fs.appendFile(${JSON.stringify(log)}, args[0] + "\\n");
        if (args[0] === "--check") process.exitCode = 1;
        else {
          assert.equal(args[0], "--yes");
          await fs.writeFile(path.join(destination, "SKILL.md"), ${JSON.stringify('---\nname: decision-records\nmetadata:\n  version: "110"\n---\n')});
        }
      `
      );
      await installOnlineTarget(target, existing, script, temp);
      assert.equal(await fs.readFile(log, "utf8"), "--check\n--yes\n");
      assert.equal(
        await fs.readFile(path.join(target, "sentinel.txt"), "utf8"),
        "keep"
      );
    }
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
