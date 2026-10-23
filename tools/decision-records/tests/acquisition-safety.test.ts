import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import type {
  PathLike,
  ObjectEncodingOptions,
  BufferEncodingOption
} from "node:fs";
import path from "node:path";
import {
  readRecordText,
  recordCollectionIdentity
} from "../../record-operations/src/source.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import {
  currentSourcePath,
  archivedSourcePath,
  decisionFilePath,
  withFixtureWorkspace
} from "./support.ts";

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

test("Record source reads independently prove canonical namespaces without repeated root resolutions", async () => {
  await withFixtureWorkspace("source-canonical-observations", async (root) => {
    const collection = path.join(root, "docs/decisions");
    const sources = await Promise.all(
      [currentSourcePath, archivedSourcePath].map(async (sourcePath) => ({
        sourcePath,
        text: await fs.readFile(decisionFilePath(root, sourcePath), "utf8")
      }))
    );
    const realpath = fs.realpath;
    const open = fs.open;
    const canonicalPaths: string[] = [];
    let opens = 0;
    function observedRealpath(
      target: PathLike,
      options?: ObjectEncodingOptions | BufferEncoding | null
    ): Promise<string>;
    function observedRealpath(
      target: PathLike,
      options: BufferEncodingOption
    ): Promise<NonSharedBuffer>;
    function observedRealpath(
      target: PathLike,
      options?:
        | ObjectEncodingOptions
        | BufferEncoding
        | BufferEncodingOption
        | null
    ): Promise<string | NonSharedBuffer>;
    async function observedRealpath(
      target: PathLike,
      options?:
        | ObjectEncodingOptions
        | BufferEncoding
        | BufferEncodingOption
        | null
    ): Promise<string | NonSharedBuffer> {
      canonicalPaths.push(String(target));
      if (
        options === "buffer" ||
        (typeof options === "object" && options?.encoding === "buffer")
      )
        return await realpath(target, { encoding: "buffer" });
      return await realpath(target, options);
    }
    fs.realpath = observedRealpath;
    fs.open = async (...args) => {
      opens += 1;
      return await open(...args);
    };
    try {
      for (const phase of ["prepare", "fresh"]) {
        canonicalPaths.length = 0;
        opens = 0;
        for (const { sourcePath, text } of sources)
          assert.equal(await readRecordText(collection, sourcePath), text);
        assert.deepEqual(
          canonicalPaths,
          sources.flatMap(({ sourcePath }) => [
            collection,
            path.join(collection, sourcePath),
            path.join(collection, sourcePath)
          ]),
          `${phase}: each read proves its canonical root and both target observations`
        );
        assert.equal(opens, sources.length, `${phase}: every source is opened`);
      }
    } finally {
      fs.realpath = realpath;
      fs.open = open;
    }
    const alias = path.join(root, "collection-alias");
    await fs.symlink(collection, alias);
    await assert.rejects(
      readRecordText(alias, "../outside.md"),
      /record collection canonical identity changed before reading/
    );
    await assert.rejects(
      recordCollectionIdentity(alias),
      /record collection canonical identity changed/
    );
  });
});

test("Record source reads reject same-inode parent replacement and in-read byte drift", async () => {
  for (const mutation of ["root", "archive", "bytes"] as const) {
    await withFixtureWorkspace("source-read-" + mutation, async (root) => {
      const collection = path.join(root, "docs/decisions");
      const sourcePath =
        mutation === "archive" ? archivedSourcePath : currentSourcePath;
      const file = decisionFilePath(root, sourcePath);
      const initial = await fs.stat(file);
      const open = fs.open;
      let changed = false;
      fs.open = async (...args) => {
        const handle = await open(...args);
        if (String(args[0]) === file && !changed) {
          if (mutation === "bytes") {
            const readFile = handle.readFile.bind(handle);
            Object.defineProperty(handle, "readFile", {
              value: async () => {
                const bytes = await readFile();
                await fs.appendFile(file, "concurrent body edit\n");
                changed = true;
                return bytes;
              }
            });
          } else {
            const parent = path.dirname(file);
            const displaced = path.join(root, "displaced-source-parent");
            await fs.rename(parent, displaced);
            await fs.mkdir(parent);
            await fs.link(path.join(displaced, path.basename(file)), file);
            changed = true;
          }
        }
        return handle;
      };
      try {
        await assert.rejects(
          readRecordText(collection, sourcePath),
          /record source changed while reading the file/
        );
      } finally {
        fs.open = open;
      }
      assert.equal(changed, true, mutation);
      assert.equal((await fs.stat(file)).ino, initial.ino, mutation);
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
