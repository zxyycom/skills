import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runWorkspaceOperation } from "../src/runtime.ts";
import { capturedTextLimit } from "../src/shared.ts";
import { fixture, runtime } from "./runtime-test-support.ts";

test("workspace caps captured output and cleans an output-limited get receive", async () => {
  const value = await fixture();
  for (const [stream, command] of [
    ["stdout", `yes x | head -c ${capturedTextLimit + 1}`],
    ["stderr", `yes x | head -c ${capturedTextLimit + 1} >&2`]
  ] as const) {
    const result = await runWorkspaceOperation(
      "shell",
      { command },
      value.bridgeConfig,
      runtime(value)
    );
    assert.equal(result.failure_kind, "output_limit");
    assert.equal(result.target.exit_code, null);
    assert.equal(result.target.timed_out, false);
    assert.equal(result.evidence?.stream, stream);
    assert.equal(result.evidence?.limit, capturedTextLimit);
    assert.ok(Buffer.byteLength(result[stream], "utf8") <= capturedTextLimit);
  }

  const overflowSsh = path.join(
    path.dirname(value.project),
    "stderr-overflow-ssh"
  );
  await fs.writeFile(
    overflowSsh,
    `#!/bin/sh\nyes x | head -c ${capturedTextLimit + 1} >&2\n`
  );
  await fs.chmod(overflowSsh, 0o755);
  const get = await runWorkspaceOperation(
    "get-file",
    { destinationPath: "not-received.txt", sourcePath: "tracked.txt" },
    value.bridgeConfig,
    { sshExecutable: overflowSsh }
  );
  assert.equal(get.failure_kind, "output_limit");
  assert.equal(get.target.exit_code, null);
  assert.equal(get.target.timed_out, false);
  assert.equal(get.evidence?.stream, "stderr");
  assert.equal(get.evidence?.limit, capturedTextLimit);
  await assert.rejects(fs.access(path.join(value.staging, "not-received.txt")));
  const temporaryEntries = (await fs.readdir(value.staging)).filter((name) =>
    name.includes(".mcpshell-")
  );
  assert.deepEqual(temporaryEntries, []);
});

test("workspace put preserves verification evidence after a post-commit output limit", async () => {
  const value = await fixture();
  const source = Buffer.from("committed before output overflow\n");
  await fs.writeFile(path.join(value.staging, "source.txt"), source);
  const overflowSsh = path.join(
    path.dirname(value.project),
    "post-commit-overflow-ssh"
  );
  await fs.writeFile(
    overflowSsh,
    `#!/bin/sh
[ "$1" = "-T" ] && shift
shift
/bin/sh -c "$1"
status=$?
yes x | head -c ${capturedTextLimit + 1} >&2
exit "$status"
`
  );
  await fs.chmod(overflowSsh, 0o755);
  const result = await runWorkspaceOperation(
    "put-file",
    { destinationPath: "possibly-committed.txt", sourcePath: "source.txt" },
    value.bridgeConfig,
    { sshExecutable: overflowSsh }
  );
  assert.equal(result.failure_kind, "outcome_unknown");
  assert.equal(result.evidence?.destination, "possibly-committed.txt");
  assert.equal(result.evidence?.bytes, source.length);
  assert.equal(
    result.evidence?.sha256,
    createHash("sha256").update(source).digest("hex")
  );
  assert.equal(result.evidence?.cause, "output_limit");
  assert.equal(result.evidence?.stream, "stderr");
  assert.equal(result.evidence?.limit, capturedTextLimit);
  assert.deepEqual(
    await fs.readFile(path.join(value.project, "possibly-committed.txt")),
    source
  );
});
