import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { decodeSuccess, decodeFailure, object } from "./output.ts";

const entry = path.resolve(
  import.meta.dirname,
  "../../../skills/lightweight-judgment/scripts/lightweight-judgment.mjs"
);
test("distributed mjs works without workspace dependencies and import has no side effects", async () => {
  const temp = await fs.mkdtemp(
    path.join(os.tmpdir(), "lightweight-judgment-smoke-")
  );
  try {
    const standalone = path.join(temp, "lightweight-judgment.mjs");
    await fs.copyFile(entry, standalone);
    const env = {
      PATH: process.env.PATH,
      HOME: temp,
      LIGHTWEIGHT_JUDGMENT_CONFIG: path.join(temp, "missing"),
      OPENROUTER_API_KEY: "do-not-print"
    };
    const help = spawnSync("node", [standalone, "--help"], {
      env,
      cwd: temp,
      encoding: "utf8"
    });
    assert.equal(help.status, 0);
    assert.ok(help.stdout.includes("Usage:"));
    assert.equal(help.stderr, "");
    const imported = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `await import(${JSON.stringify(standalone)}); process.stdout.write('imported');`
      ],
      { env, cwd: temp, encoding: "utf8" }
    );
    assert.equal(imported.status, 0);
    assert.equal(imported.stdout, "imported");
    assert.equal(imported.stderr, "");
    await fs.writeFile(path.join(temp, "config.json"), "{}");
    env.LIGHTWEIGHT_JUDGMENT_CONFIG = path.join(temp, "config.json");
    const dry = spawnSync("node", [standalone, "json", "-", "--dry-run"], {
      env,
      cwd: temp,
      encoding: "utf8",
      input:
        '{"state":["native",1],"questions":{"a":{"type":"noul","instructions":"yes?"}}}'
    });
    assert.equal(dry.status, 0);
    assert.deepEqual(object(decodeSuccess(dry.stdout).result.request).state, [
      "native",
      1
    ]);
    assert.equal(dry.stdout.includes("do-not-print"), false);
    assert.equal(dry.stderr, "");
    const invalidUtf8 = spawnSync(
      "node",
      [standalone, "json", "-", "--dry-run"],
      { env, cwd: temp, encoding: "utf8", input: Buffer.from([0xff]) }
    );
    assert.equal(invalidUtf8.status, 2);
    assert.equal(decodeFailure(invalidUtf8.stdout).error.kind, "input");
    assert.deepEqual((await fs.readdir(temp)).sort(), [
      "config.json",
      "lightweight-judgment.mjs"
    ]);
    const bad = spawnSync("node", [standalone, "json", "--json", "{}"], {
      env,
      cwd: temp,
      encoding: "utf8"
    });
    assert.equal(bad.status, 2);
    assert.equal(decodeFailure(bad.stdout).error.kind, "input");
    assert.ok(bad.stderr.length > 0);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
