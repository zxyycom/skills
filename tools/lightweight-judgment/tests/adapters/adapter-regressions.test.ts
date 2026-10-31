import { copyRuntimeScriptsSync } from "../../../shared/tests/distribution-fixture.ts";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import test from "node:test";
import { imageRequest, pngFixture } from "./images/adapter-image-fixture.ts";
import { logFixture } from "../logging/log-fixture.ts";
import { decodeSuccess, object } from "../support/output.ts";

test("Node standalone accepts large canonical inline PNG without regex stack overflow", () => {
  const fixture = logFixture();
  try {
    const png = pngFixture(1200, 1200);
    assert.ok(png.bytes.length > 4 * 1024 * 1024);
    assert.ok(png.bytes.length < 16 * 1024 * 1024);
    assert.deepEqual(inflateSync(png.compressed), png.pixels);
    const base64 = png.bytes.toString("base64");
    assert.ok(base64.length > 5_000_000);
    const entry = path.join(fixture.directory, "judgment.ts");
    copyRuntimeScriptsSync(
      new URL(
        "../../../../skills/lightweight-judgment/scripts/lightweight-judgment.ts",
        import.meta.url
      ),
      path.dirname(entry)
    );
    fs.copyFileSync(
      new URL(
        "../../../../skills/lightweight-judgment/scripts/lightweight-judgment.ts",
        import.meta.url
      ),
      entry
    );
    const config = path.join(fixture.directory, "config.json");
    fs.writeFileSync(
      config,
      JSON.stringify({
        adapter: "typesafe",
        endpoint: "https://not-called.invalid/v1/systemone",
        model: "jev-1.14.0",
        apiKeyEnv: "UNSET_FIXTURE_KEY",
        images: true,
        logging: { enabled: true, databasePath: fixture.databasePath }
      })
    );
    const source = path.join(fixture.directory, "request.json");
    fs.writeFileSync(source, imageRequest(base64));
    const child = spawnSync(
      "node",
      [entry, "--config", config, "json", "--file", source, "--dry-run"],
      {
        cwd: fixture.directory,
        env: { PATH: process.env.PATH, HOME: fixture.directory },
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024
      }
    );
    assert.equal(child.status, 0, child.stderr);
    const output = decodeSuccess(child.stdout);
    assert.equal(output.meta.attempts, 0);
    const assets = object(object(output.result.request).assets);
    const [reference] = Object.keys(assets);
    assert.equal(object(assets[reference]).data_base64, base64);
    assert.equal(object(assets[reference]).format, "png");
    assert.equal(fs.existsSync(fixture.databasePath), false);
  } finally {
    fixture.cleanup();
  }
});
