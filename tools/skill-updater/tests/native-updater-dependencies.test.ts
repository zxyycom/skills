import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parse, stringify } from "yaml";

test("updater validation reuses only compatible explicit dependencies in a child", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "native-updater-dependencies-")
  );
  try {
    await fs.mkdir(path.join(root, "scripts"));
    const script = path.join(root, "scripts/update-skill.ts");
    await fs.writeFile(
      script,
      'import { object } from "valibot"; console.log(typeof object);\n'
    );
    const manifest = JSON.parse(
      await fs.readFile(path.resolve("package.json"), "utf8")
    );
    const rootLock = parse(
      await fs.readFile(path.resolve("pnpm-lock.yaml"), "utf8")
    );
    const names = ["@types/node", "fflate", "valibot", "yaml"];
    const dependencies = Object.fromEntries(
      names.map((name) => [name, manifest.devDependencies[name]])
    );
    const locked = Object.fromEntries(
      names.map((name) => [name, rootLock.importers["."].devDependencies[name]])
    );
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ type: "module", dependencies })
    );
    await fs.writeFile(
      path.join(root, "pnpm-lock.yaml"),
      stringify({ importers: { ".": { dependencies: locked } } })
    );
    const direct = () =>
      spawnSync("node", [script, "--help"], {
        encoding: "utf8",
        env: { ...process.env, NODE_OPTIONS: "" }
      });
    const validation = () =>
      spawnSync(
        "node",
        [
          "--input-type=module",
          "-e",
          `import { verifyPreparedUpdater } from './tools/skill-updater/src/native/runtime-validation.ts'; await verifyPreparedUpdater(process.argv[1]);`,
          root
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: { ...process.env, NODE_OPTIONS: "" }
        }
      );
    assert.notEqual(direct().status, 0);
    assert.equal(validation().status, 0);
    assert.notEqual(direct().status, 0);
    await assert.rejects(fs.lstat(path.join(root, "node_modules")), {
      code: "ENOENT"
    });
    dependencies.valibot = "incompatible";
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ type: "module", dependencies })
    );
    const incompatible = validation();
    assert.notEqual(incompatible.status, 0);
    assert.match(incompatible.stderr, /dependency manifest differs/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
