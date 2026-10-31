import fsSync from "node:fs";
import { readDecisionSourceRevision } from "../../src/index/decision-index-source.ts";
import { fixture } from "../../../record-operations/tests/reader/reader-fixture.ts";
import { recordReaderWorkerThreshold } from "../../../record-operations/src/reader/reader-batch.ts";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { scanDecisionRecords } from "../../src/scan/scan.ts";
import {
  currentSourcePath,
  decisionFilePath,
  withFixtureWorkspace
} from "../support/support.ts";

function acquisitionPath(root: string, member: "source" | "index") {
  return member === "source"
    ? decisionFilePath(root, currentSourcePath)
    : path.join(root, "docs/decisions/decision-index.json");
}

test("Decision full scan rejects invalid UTF-8 in initially acquired sources and index", async () => {
  for (const member of ["source", "index"] as const) {
    await withFixtureWorkspace("scan-utf8-" + member, async (root) => {
      await fs.writeFile(
        acquisitionPath(root, member),
        Buffer.from([0xff, 0xfe, 0x80])
      );
      const scan = await scanDecisionRecords({ workspaceRoot: root });
      const errors = member === "source" ? scan.sourceErrors : scan.indexErrors;
      assert.match(errors.join("\n"), /could not be read/);
      assert.equal(
        member === "source"
          ? scan.records.some((record) => record.source.kind === "invalid")
          : scan.index === null,
        true
      );
    });
  }
});

test("Decision full scan rejects same-byte inode replacement during source and index acquisition", async () => {
  for (const member of ["source", "index"] as const) {
    await withFixtureWorkspace("scan-inode-" + member, async (root) => {
      const file = acquisitionPath(root, member);
      const bytes = await fs.readFile(file);
      const initial = await fs.stat(file);
      const descriptor = Object.getOwnPropertyDescriptor(fs, "lstat");
      assert.ok(descriptor);
      const lstat = fs.lstat.bind(fs);
      let inspections = 0;
      let replaced = false;
      Object.defineProperty(fs, "lstat", {
        ...descriptor,
        value: async (...args: Parameters<typeof fs.lstat>) => {
          if (
            String(args[0]) === file &&
            ++inspections === (member === "index" ? 4 : 3)
          ) {
            await fs.rename(file, path.join(root, "old-member"));
            await fs.writeFile(file, bytes, { mode: initial.mode & 0o777 });
            replaced = true;
          }
          return await lstat(...args);
        }
      });
      try {
        const scan = await scanDecisionRecords({ workspaceRoot: root });
        const errors =
          member === "source" ? scan.sourceErrors : scan.indexErrors;
        assert.equal(replaced, true);
        assert.match(errors.join("\n"), /could not be read.*changed/);
      } finally {
        Object.defineProperty(fs, "lstat", descriptor);
      }
      assert.deepEqual(await fs.readFile(file), bytes);
      assert.notEqual((await fs.stat(file)).ino, initial.ino);
    });
  }
});

test("Decision failed initial source acquisition is reported once without a second read", async () => {
  await withFixtureWorkspace("scan-failed-acquisition", async (root) => {
    const file = acquisitionPath(root, "source");
    const descriptor = Object.getOwnPropertyDescriptor(fs, "open");
    assert.ok(descriptor);
    const open = fs.open.bind(fs);
    let reads = 0;
    Object.defineProperty(fs, "open", {
      ...descriptor,
      value: async (...args: Parameters<typeof fs.open>) => {
        if (String(args[0]) === file && ++reads === 1)
          throw Object.assign(new Error("initial acquisition access denied"), {
            code: "EACCES"
          });
        return await open(...args);
      }
    });
    try {
      const scan = await scanDecisionRecords({ workspaceRoot: root });
      assert.equal(reads, 1);
      assert.equal(
        scan.sourceErrors.filter((error) =>
          error.includes("initial acquisition access denied")
        ).length,
        1
      );
      assert.ok(
        scan.records.some((record) => record.source.kind === "invalid")
      );
    } finally {
      Object.defineProperty(fs, "open", descriptor);
    }
  });
});

test("Decision large discovery retains its first worker failure without a later regular-file probe", async () => {
  await fixture(async (root) => {
    const unsafe = path.join(root, "000-bad.md");
    await fs.symlink(path.join(root, "a.md"), unsafe);
    for (let index = 0; index < recordReaderWorkerThreshold; index++)
      fsSync.writeFileSync(
        path.join(root, `source-${index}.md`),
        `---\nid: 261024-source-${index}\nstatus: candidate\n---\n`
      );
    const lstat = fs.lstat;
    const later = Object.assign(
      new Error("later probe must not replace acquisition failure"),
      { code: "EACCES" }
    );
    let probes = 0;
    Object.defineProperty(fs, "lstat", {
      configurable: true,
      value: async (...args: Parameters<typeof fs.lstat>) => {
        if (args[0] === unsafe) {
          probes++;
          throw later;
        }
        return await lstat(...args);
      }
    });
    try {
      await assert.rejects(
        readDecisionSourceRevision(root, undefined),
        /without symbolic links/
      );
      assert.equal(probes, 0);
    } finally {
      fs.lstat = lstat;
    }
    assert.equal(await fs.readlink(unsafe), path.join(root, "a.md"));
  });
});
