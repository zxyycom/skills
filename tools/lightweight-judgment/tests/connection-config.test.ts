import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { runCli } from "../src/cli.ts";
import { decodeSuccess, object } from "./output.ts";
import { args, runtime } from "./runtime-fixture.ts";
import { logFixture, rows } from "./log-fixture.ts";

test("custom System One endpoint and direct key obey explicit configuration and override boundaries", async () => {
  const config = {
    endpoint: "https://gateway.example/v1/systemone",
    apiKey: "configured-private-key",
    apiKeyEnv: "ALTERNATE",
    model: "jev-latest"
  };
  const sent: { url: string; authorization: string | null }[] = [];
  const rt = runtime({
    env: { ALTERNATE: "environment-key" },
    readFile: async () => JSON.stringify(config),
    fetch: async (url, init) => {
      sent.push({
        url,
        authorization: new Headers(init.headers).get("authorization")
      });
      return await runtime().fetch(url, init);
    }
  });
  const doctor = await runCli(["doctor"], rt);
  assert.equal(decodeSuccess(doctor.stdout).result.credentialSource, "config");
  assert.ok(!doctor.stdout.includes(config.apiKey));
  const result = await runCli(args, rt);
  assert.equal(result.exitCode, 0);
  const override = await runCli(
    [...args, "--endpoint", "http://127.0.0.1:8123/systemone"],
    rt
  );
  assert.equal(override.exitCode, 0);
  assert.deepEqual(sent, [
    { url: config.endpoint, authorization: `Bearer ${config.apiKey}` },
    {
      url: "http://127.0.0.1:8123/systemone",
      authorization: `Bearer ${config.apiKey}`
    }
  ]);
  const fallback = await runCli(
    ["doctor"],
    runtime({
      env: { ALTERNATE: "environment-key" },
      readFile: async () => '{"apiKeyEnv":"ALTERNATE"}'
    })
  );
  assert.equal(
    decodeSuccess(fallback.stdout).result.credentialSource,
    "environment"
  );
  assert.equal(
    (await runCli([...args, "--endpoint", "http://external.example"], rt))
      .exitCode,
    2
  );
});

test("logging defaults off and all offline or preflight paths leave the database absent", async () => {
  const fixture = logFixture();
  try {
    for (const argv of [["--help"], ["doctor"], [...args, "--dry-run"]]) {
      const result = await runCli(argv, fixture.runtime());
      assert.equal(result.exitCode, 0);
    }
    assert.equal(
      (await runCli(args, fixture.runtime({}, { env: {} }))).exitCode,
      2
    );
    assert.equal(
      (await runCli(["json", "--json", "{}"], fixture.runtime())).exitCode,
      2
    );
    assert.equal(
      (await runCli(args, fixture.runtime({ enabled: false }))).exitCode,
      0
    );
    const defaults = fixture.runtime({}, { readFile: async () => "{}" });
    assert.equal((await runCli(args, defaults)).exitCode, 0);
    const doctor = decodeSuccess((await runCli(["doctor"], defaults)).stdout);
    assert.deepEqual(object(doctor.result.logging), {
      enabled: false,
      saveRequest: false,
      saveResponse: true,
      databasePath: path.join(
        fixture.directory,
        ".local/share/lightweight-judgment/calls.sqlite3"
      )
    });
    assert.deepEqual(fs.readdirSync(fixture.directory), []);
  } finally {
    fixture.cleanup();
  }
});

test("logging automatically creates the default database and resolves configured paths without touching offline storage", async () => {
  const fixture = logFixture();
  try {
    const rt = fixture.runtime(
      {},
      { readFile: async () => '{"logging":{"enabled":true}}' }
    );
    const result = await runCli(args, rt);
    assert.equal(result.exitCode, 0);
    const file = path.join(
      fixture.directory,
      ".local/share/lightweight-judgment/calls.sqlite3"
    );
    assert.equal(rows(file)[0].status, "succeeded");
    assert.equal(rows(file)[0].request_json, null);
    assert.ok(rows(file)[0].response_body instanceof Uint8Array);
    if (process.platform !== "win32")
      assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
    for (const [value, expected] of [
      [
        "records/calls.db",
        path.join(fixture.directory, "config/records/calls.db")
      ],
      ["~/records.db", path.join(fixture.directory, "records.db")]
    ]) {
      const doctor = await runCli(
        [
          "--config",
          path.join(fixture.directory, "config/local.json"),
          "doctor"
        ],
        fixture.runtime(
          {},
          {
            readFile: async () =>
              JSON.stringify({ logging: { databasePath: value } })
          }
        )
      );
      assert.equal(
        object(decodeSuccess(doctor.stdout).result.logging).databasePath,
        expected
      );
      assert.equal(fs.existsSync(expected), false);
    }
  } finally {
    fixture.cleanup();
  }
});
