import { copyRuntimeScriptsSync } from "../../shared/tests/distribution-fixture.ts";
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

test("standalone Node TS performs one native Decisions HTTP exchange with compatible dependencies and preserves raw plus normalized", async (context) => {
  const fixture = logFixture();
  let count = 0;
  let requestFailure: unknown;
  let activeChild: ReturnType<typeof spawn> | undefined;
  let childClosed: Promise<void> | undefined;
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
        requestFailure = error;
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
    const entry = path.join(fixture.directory, "judgment.ts");
    copyRuntimeScriptsSync(
      new URL(
        "../../../skills/lightweight-judgment/scripts/lightweight-judgment.ts",
        import.meta.url
      ),
      path.dirname(entry)
    );
    fs.copyFileSync(
      new URL(
        "../../../skills/lightweight-judgment/scripts/lightweight-judgment.ts",
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
      activeChild = child;
      childClosed = new Promise<void>((closed) =>
        child.once("close", () => closed())
      );
      let stdout = "",
        stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      let failure: Error | undefined;
      const fail = (error: Error) => {
        failure ??= error;
        child.kill("SIGKILL");
      };
      const abort = () => fail(new Error("native Decisions child aborted"));
      context.signal.addEventListener("abort", abort, { once: true });
      const deadline = setTimeout(
        () => fail(new Error("native Decisions child timed out")),
        3000
      );
      child.once("error", fail);
      child.once("close", (code) => {
        clearTimeout(deadline);
        context.signal.removeEventListener("abort", abort);
        if (failure !== undefined) reject(failure);
        else resolve({ code, stdout, stderr });
      });
      if (context.signal.aborted) abort();
    });
    assert.ifError(requestFailure);
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
    if (activeChild?.exitCode === null && activeChild.signalCode === null)
      activeChild.kill("SIGKILL");
    await childClosed;
    try {
      if (server.listening) {
        const closed = new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
        server.closeAllConnections();
        await closed;
      }
    } finally {
      fixture.cleanup();
    }
  }
});
