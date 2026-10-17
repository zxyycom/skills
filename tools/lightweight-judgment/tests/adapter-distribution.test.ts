import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { input, image, openai, usage } from "./adapter-fixture.ts";
import { object, decodeSuccess } from "./output.ts";
import { logFixture } from "./log-fixture.ts";
import { array } from "./statistics-fixture.ts";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

test("standalone Node bundle performs one native Decisions HTTP exchange without workspace dependencies and preserves raw plus normalized", async () => {
  const fixture = logFixture();
  let count = 0;
  const server = http.createServer((req, res) => {
    count++;
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += String(chunk);
    });
    req.on("end", () => {
      try {
        assert.equal(req.method, "POST");
        assert.equal(req.headers.authorization, "Bearer native-key");
        assert.equal(
          req.headers["typesafe-danger-zone-long-context"],
          undefined
        );
        const raw: unknown = JSON.parse(body);
        const wire = object(raw);
        assert.deepEqual(
          array(wire.questions).map((question) => {
            const q = object(question);
            return [q.name, q.type];
          }),
          [["q0", "predicate"]]
        );
        assert.ok(Array.isArray(wire.input));
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            model: "gpt-6-luna",
            answers: [{ type: "predicate", name: "q0", probability: 0.8 }],
            usage,
            extra: "native"
          })
        );
      } catch (error) {
        res.statusCode = 500;
        res.end(String(error));
      }
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const entry = path.join(fixture.directory, "judgment.mjs");
    fs.copyFileSync(
      new URL(
        "../../../skills/lightweight-judgment/scripts/lightweight-judgment.mjs",
        import.meta.url
      ),
      entry
    );
    const config = path.join(fixture.directory, "config.json");
    fs.writeFileSync(
      config,
      JSON.stringify({
        ...openai,
        endpoint: `http://127.0.0.1:${address.port}/decisions`,
        images: true
      })
    );
    const source = path.join(fixture.directory, "request.json");
    fs.writeFileSync(source, input({ photo: image(), text: "evidence" }));
    const result = await new Promise<{
      code: number | null;
      stdout: string;
      stderr: string;
    }>((resolve, reject) => {
      const child = spawn(
        "node",
        [entry, "--config", config, "json", "--file", source],
        {
          cwd: fixture.directory,
          env: {
            PATH: process.env.PATH,
            HOME: fixture.directory,
            NATIVE_KEY: "native-key"
          },
          stdio: ["ignore", "pipe", "pipe"]
        }
      );
      let stdout = "",
        stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(count, 1);
    const decoded = decodeSuccess(result.stdout);
    assert.equal(decoded.result.extra, "native");
    assert.deepEqual(object(object(decoded.normalized).answers).answer, {
      status: "answered",
      type: "noul",
      noul: 0.8
    });
    assert.equal(decoded.meta.attempts, 1);
  } finally {
    try {
      if (server.listening)
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
    } finally {
      fixture.cleanup();
    }
  }
});
