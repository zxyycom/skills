import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import * as v from "valibot";
import { CardFailure } from "../src/card.ts";
import { currentSource, synchronize } from "../src/index.ts";
import { readSource } from "../src/source.ts";
import { selectCard } from "../src/query.ts";
import { cli, failure, markdown, project, put } from "./test-support.ts";

test("empty current and absent reference are valid while missing and linked card directories fail", async () => {
  await project(async (root) => {
    assert.equal((await readSource(root)).records.length, 0);
    assert.equal((await synchronize(root)).status, "ok");
    assert.equal((await currentSource(root)).records.length, 0);
    const current = path.join(root, "cards");
    await fs.rmdir(current);
    await assert.rejects(
      readSource(root),
      (error: unknown) =>
        error instanceof CardFailure &&
        error.code === "read-failed" &&
        error.file === current
    );
    await fs.mkdir(current);
    await fs.symlink(current, path.join(root, "reference"));
    await assert.rejects(readSource(root), failure("source-path"));
  });
});

test("line ending normalization preserves currentness without dropping returned source text", async () => {
  await project(async (root) => {
    const original = markdown("card");
    await put(root, "card", original);
    await synchronize(root);
    const crlf = original.replace(/\n/gu, "\r\n");
    await put(root, "card", crlf);
    const source = await currentSource(root);
    assert.equal(selectCard(source.records, "card", false).markdown, crlf);
  });
});

test("collection byte budget accepts the exact limit and rejects excess", async () => {
  await project(async (root) => {
    for (let index = 0; index < 10; index += 1) {
      const base = markdown(`card-${index}`);
      await put(
        root,
        `card-${index}`,
        base + "x".repeat(2 * 1024 * 1024 - Buffer.byteLength(base))
      );
    }
    assert.equal((await readSource(root)).records.length, 10);
    await put(root, "extra", markdown("extra"));
    await assert.rejects(readSource(root), failure("source-limit"));
  });
});

test("directory depth budget accepts the exact limit and rejects excess", async () => {
  await project(async (root) => {
    let directory = path.join(root, "cards");
    for (let depth = 0; depth < 100; depth += 1) {
      directory = path.join(directory, "nested");
      await fs.mkdir(directory);
    }
    assert.equal((await readSource(root)).records.length, 0);
    await fs.mkdir(path.join(directory, "too-deep"));
    await assert.rejects(readSource(root), failure("source-limit"));
  });
});

test(
  "card count budget accepts the complete limit and rejects an extra card",
  { timeout: 30000 },
  async () => {
    await project(async (root) => {
      for (let start = 0; start < 10000; start += 100) {
        await Promise.all(
          Array.from({ length: 100 }, (_, offset) => {
            const id = `card-${start + offset}`;
            return fs.writeFile(
              path.join(root, "cards", `${id}.md`),
              markdown(id)
            );
          })
        );
      }
      assert.equal((await readSource(root)).records.length, 10000);
      await put(root, "extra", markdown("extra"));
      await assert.rejects(readSource(root), failure("source-limit"));
    });
  }
);

test("duplicate IDs fail before replacing the derived index", async () => {
  await project(async (root) => {
    await put(root, "a", markdown("same"));
    await synchronize(root);
    const before = await fs.readFile(path.join(root, "card-index.json"));
    await put(root, "b", markdown("same"));
    await assert.rejects(readSource(root), failure("duplicate-id"));
    const result = await cli(root, ["sync-index", "--write"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /duplicate-id/u);
    assert.deepEqual(
      await fs.readFile(path.join(root, "card-index.json")),
      before
    );
  });
});

test("changed, moved and deleted cards invalidate persisted indexes without guessing", async () => {
  await project(async (root) => {
    await put(root, "original", markdown("stable"));
    await synchronize(root);
    await put(root, "original", markdown("stable", { title: "修改" }));
    await assert.rejects(currentSource(root), failure("index-invalid"));
    await synchronize(root);
    await fs.rename(
      path.join(root, "cards/original.md"),
      path.join(root, "cards/moved.md")
    );
    await assert.rejects(currentSource(root), failure("index-invalid"));
    await synchronize(root);
    assert.equal(
      selectCard((await currentSource(root)).records, "stable", false)
        .sourcePath,
      "cards/moved.md"
    );
    await fs.unlink(path.join(root, "cards/moved.md"));
    await assert.rejects(currentSource(root), failure("index-invalid"));
    await synchronize(root);
    assert.throws(
      () => selectCard([], "stable", false),
      failure("card-not-found")
    );
  });
});

test("tampered index identities, paths and areas cannot redirect a query", async () => {
  await project(async (root) => {
    await put(root, "a", markdown("a"));
    await put(root, "b", markdown("b"));
    for (const patch of [
      { sourcePath: "cards/b.md" },
      { sourcePath: "../../outside.md" },
      { area: "reference" },
      { title: "伪标题" }
    ]) {
      await synchronize(root);
      const file = path.join(root, "card-index.json");
      const input: unknown = JSON.parse(await fs.readFile(file, "utf8"));
      const data = v.parse(
        v.looseObject({ entries: v.record(v.string(), v.looseObject({})) }),
        input
      );
      const target = data.entries.a;
      assert.ok(
        target,
        "synchronized index must contain card a before tampering"
      );
      Object.assign(target, patch);
      await fs.writeFile(file, JSON.stringify(data));
      await assert.rejects(
        currentSource(root),
        (error: unknown) =>
          error instanceof CardFailure &&
          ["index-invalid", "index-identity"].includes(error.code)
      );
    }
    await synchronize(root);
    const result = await cli(root, ["show", "cards/a.md"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
  });
});

test("unsafe card files and oversized inputs fail rather than yielding partial success", async () => {
  await project(async (root) => {
    const file = path.join(root, "cards/card.md");
    await fs.symlink(path.join(root, "external.md"), file);
    await assert.rejects(readSource(root), failure("source-path"));
    await fs.unlink(file);
    await fs.writeFile(file, "x".repeat(2 * 1024 * 1024 + 1));
    await assert.rejects(readSource(root), failure("source-limit"));
    await fs.unlink(file);
    await fs.writeFile(file, Buffer.from([0xff]));
    await assert.rejects(
      readSource(root),
      (error: unknown) =>
        error instanceof CardFailure &&
        error.code === "card-format" &&
        error.file === file
    );
    const invalidText = await cli(root, ["check"]);
    assert.equal(invalidText.status, 1);
    assert.match(invalidText.stdout, /card-format/u);
    assert.ok(invalidText.stderr.includes(file));
    await fs.unlink(file);
    await fs.writeFile(file, markdown("card"));
    const hardlink = path.join(root, "cards/linked.md");
    await fs.link(file, hardlink);
    await assert.rejects(readSource(root), failure("source-path"));
    await fs.unlink(hardlink);
    await fs.unlink(file);
    await fs.writeFile(path.join(root, "cards/other.txt"), "ignored?");
    await assert.rejects(readSource(root), failure("source-path"));
  });
});
