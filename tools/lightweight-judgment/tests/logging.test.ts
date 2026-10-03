import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { runCli } from "../src/cli.ts";
import { decodeFailure, decodeSuccess } from "./output.ts";
import { args, request, runtime } from "./runtime-fixture.ts";
import { logFixture, rows } from "./log-fixture.ts";

test("logged timeout remains indeterminate even if the transport resolves after the deadline", async () => {
  const fixture = logFixture();
  try {
    const deferred = Promise.withResolvers<Response>();
    let sent = 0;
    const result = await runCli(
      [...args, "--timeout-ms", "10"],
      fixture.runtime(
        {},
        {
          fetch: () => {
            sent++;
            return deferred.promise;
          }
        }
      )
    );
    assert.equal(result.exitCode, 3);
    assert.equal(decodeFailure(result.stdout).error.kind, "timeout");
    const before = rows(fixture.databasePath);
    assert.equal(before[0].status, "indeterminate");
    assert.equal(before[0].response_body, null);
    deferred.resolve(await runtime().fetch("https://unused.example", {}));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(rows(fixture.databasePath), before);
    assert.equal(sent, 1);
  } finally {
    fixture.cleanup();
  }
});

test("enabled SQLite logging commits intent before send and independently retains exact request and response", async () => {
  const fixture = logFixture();
  try {
    for (const saveRequest of [false, true])
      for (const saveResponse of [false, true]) {
        let wire = "";
        const response =
          '{ "model":"jev-test", "answers":{"answer":{"type":"noul","noul":0}}, "usage":{"input_tokens":7,"output_tokens":0,"cost":0.001} }';
        const result = await runCli(
          args,
          fixture.runtime(
            { saveRequest, saveResponse },
            {
              fetch: async (_url, init) => {
                const started = rows(fixture.databasePath).filter(
                  (row) => row.status === "started"
                );
                assert.equal(started.length, 1);
                assert.equal(started[0].finished_at, null);
                assert.equal(typeof init.body, "string");
                assert.ok(typeof init.body === "string");
                wire = init.body;
                assert.equal(
                  started[0].request_json,
                  saveRequest ? wire : null
                );
                return new Response(response);
              }
            }
          )
        );
        assert.equal(result.exitCode, 0);
        const id = decodeSuccess(result.stdout).meta.persistence?.callId;
        const row = rows(fixture.databasePath).find((item) => item.id === id);
        assert.ok(row);
        assert.equal(row.status, "succeeded");
        assert.equal(row.http_status, 200);
        assert.equal(row.request_json, saveRequest ? wire : null);
        assert.equal(row.save_request, Number(saveRequest));
        assert.equal(row.save_response, Number(saveResponse));
        assert.equal(row.response_model, "jev-test");
        assert.equal(row.question_count, 1);
        assert.deepEqual(
          [row.input_tokens, row.output_tokens, row.cost],
          [7, 0, 0.001]
        );
        if (saveResponse) {
          assert.ok(row.response_body instanceof Uint8Array);
          assert.equal(new TextDecoder().decode(row.response_body), response);
        } else assert.equal(row.response_body, null);
        assert.ok(!JSON.stringify(row).includes("private-test-key"));
        assert.deepEqual(JSON.parse(wire), {
          ...request,
          model: "typesafe/jev-1.13"
        });
      }
    assert.equal(rows(fixture.databasePath).length, 4);
    if (process.platform !== "win32")
      assert.equal(fs.statSync(fixture.databasePath).mode & 0o777, 0o600);
  } finally {
    fixture.cleanup();
  }
});

