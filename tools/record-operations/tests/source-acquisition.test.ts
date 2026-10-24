import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import type {
  PathLike,
  ObjectEncodingOptions,
  BufferEncodingOption
} from "node:fs";
import path from "node:path";
import { readRecordText, recordCollectionIdentity } from "../src/source.ts";
import { fixture } from "./reader-fixture.ts";

test("Record source reads independently prove canonical namespaces without repeated root resolutions", async () => {
  await fixture(async (root) => {
    const collection = root;
    const sources = await Promise.all(
      ["a.md", "archive/b.md"].map(async (sourcePath) => ({
        sourcePath,
        text: await fs.readFile(path.join(root, sourcePath), "utf8")
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
    const alias = path.join(path.dirname(root), path.basename(root) + "-alias");
    await fs.symlink(collection, alias);
    try {
      await assert.rejects(
        readRecordText(alias, "../outside.md"),
        /record collection canonical identity changed before reading/
      );
      await assert.rejects(
        recordCollectionIdentity(alias),
        /record collection canonical identity changed/
      );
    } finally {
      await fs.unlink(alias);
    }
  });
});

test("Record source reads reject same-inode parent replacement and in-read byte drift", async () => {
  for (const mutation of ["root", "archive", "bytes"] as const) {
    let displaced: string | undefined;
    try {
      await fixture(async (root) => {
        const collection = root;
        const sourcePath = mutation === "archive" ? "archive/b.md" : "a.md";
        const file = path.join(root, sourcePath);
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
              displaced = path.join(
                path.dirname(root),
                path.basename(root) + "-displaced"
              );
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
    } finally {
      if (displaced) await fs.rm(displaced, { recursive: true, force: true });
    }
  }
});
