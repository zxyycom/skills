import assert from "node:assert/strict";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { readFileDigest } from "../../src/evidence/evidence.ts";
import { publishEvidence } from "../../src/store/store.ts";
import { complete } from "../fixtures/evidence-state.ts";
import {
  copiedSkill,
  copyVideoDependency,
  fileSnapshot
} from "../fixtures/distribution.ts";
import { runProcess } from "../fixtures/process.ts";

for (const label of ["Node", "Bun"]) {
  test(
    `${label} executes the distributed TS from unrelated cwd with external evidence and no media runtime`,
    { timeout: 30_000 },
    async () =>
      copiedSkill(async ({ directory, installed, entry, home }) => {
        await copyVideoDependency(path.join(installed, "node_modules"));
        const interpreter = label === "Node" ? "node" : process.execPath;
        const output = path.join(directory, "evidence");
        await mkdir(output);
        const index = await complete(output);
        const image = "artifacts/fixture/frame.png";
        await writeFile(path.join(output, image), "immutable synthetic pixels");
        index.frames = {
          entries: [
            {
              id: "F0001",
              requested: 1,
              actual: 1,
              pts: 10,
              timeBase: "1/10",
              streamIndex: 0,
              width: 960,
              image: await readFileDigest(output, image)
            }
          ],
          attempt: { status: "complete" }
        };
        await publishEvidence(output, index);
        const before = await fileSnapshot(installed);
        const invoke = (args: string[]) =>
          runProcess(interpreter, [entry, ...args], {
            cwd: home,
            env: {
              HOME: home,
              USERPROFILE: home,
              BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0"
            },
            reject: false
          });
        const help = await invoke(["--help"]);
        assert.equal(help.exitCode, 0);
        assert.match(help.stdout, /--config/);
        for (const [command, args] of [
          ["read", []],
          ["prepare", ["--input", index.source.file]],
          ["frames", ["--input", index.source.file, "--times", "1"]]
        ] as const) {
          const result = await invoke([
            command,
            "--output",
            output,
            "--format",
            "json",
            ...args
          ]);
          assert.equal(result.exitCode, 0, result.stderr);
          assert.equal(JSON.parse(result.stdout).scopeId, index.scopeId);
          if (command !== "read")
            assert.equal(JSON.parse(result.stdout).reused, true);
        }
        const draft = path.join(directory, "correction.json");
        await writeFile(
          draft,
          JSON.stringify({
            scopeId: index.scopeId,
            action: "create",
            kind: "correction",
            targets: ["T0001"],
            replacement: {
              segments: [{ start: 0, end: 2, text: "calibrated fixture" }]
            },
            reason: "fixture",
            verified: { refs: [], note: "not inspected" }
          })
        );
        const refined = await invoke([
          "refine",
          "--output",
          output,
          "--file",
          draft,
          "--format",
          "json"
        ]);
        assert.equal(refined.exitCode, 0, refined.stderr);
        assert.equal(JSON.parse(refined.stdout).id, "C0001");
        assert.equal((await invoke(["logs", "--output", output])).exitCode, 0);
        const rejected = await invoke([
          "read",
          "--output",
          output,
          "--unknown"
        ]);
        assert.equal(rejected.exitCode, 1);
        assert.equal(rejected.stdout, "");
        assert.match(rejected.stderr, /arguments/);
        assert.deepEqual(await fileSnapshot(installed), before);
        assert.deepEqual(await readdir(home), []);
        assert.equal(
          await readFile(index.source.file, "utf8"),
          "synthetic source"
        );
      })
  );
}

test("ordinary public import exposes only the runner and failure class without executing argv or touching configuration", async () =>
  copiedSkill(async ({ directory, installed, entry, home }) => {
    await copyVideoDependency(path.join(installed, "node_modules"));
    const config = path.join(home, ".config/video-understanding/config.json");
    await mkdir(path.dirname(config), { recursive: true });
    await writeFile(config, "invalid configuration must not be read");
    const before = await fileSnapshot(directory);
    const result = await runProcess(
      "node",
      [
        path.join(import.meta.dirname, "../fixtures/import-public.mjs"),
        entry,
        "--invalid"
      ],
      { cwd: home, env: { HOME: home, USERPROFILE: home } }
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
    assert.deepEqual(await fileSnapshot(directory), before);
  }));

test("public help skips malformed configuration while ordinary commands fail without writing evidence", async () =>
  copiedSkill(async ({ directory, installed, entry, home }) => {
    await copyVideoDependency(path.join(installed, "node_modules"));
    const config = path.join(home, ".config/video-understanding/config.json");
    await mkdir(path.dirname(config), { recursive: true });
    await writeFile(config, "invalid configuration");
    const before = await fileSnapshot(directory);
    const options = {
      cwd: home,
      env: { HOME: home, USERPROFILE: home },
      reject: false
    };
    const help = await runProcess("node", [entry, "--help"], options);
    assert.equal(help.exitCode, 0);
    assert.match(help.stdout, /prepare/);
    const result = await runProcess(
      "node",
      [entry, "read", "--output", path.join(directory, "absent evidence")],
      options
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /arguments/);
    assert.ok(result.stderr.includes(config));
    assert.deepEqual(await fileSnapshot(directory), before);
  }));

for (const state of ["missing", "incompatible"]) {
  test(`${state} dependencies retain the loader diagnostic and explicit recovery without installing`, async () =>
    copiedSkill(async ({ directory, installed, entry, home }) => {
      const target = path.join(installed, "node_modules/valibot");
      await mkdir(target, { recursive: true });
      await writeFile(
        path.join(target, "package.json"),
        JSON.stringify({
          name: "valibot",
          version: "0.0.0",
          type: "module",
          exports: "./index.js"
        })
      );
      if (state === "incompatible") {
        await writeFile(
          path.join(target, "index.js"),
          "export const incompatibleFixture = true;\n"
        );
      }
      const before = await fileSnapshot(directory);
      const result = await runProcess("node", [entry, "--help"], {
        cwd: home,
        env: { HOME: home, USERPROFILE: home },
        reject: false
      });
      assert.equal(result.exitCode, 1);
      assert.equal(result.stdout, "");
      assert.match(
        result.stderr,
        state === "missing" ? /ERR_MODULE_NOT_FOUND/ : /not a function/
      );
      if (state === "missing") {
        assert.ok(result.stderr.includes(path.join(target, "index.js")));
      }
      assert.match(result.stderr, /pnpm --dir/);
      assert.ok(result.stderr.includes(installed.replaceAll("\\", "\\\\")));
      assert.match(
        result.stderr,
        /install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated/
      );
      assert.match(result.stderr, /No installation was attempted/);
      assert.deepEqual(await fileSnapshot(directory), before);
    }));
}

test("compatible ancestor dependencies load the distributed entry without a local dependency directory", async () =>
  copiedSkill(async ({ directory, installed, entry, home }) => {
    await copyVideoDependency(path.join(directory, "node_modules"));
    const result = await runProcess("node", [entry, "--help"], { cwd: home });
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /prepare/);
    await assert.rejects(access(path.join(installed, "node_modules")), {
      code: "ENOENT"
    });
  }));
