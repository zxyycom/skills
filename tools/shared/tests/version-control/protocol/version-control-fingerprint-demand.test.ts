import { Hash } from "node:crypto";
import {
  readGitBlobs,
  readGitBlobSelections,
  GitBlobBatchReader
} from "../../../src/version-control/git/git-blob-batch.ts";
import { readRevisionFilePrefixes } from "../../../src/version-control/revision-file-prefixes.ts";
import {
  assert,
  createRepositoryFixture,
  fs,
  path,
  gitTestOptions,
  openVersionControl,
  runGit,
  test,
  withTempRoot
} from "./version-control-test-support.ts";

async function observeHashBytes<T>(run: () => Promise<T>) {
  const descriptor = Object.getOwnPropertyDescriptor(Hash.prototype, "update");
  assert.ok(descriptor !== undefined);
  const original: unknown = descriptor.value;
  assert.ok(typeof original === "function");
  let bytes = 0;
  let calls = 0;
  Hash.prototype.update = function (data, encoding) {
    bytes +=
      typeof data === "string"
        ? Buffer.byteLength(data, encoding)
        : data.byteLength;
    calls += 1;
    Reflect.apply(original, this, [data, encoding]);
    return this;
  };
  try {
    return { value: await run(), bytes, calls };
  } finally {
    Object.defineProperty(Hash.prototype, "update", descriptor);
  }
}

test(
  "ordinary Git full reads and revision prefixes do not hash discarded fingerprints",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(temp);
      const repository = await openVersionControl(repositoryRoot);
      const oid = runGit(repositoryRoot, [
        "rev-parse",
        "HEAD:docs/tracked.md"
      ]).trim();
      const full = await observeHashBytes(() =>
        readGitBlobs(repositoryRoot, [oid, oid])
      );
      assert.equal(full.value.size, 1);
      assert.equal(full.value.get(oid)?.toString(), "current\n");
      assert.equal(full.calls, 0);
      const prefix = await observeHashBytes(() =>
        readRevisionFilePrefixes(repository, {
          revision: currentRevision,
          paths: ["docs/tracked.md"],
          prefixBytes: 3
        })
      );
      assert.equal(Buffer.from(prefix.value[0]!.data).toString(), "cur");
      assert.equal(prefix.value[0]?.complete, false);
      assert.equal(prefix.calls, 0);
      const pending = await observeHashBytes(() =>
        repository.readPendingFiles({ pathScopes: ["docs"] })
      );
      assert.ok(pending.value.length > 1);
      assert.equal(pending.calls, 0);
    });
  }
);

test("blob fingerprint modes preserve identical binary framing and reject typed fingerprint completion without hashing", () => {
  const oid = "a".repeat(40);
  const framed = Buffer.concat([
    Buffer.from(`${oid} blob 5\n`),
    Buffer.from([0, 0xfe, 13, 10, 0xff]),
    Buffer.from("\n")
  ]);
  const plain = new GitBlobBatchReader(new Map([[oid, 2]]), "none");
  const hashed = new GitBlobBatchReader(new Map([[oid, 2]]), "sha256");
  for (const byte of framed) {
    plain.consume(Buffer.from([byte]));
    hashed.consume(Buffer.from([byte]));
  }
  assert.deepEqual(plain.finish().get(oid), {
    data: Buffer.from([0, 0xfe]),
    size: 5
  });
  const fingerprinted = hashed.finishFingerprinted().get(oid)!;
  assert.deepEqual(
    { data: fingerprinted.data, size: fingerprinted.size },
    plain.finish().get(oid)
  );
  assert.match(fingerprinted.fingerprint, /^[a-f0-9]{64}$/u);
  assert.throws(
    () => plain.finishFingerprinted(),
    /fingerprints were not requested/u
  );
});

test("both fingerprint modes reject malformed and truncated frames regardless of retained prefix", () => {
  const oid = "a".repeat(40);
  const frames = [
    `${oid} missing\n`,
    `${oid} tree 1\nx\n`,
    `${"b".repeat(40)} blob 1\nx\n`,
    `${oid} blob -1\n`,
    `${oid} blob NaN\n`,
    `${oid} blob 1 extra\n`,
    `${oid} blob 5\nabc`,
    `${oid} blob 1\nx!`,
    `${oid} blob 0\n\n${oid} blob 0\n\n`
  ];
  for (const mode of ["none", "sha256"] as const) {
    for (const frame of frames) {
      const reader = new GitBlobBatchReader(new Map([[oid, 0]]), mode);
      assert.throws(() => {
        reader.consume(Buffer.from(frame));
        reader.finish();
      });
    }
  }
});

test("both fingerprint modes account for the entire stdout budget even when all content is discarded", () => {
  const oid = "a".repeat(40);
  const chunk = Buffer.alloc(1024 * 1024, 120);
  for (const mode of ["none", "sha256"] as const) {
    const reader = new GitBlobBatchReader(new Map([[oid, 0]]), mode);
    reader.consume(Buffer.from(`${oid} blob ${256 * 1024 * 1024}\n`));
    for (let i = 0; i < 255; i += 1) reader.consume(chunk);
    assert.throws(
      () => reader.consume(chunk),
      /output exceeded the read budget/u
    );
  }
});

test(
  "blob transport retains process failure after valid framing and truncation after a retained prefix in both modes",
  { skip: process.platform === "win32" },
  async () => {
    await withTempRoot(async (root) => {
      const oid = "a".repeat(40);
      const executable = path.join(root, "git");
      const prior = process.env.PATH;
      process.env.PATH = `${root}${path.delimiter}${prior ?? ""}`;
      try {
        for (const mode of ["none", "sha256"] as const) {
          const read = () =>
            mode === "none"
              ? readGitBlobSelections(root, new Map([[oid, 1]]), "none")
              : readGitBlobSelections(root, new Map([[oid, 1]]));
          await fs.writeFile(
            executable,
            `#!/bin/sh\nIFS= read -r request\nprintf '${oid} blob 1\\nx\\n'\necho 'forced-batch-failure' >&2\nexit 9\n`,
            { mode: 0o700 }
          );
          await assert.rejects(read(), /forced-batch-failure/u);
          await fs.writeFile(
            executable,
            `#!/bin/sh\nIFS= read -r request\nprintf '${oid} blob 4\\nabc'\n`
          );
          await assert.rejects(read(), /Truncated Git blob batch output/u);
        }
      } finally {
        if (prior === undefined) delete process.env.PATH;
        else process.env.PATH = prior;
      }
    });
  }
);