test("durable failures retain raw invalid bodies and distinguish uncertain transport outcomes without retry", async () => {
  const fixture = logFixture();
  try {
    for (const [kind, response] of [
      ["authentication", new Response("remote-private-error", { status: 401 })],
      ["invalid_response", new Response(new Uint8Array([0xff, 0xfe]))],
      ["network", undefined]
    ] as const) {
      let sent = 0;
      const result = await runCli(
        args,
        fixture.runtime(
          {},
          {
            fetch: async () => {
              sent++;
              if (response === undefined)
                throw new Error("remote-private-error");
              return response;
            }
          }
        )
      );
      const output = decodeFailure(result.stdout);
      assert.equal(result.exitCode, 3);
      assert.equal(output.error.kind, kind);
      assert.equal(sent, 1);
      assert.ok(!result.stdout.includes("remote-private-error"));
      const row = rows(fixture.databasePath).find(
        (item) => item.id === output.meta.persistence?.callId
      );
      assert.ok(row);
      assert.equal(row.error_kind, kind);
      assert.equal(row.status, kind === "network" ? "indeterminate" : "failed");
      if (kind === "invalid_response")
        assert.deepEqual(
          Array.from(
            row.response_body instanceof Uint8Array ? row.response_body : []
          ),
          [255, 254]
        );
      if (kind === "authentication") {
        assert.ok(row.response_body instanceof Uint8Array);
        assert.equal(
          new TextDecoder().decode(row.response_body),
          "remote-private-error"
        );
      }
    }
  } finally {
    fixture.cleanup();
  }
});

test("pre-send storage failure blocks HTTP and preserves unrelated databases", async () => {
  const fixture = logFixture();
  try {
    const other = new DatabaseSync(fixture.databasePath);
    other.exec(
      "CREATE TABLE unrelated (value TEXT); INSERT INTO unrelated VALUES ('keep')"
    );
    other.close();
    fs.chmodSync(fixture.databasePath, 0o600);
    let sent = 0;
    const blocked = await runCli(
      args,
      fixture.runtime(
        {},
        {
          fetch: async () => {
            sent++;
            throw new Error("must not send");
          }
        }
      )
    );
    assert.equal(blocked.exitCode, 4);
    assert.equal(decodeFailure(blocked.stdout).error.kind, "storage");
    assert.equal(decodeFailure(blocked.stdout).meta.attempts, 0);
    assert.equal(sent, 0);
    const retained = new DatabaseSync(fixture.databasePath);
    assert.equal(
      retained.prepare("SELECT value FROM unrelated").get()?.value,
      "keep"
    );
    assert.equal(
      retained.prepare("PRAGMA application_id").get()?.application_id,
      0
    );
    retained.close();
    const unusable = await runCli(
      args,
      fixture.runtime({
        databasePath: path.join(fixture.databasePath, "child.db")
      })
    );
    assert.equal(unusable.exitCode, 4);
    assert.equal(decodeFailure(unusable.stdout).meta.attempts, 0);
    if (process.platform !== "win32") {
      fs.chmodSync(fixture.databasePath, 0o644);
      const publicFile = await runCli(args, fixture.runtime());
      assert.equal(publicFile.exitCode, 4);
      assert.equal(decodeFailure(publicFile.stdout).meta.attempts, 0);
      assert.equal(fs.statSync(fixture.databasePath).mode & 0o777, 0o644);
    }
  } finally {
    fixture.cleanup();
  }
});

test("post-send storage failure or removed row preserves service outcome and reports failed persistence", async () => {
  const fixture = logFixture();
  try {
    for (const mode of ["write-error", "missing-row", "remote-error"]) {
      const file = path.join(fixture.directory, `${mode}.sqlite3`);
      let sent = 0;
      const result = await runCli(
        args,
        fixture.runtime(
          { databasePath: file },
          {
            fetch: async (url, init) => {
              sent++;
              const database = new DatabaseSync(file);
              database.exec(
                mode === "missing-row"
                  ? "DELETE FROM calls"
                  : "CREATE TRIGGER fail_write BEFORE UPDATE ON calls BEGIN SELECT RAISE(FAIL, 'private-error'); END"
              );
              database.close();
              if (mode === "remote-error")
                return new Response("private-error", { status: 429 });
              return await runtime().fetch(url, init);
            }
          }
        )
      );
      assert.equal(result.exitCode, 4);
      const output =
        mode === "remote-error"
          ? decodeFailure(result.stdout)
          : decodeSuccess(result.stdout);
      assert.equal(output.meta.persistence?.status, "failed");
      assert.ok(output.meta.persistence?.callId);
      if (output.ok) assert.ok(output.result.answers);
      else assert.equal(output.error.kind, "rate_limit");
      assert.equal(sent, 1);
      assert.ok(!result.stderr.includes("private-error"));
      if (mode === "missing-row") assert.deepEqual(rows(file), []);
      else assert.equal(rows(file)[0].status, "started");
    }
  } finally {
    fixture.cleanup();
  }
});
