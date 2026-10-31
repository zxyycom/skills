import assert from "node:assert/strict";
import fsSync from "node:fs";
import path from "node:path";
import test from "node:test";
import { fixture } from "./reader-fixture.ts";
import {
  readRecordFileSnapshotSync,
  readRecordTextSync
} from "../../src/reader/reader-sync.ts";

test("record sync snapshot rejects real byte revision drift and closes its handle", async (context) => {
  await fixture(async (root) => {
    const target = path.join(root, "a.md");
    const read = fsSync.readFileSync;
    const close = fsSync.closeSync;
    let closes = 0;
    let readingFd: number | undefined;
    context.mock.method(fsSync, "readFileSync", (fd: number) => {
      readingFd = fd;
      const bytes = read(fd);
      fsSync.writeFileSync(target, "changed byte length and revision");
      return bytes;
    });
    context.mock.method(fsSync, "closeSync", (fd: number) => {
      if (fd === readingFd) closes++;
      close(fd);
    });
    assert.throws(
      () => readRecordFileSnapshotSync(root, target),
      /changed while reading/
    );
    assert.equal(closes, 1);
  });
});

test("record sync snapshot rejects actual permission and leaf identity drift", async (context) => {
  await fixture(async (root) => {
    const target = path.join(root, "a.md");
    const read = fsSync.readFileSync;
    let replace = false;
    context.mock.method(fsSync, "readFileSync", (fd: number) => {
      const bytes = read(fd);
      if (replace) {
        fsSync.renameSync(target, target + ".old");
        fsSync.writeFileSync(target, bytes);
      } else
        fsSync.chmodSync(
          target,
          (fsSync.statSync(target).mode & 0o7777) ^ 0o100
        );
      return bytes;
    });
    assert.throws(
      () => readRecordFileSnapshotSync(root, target),
      /changed while reading/
    );
    replace = true;
    assert.throws(
      () => readRecordFileSnapshotSync(root, target),
      /changed while reading/
    );
  });
});

test("record synchronous readers reject actual parent replacement with unchanged leaf identity", async (context) => {
  await fixture(async (root) => {
    const target = path.join(root, "archive/b.md");
    const read = fsSync.readFileSync;
    for (const index of [0, 1]) {
      fsSync.mkdirSync(path.join(root, "replacement-" + index));
      fsSync.linkSync(target, path.join(root, "replacement-" + index, "b.md"));
    }
    const initial = fsSync.statSync(target);
    let replacements = 0;
    context.mock.method(fsSync, "readFileSync", (fd: number) => {
      const bytes = read(fd);
      const index = replacements++;
      fsSync.renameSync(
        path.join(root, "archive"),
        path.join(root, "old-" + index)
      );
      fsSync.renameSync(
        path.join(root, "replacement-" + index),
        path.join(root, "archive")
      );
      return bytes;
    });
    assert.throws(
      () => readRecordFileSnapshotSync(root, target),
      /parent identity changed/
    );
    assert.throws(
      () => readRecordTextSync(root, "archive/b.md"),
      /changed while reading/
    );
    const final = fsSync.statSync(target);
    assert.equal(final.ino, initial.ino);
    assert.equal(final.ctimeMs, initial.ctimeMs);
  });
});
