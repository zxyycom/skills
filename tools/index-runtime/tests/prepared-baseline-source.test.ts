import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { withTempRoot } from "./runtime-fixture.ts";
import { resultValue } from "./support.ts";
import { serializeStateIndex, syncStateIndex } from "../src/index.ts";
import { resolveIndexPath } from "../src/index-path.ts";
import {
  consumePreparedSelectedBaseline,
  prepareSelectedStateIndexBaseline,
  prepareStateIndexFromSnapshot,
  syncStateIndexPrepared
} from "../src/prepared.ts";
import { preparationFixture } from "./prepared-fixture.ts";

test("prepared baselines retain actual UTF-8 bytes and reject noncanonical unsafe or invalid input", async () => {
  await withTempRoot(async (root) => {
    const { definition, snapshot, calls } = preparationFixture();
    const options = { context: { root }, definition, indexPath: "index.json" };
    const prepared = resultValue(
      prepareStateIndexFromSnapshot({ ...options, snapshot })
    );
    const text = serializeStateIndex(prepared.index, definition).replace(
      /\n/g,
      "\r\n"
    );
    const bytes = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(text)
    ]);
    await fs.writeFile(path.join(root, options.indexPath), bytes);
    const baseline = resultValue(
      await prepareSelectedStateIndexBaseline(options)
    );
    assert.deepEqual(Buffer.from(baseline.bytes), bytes);
    assert.equal(baseline.text, text);
    await fs.writeFile(
      path.join(root, options.indexPath),
      JSON.stringify(prepared.index)
    );
    const noncanonical = resultValue(
      await prepareSelectedStateIndexBaseline(options)
    );
    assert.ok(Object.hasOwn(noncanonical.index.entries, "a"));
    const afterPreparation = { ...calls };
    const resolved = resultValue(
      await resolveIndexPath(options.indexPath, root)
    );
    assert.equal(
      consumePreparedSelectedBaseline({
        ...options,
        resolved,
        baseline: noncanonical
      }).diagnostics[0]?.code,
      "state-index.index-noncanonical"
    );
    const handedOff = await syncStateIndexPrepared({
      ...options,
      baseline: noncanonical,
      mode: "preview",
      scope: { kind: "selected", selectedIds: ["a"] }
    });
    assert.equal(handedOff.state, "selected-baseline-invalid");
    assert.match(
      handedOff.diagnostics[0]!.message,
      /canonical persisted index/u
    );
    assert.deepEqual(calls, afterPreparation);
    for (const mode of ["check", "preview", "write"] as const) {
      const rejected = await syncStateIndex({
        ...options,
        mode,
        scope: { kind: "selected", selectedIds: ["a"] }
      });
      assert.equal(rejected.state, "selected-baseline-invalid");
      assert.match(
        rejected.diagnostics[0]!.message,
        /canonical persisted index/u
      );
      assert.equal(calls.reads, afterPreparation.reads);
      assert.equal(calls.revisions, afterPreparation.revisions);
    }
    for (const [invalidText, code] of [
      ["{invalid", "state-index.json-invalid"],
      [
        JSON.stringify({
          ...prepared.index,
          entries: {
            ...prepared.index.entries,
            a: { ...prepared.index.entries.a!, formedAt: "not-an-instant" }
          }
        }),
        "state-index.query-field-source-invalid"
      ]
    ]) {
      await fs.writeFile(path.join(root, options.indexPath), invalidText!);
      assert.equal(
        (await prepareSelectedStateIndexBaseline(options)).diagnostics[0]?.code,
        code
      );
    }

    await fs.writeFile(path.join(root, options.indexPath), Buffer.from([0xff]));
    assert.equal(
      (await prepareSelectedStateIndexBaseline(options)).diagnostics[0]?.code,
      "state-index.index-encoding-invalid"
    );
    await fs.writeFile(
      path.join(root, options.indexPath),
      serializeStateIndex(
        {
          ...prepared.index,
          sourceRevision: {
            ...prepared.index.sourceRevision,
            entries: { a: "a-1" }
          }
        },
        definition
      )
    );
    assert.equal(
      (await prepareSelectedStateIndexBaseline(options)).status,
      "error"
    );
    await withTempRoot(async (outside) => {
      await fs.writeFile(path.join(outside, "external.json"), text);
      await fs.rm(path.join(root, options.indexPath));
      await fs.symlink(
        path.join(outside, "external.json"),
        path.join(root, options.indexPath)
      );
      assert.equal(
        (await prepareSelectedStateIndexBaseline(options)).diagnostics[0]?.code,
        "state-index.index-path-invalid"
      );
      await fs.symlink(outside, path.join(root, "linked"));
      assert.equal(
        (
          await prepareSelectedStateIndexBaseline({
            ...options,
            indexPath: "linked/external.json"
          })
        ).diagnostics[0]?.code,
        "state-index.index-path-invalid"
      );
    });
  });
});

