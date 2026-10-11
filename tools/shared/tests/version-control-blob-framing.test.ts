import assert from "node:assert/strict";
import { test } from "node:test";
import { fs, path, withTempRoot } from "./version-control-test-support.ts";
import {
  GitBlobBatchReader,
  readGitBlobSelections
} from "../src/version-control/git-blob-batch.ts";

const oid = "a".repeat(40);

test("streamed blob framing preserves bounded binary prefixes across header payload and separator chunks", () => {
  const reader = new GitBlobBatchReader(
    new Map([
      [oid, 2],
      ["b".repeat(40), 0]
    ])
  );
  const records = Buffer.concat([
    Buffer.from(`${oid} blob 5\n`),
    Buffer.from([0, 0xff, 0xfe, 10, 1]),
    Buffer.from(`\n${"b".repeat(40)} blob 0\n\n`)
  ]);
  for (const byte of records) reader.consume(Buffer.from([byte]));
  const blobs = reader.finish();
  assert.deepEqual(blobs.get(oid)?.data, Buffer.from([0, 0xff]));
  assert.equal(blobs.get(oid)?.size, 5);
  assert.equal(blobs.get("b".repeat(40))?.data.length, 0);
  assert.equal(
    blobs.get(oid)?.fingerprint,
    "d95dd29e28ca907c9715d046465a23634abeceaa0d04d7cd9cef8dccc4435ef4"
  );
});

test("streamed blob framing rejects missing type mismatched identity and malformed size headers", () => {
  for (const header of [
    `${oid} missing\n`,
    `${oid} tree 1\n`,
    `${"b".repeat(40)} blob 1\n`,
    `${oid} blob -1\n`,
    `${oid} blob NaN\n`,
    `${oid} blob 1 extra\n`
  ]) {
    const reader = new GitBlobBatchReader(new Map([[oid, 0]]));
    assert.throws(
      () => reader.consume(Buffer.from(header)),
      /Unexpected Git blob header/u
    );
  }
});

test("streamed blob framing rejects truncated payload trailing records and incorrect separators", () => {
  const truncated = new GitBlobBatchReader(new Map([[oid, 0]]));
  truncated.consume(Buffer.from(`${oid} blob 4\nabc`));
  assert.throws(() => truncated.finish(), /Truncated/u);
  const separator = new GitBlobBatchReader(new Map([[oid, 0]]));
  assert.throws(
    () => separator.consume(Buffer.from(`${oid} blob 1\na!`)),
    /Truncated/u
  );
  const trailing = new GitBlobBatchReader(new Map([[oid, 0]]));
  assert.throws(
    () => trailing.consume(Buffer.from(`${oid} blob 1\na\n${oid} blob 1\na\n`)),
    /Unexpected/u
  );
});

test("streamed blob framing enforces the existing full batch budget even when no bytes are retained", () => {
  const reader = new GitBlobBatchReader(new Map([[oid, 0]]));
  assert.throws(
    () => reader.consume(Buffer.from(`${oid} blob ${256 * 1024 * 1024 + 1}\n`)),
    /Unexpected Git blob header/u
  );
});

test(
  "streamed blob transport retains the default stderr budget even with valid payload framing",
  { skip: process.platform === "win32" },
  async () => {
    await withTempRoot(async (root) => {
      const program = path.join(root, "oversized-stderr.mjs");
      const executable = path.join(root, "git");
      await fs.writeFile(
        program,
        `import {once} from "node:events";
process.stdout.write("${oid} blob 0\\n\\n");
const chunk=Buffer.alloc(65536, 120);
for(let i=0;i<4097;i++) if(!process.stderr.write(chunk)) await once(process.stderr,"drain");
`
      );
      await fs.writeFile(
        executable,
        `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(program)}\n`
      );
      await fs.chmod(executable, 0o700);
      const priorPath = process.env.PATH;
      process.env.PATH = `${root}${path.delimiter}${priorPath ?? ""}`;
      try {
        await assert.rejects(
          readGitBlobSelections(root, new Map([[oid, 0]])),
          /stderr exceeded the read budget/u
        );
      } finally {
        if (priorPath === undefined) delete process.env.PATH;
        else process.env.PATH = priorPath;
      }
    });
  }
);
