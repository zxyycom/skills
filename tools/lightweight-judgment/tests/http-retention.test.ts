import assert from "node:assert/strict";
import { test } from "node:test";
import { runCli } from "../src/cli.ts";
import { decodeFailure } from "./output.ts";
import { args } from "./runtime-fixture.ts";
import { logFixture, rows } from "./log-fixture.ts";

test("incomplete error bodies preserve known HTTP failure and retry hints with optional logging", async () => {
  const fixture = logFixture();
  try {
    for (const enabled of [false, true])
      for (const saveResponse of [false, true]) {
        for (const status of [401, 429])
          for (const mode of ["read-error", "timeout"]) {
            const deferred = Promise.withResolvers<Uint8Array>();
            let sent = 0;
            const body = new ReadableStream<Uint8Array>({
              async start(controller) {
                if (mode === "read-error")
                  controller.error(new Error("private-body-error"));
                else {
                  controller.enqueue(await deferred.promise);
                  controller.close();
                }
              }
            });
            const result = await runCli(
              [...args, "--timeout-ms", "10"],
              fixture.runtime(
                { enabled, saveResponse },
                {
                  fetch: async () => {
                    sent++;
                    return new Response(body, {
                      status,
                      headers: { "retry-after": "7" }
                    });
                  }
                }
              )
            );
            const output = decodeFailure(result.stdout);
            assert.equal(result.exitCode, 3);
            assert.equal(
              output.error.kind,
              status === 401 ? "authentication" : "rate_limit"
            );
            assert.equal(output.error.httpStatus, status);
            assert.equal(output.error.retryAfterMs, 7000);
            assert.equal(sent, 1);
            assert.ok(!result.stdout.includes("private-body-error"));
            const before = enabled ? rows(fixture.databasePath) : [];
            if (enabled) {
              const row = before.find(
                (item) => item.id === output.meta.persistence?.callId
              );
              assert.ok(row);
              assert.equal(row.status, "failed");
              assert.equal(row.error_kind, output.error.kind);
              assert.equal(row.http_status, status);
              assert.equal(row.response_body, null);
              assert.equal(output.meta.persistence?.status, "recorded");
            }
            deferred.resolve(new TextEncoder().encode("late response"));
            await new Promise<void>((resolve) => setImmediate(resolve));
            if (enabled) assert.deepEqual(rows(fixture.databasePath), before);
          }
      }
  } finally {
    fixture.cleanup();
  }
});