test("prepared baseline acquisition rejects inode and parent path replacement during safe reads", async () => {
  for (const replacement of ["inode", "parent"] as const) {
    await withTempRoot(async (root) => {
      await withTempRoot(async (outside) => {
        const { definition, snapshot, calls } = preparationFixture();
        const options = {
          context: { root },
          definition,
          indexPath: "nested/index.json"
        };
        const prepared = resultValue(
          prepareStateIndexFromSnapshot({ ...options, snapshot })
        );
        const text = serializeStateIndex(prepared.index, definition);
        const parent = path.join(root, "nested");
        const target = path.join(parent, "index.json");
        const alternate = path.join(root, "replacement.json");
        await fs.mkdir(parent);
        await fs.writeFile(target, text);
        await fs.writeFile(alternate, text);
        await fs.writeFile(path.join(outside, "index.json"), text);
        const before = { ...calls };
        const originalOpen = fs.open;
        let replaced = false;
        fs.open = async (...args: Parameters<typeof originalOpen>) => {
          if (args[0] !== target || replaced)
            return await originalOpen(...args);
          replaced = true;
          if (replacement === "parent") {
            await fs.rename(parent, `${parent}.saved`);
            await fs.symlink(outside, parent);
            return await originalOpen(...args);
          }
          const handle = await originalOpen(...args);
          await fs.rename(alternate, target);
          return handle;
        };
        try {
          const rejected = await prepareSelectedStateIndexBaseline(options);
          assert.equal(replaced, true);
          assert.equal(
            rejected.diagnostics[0]?.code,
            "state-index.index-read-failed"
          );
          assert.deepEqual(calls, before);
        } finally {
          fs.open = originalOpen;
        }
      });
    });
  }
  for (const directory of ["root", "nested"] as const) {
    await assertHardlinkedDirectoryReplacement(directory);
  }
});

async function assertHardlinkedDirectoryReplacement(
  directory: "root" | "nested"
): Promise<void> {
  await withTempRoot(async (holder) => {
    const root = path.join(holder, "collection");
    const parent = path.join(root, "nested");
    const target = path.join(parent, "index.json");
    const replacement = path.join(holder, "replacement");
    const replacedPath = directory === "root" ? root : parent;
    const replacementParent =
      directory === "root" ? path.join(replacement, "nested") : replacement;
    const { definition, snapshot, calls } = preparationFixture();
    const options = {
      context: { root },
      definition,
      indexPath: "nested/index.json"
    };
    const prepared = resultValue(
      prepareStateIndexFromSnapshot({ ...options, snapshot })
    );
    const text = serializeStateIndex(prepared.index, definition);
    await fs.mkdir(parent, { recursive: true });
    await fs.mkdir(replacementParent, { recursive: true });
    await fs.writeFile(target, text);
    await fs.link(target, path.join(replacementParent, "index.json"));
    const originalFile = await fs.stat(target);
    const originalDirectory = await fs.stat(replacedPath);
    const before = { ...calls };
    const originalOpen = fs.open;
    let replaced = false;
    fs.open = async (...args: Parameters<typeof originalOpen>) => {
      const handle = await originalOpen(...args);
      if (args[0] !== target) return handle;
      const readBytes = handle.readFile.bind(handle);
      Object.defineProperty(handle, "readFile", {
        value: async () => {
          const bytes = await readBytes();
          await fs.rename(
            replacedPath,
            path.join(holder, "original-directory")
          );
          await fs.rename(replacement, replacedPath);
          replaced = true;
          return bytes;
        }
      });
      return handle;
    };
    try {
      const rejected = await prepareSelectedStateIndexBaseline(options);
      assert.equal(replaced, true);
      const currentFile = await fs.stat(target);
      assert.equal(currentFile.ino, originalFile.ino);
      assert.equal(currentFile.dev, originalFile.dev);
      assert.equal(currentFile.size, originalFile.size);
      assert.equal(currentFile.mtimeMs, originalFile.mtimeMs);
      assert.equal(currentFile.ctimeMs, originalFile.ctimeMs);
      assert.notEqual((await fs.stat(replacedPath)).ino, originalDirectory.ino);
      assert.equal(await fs.readFile(target, "utf8"), text);
      assert.equal(
        rejected.diagnostics[0]?.code,
        "state-index.index-read-failed"
      );
      assert.deepEqual(calls, before);
    } finally {
      fs.open = originalOpen;
    }
  });
}
