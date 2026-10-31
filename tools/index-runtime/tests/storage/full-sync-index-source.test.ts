import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildStateIndex,
  serializeStateIndex,
  syncStateIndex
} from "../../src/index.ts";
import { preparationFixture } from "../prepared/prepared-fixture.ts";

test("full state-index checks reject file root and nested-parent replacement during persisted index acquisition", async () => {
  for (const replacement of ["file", "root", "nested"] as const) {
    const base = await fs.mkdtemp(
      path.join(os.tmpdir(), "full-index-safe-read-")
    );
    const root = path.join(base, "collection");
    const relative =
      replacement === "nested" ? "nested/index.json" : "index.json";
    const target = path.join(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const { definition } = preparationFixture();
    const built = await buildStateIndex(definition, { root });
    assert.equal(built.status, "ok");
    if (built.status !== "ok") assert.fail(JSON.stringify(built));
    const text = serializeStateIndex(built.value, definition);
    await fs.writeFile(target, text);
    const open = fs.open;
    let reads = 0;
    fs.open = (async (...args: Parameters<typeof fs.open>) => {
      const handle = await open(...args);
      if (args[0] === target) {
        const read = handle.readFile.bind(handle);
        Object.defineProperty(handle, "readFile", {
          configurable: true,
          value: async (...parameters: Parameters<typeof handle.readFile>) => {
            const bytes = await read(...parameters);
            if (++reads === 1) {
              if (replacement === "file") {
                await fs.rename(target, path.join(base, "old-index"));
                await fs.writeFile(target, text);
              } else {
                const parent =
                  replacement === "root" ? root : path.dirname(target);
                const previous = path.join(base, "old-parent");
                await fs.rename(parent, previous);
                await fs.mkdir(parent);
                await fs.link(path.join(previous, "index.json"), target);
              }
            }
            return bytes;
          }
        });
      }
      return handle;
    }) as typeof fs.open;
    try {
      const checked = await syncStateIndex({
        context: { root },
        definition,
        indexPath: relative,
        mode: "check"
      });
      assert.equal(reads, 1);
      assert.equal(checked.status, "error");
      assert.equal(checked.state, "index-read-failed");
      assert.ok(
        checked.diagnostics.some(
          (diagnostic) => diagnostic.code === "state-index.index-read-failed"
        )
      );
    } finally {
      fs.open = open;
      await fs.rm(base, { recursive: true, force: true });
    }
  }
});

test("full state-index checks preserve missing malformed UTF8 and one-shot IO failure classifications", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "full-index-read-errors-")
  );
  const target = path.join(root, "index.json");
  const { definition } = preparationFixture();
  const check = () =>
    syncStateIndex({
      context: { root },
      definition,
      indexPath: "index.json",
      mode: "check"
    });
  try {
    const missing = await check();
    assert.equal(missing.state, "index-missing");
    await fs.writeFile(target, "bad JSON");
    const malformed = await check();
    assert.equal(malformed.state, "index-invalid");
    await fs.writeFile(target, Buffer.from([0xff, 0x80]));
    const encoding = await check();
    assert.equal(encoding.state, "index-invalid");
    assert.ok(
      encoding.diagnostics.some(
        (diagnostic) => diagnostic.code === "state-index.index-encoding-invalid"
      )
    );
    const preview = await syncStateIndex({
      context: { root },
      definition,
      indexPath: "index.json",
      mode: "preview"
    });
    assert.equal(preview.status, "ok");
    assert.deepEqual(await fs.readFile(target), Buffer.from([0xff, 0x80]));
    const open = fs.open;
    let attempts = 0;
    fs.open = (async (...args: Parameters<typeof fs.open>) => {
      if (args[0] === target) {
        attempts += 1;
        throw Object.assign(new Error("one-shot index denial"), {
          code: "EACCES"
        });
      }
      return await open(...args);
    }) as typeof fs.open;
    try {
      const unavailable = await check();
      assert.equal(unavailable.state, "index-read-failed");
      assert.equal(attempts, 1);
    } finally {
      fs.open = open;
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
