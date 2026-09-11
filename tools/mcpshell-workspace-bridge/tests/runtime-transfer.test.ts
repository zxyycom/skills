import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runWorkspaceOperation } from "../src/runtime.ts";
import { capturedTextLimit } from "../src/shared.ts";
import { fixture, runtime } from "./runtime-test-support.ts";

test("workspace put and get preserve binary and empty-file bytes with both endpoint hashes", async () => {
  const value = await fixture();
  const binary = Buffer.alloc(capturedTextLimit + 1, 0x62);
  binary[0] = 0;
  binary[1] = 255;
  await fs.writeFile(path.join(value.staging, "binary.bin"), binary);
  await fs.writeFile(path.join(value.staging, "empty.bin"), Buffer.alloc(0));
  const binaryPut = await runWorkspaceOperation(
    "put-file",
    { sourcePath: "binary.bin", destinationPath: "from-agent.bin" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(binaryPut.ok, true);
  assert.equal(binaryPut.evidence?.bytes, binary.length);
  const emptyPut = await runWorkspaceOperation(
    "put-file",
    { sourcePath: "empty.bin", destinationPath: "empty.bin" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(emptyPut.ok, true);
  const get = await runWorkspaceOperation(
    "get-file",
    { sourcePath: "from-agent.bin", destinationPath: "roundtrip.bin" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(get.ok, true);
  assert.deepEqual(
    await fs.readFile(path.join(value.staging, "roundtrip.bin")),
    binary
  );
  assert.equal(get.evidence?.sha256, binaryPut.evidence?.sha256);
});

test("workspace file transfer respects replace, rejects escapes, and cleans failed receives", async () => {
  const value = await fixture();
  await fs.writeFile(path.join(value.staging, "source.txt"), "new\n");
  await fs.writeFile(path.join(value.project, "destination.txt"), "old\n");
  const exists = await runWorkspaceOperation(
    "put-file",
    { sourcePath: "source.txt", destinationPath: "destination.txt" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(exists.failure_kind, "destination_exists");
  const replaced = await runWorkspaceOperation(
    "put-file",
    {
      sourcePath: "source.txt",
      destinationPath: "destination.txt",
      replace: true
    },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(replaced.ok, true);
  assert.equal(
    await fs.readFile(path.join(value.project, "destination.txt"), "utf8"),
    "new\n"
  );
  const escaped = await runWorkspaceOperation(
    "get-file",
    { sourcePath: "../secret", destinationPath: "nope" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(escaped.failure_kind, "path_rejected");
  await fs.writeFile(path.join(value.staging, "existing.txt"), "existing\n");
  const getExists = await runWorkspaceOperation(
    "get-file",
    { sourcePath: "destination.txt", destinationPath: "existing.txt" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(getExists.failure_kind, "destination_exists");
  assert.equal(
    await fs.readFile(path.join(value.staging, "existing.txt"), "utf8"),
    "existing\n"
  );
  const temporaryEntries = (await fs.readdir(value.staging)).filter((name) =>
    name.includes(".mcpshell-")
  );
  assert.deepEqual(temporaryEntries, []);
});

test("workspace put reports an SSH spawn failure as transport failure", async () => {
  const value = await fixture();
  await fs.writeFile(path.join(value.staging, "source.txt"), "new\n");
  const result = await runWorkspaceOperation(
    "put-file",
    { destinationPath: "unwritten.txt", sourcePath: "source.txt" },
    value.bridgeConfig,
    { sshExecutable: "/definitely/not/a/command", timeoutMs: 1_000 }
  );
  assert.equal(result.failure_kind, "transport_failure");
  await assert.rejects(fs.access(path.join(value.project, "unwritten.txt")));
});
