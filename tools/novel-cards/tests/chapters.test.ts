import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import * as v from "valibot";
import { synchronize } from "../src/index.ts";
import { readSource } from "../src/source.ts";
import {
  cli,
  cliValue,
  failure,
  markdown,
  project,
  put
} from "./test-support.ts";

const candidatesSchema = v.object({
  ambiguous: v.boolean(),
  candidates: v.array(
    v.object({ id: v.string(), sourcePath: v.string(), scopeTitle: v.string() })
  )
});

test("repeated chapter titles and cross-scope numbers return candidates without guessing", async () => {
  await project(async (root) => {
    for (const id of ["volume-a", "volume-b"])
      await put(root, id, markdown(id, { kind: "summary" }));
    await put(
      root,
      "first",
      markdown("first", {
        title: "归来",
        chapter: { scope: "volume-a", number: 1 }
      })
    );
    await put(
      root,
      "second",
      markdown("second", {
        title: "归来",
        chapter: { scope: "volume-b", number: 1 }
      })
    );
    await synchronize(root);
    for (const args of [
      ["find", "--title", "归来"],
      ["find", "--chapter", "1"]
    ]) {
      const result = v.parse(candidatesSchema, await cliValue(root, args));
      assert.equal(result.ambiguous, true);
      assert.deepEqual(
        result.candidates.map((entry) => entry.id),
        ["first", "second"]
      );
    }
    const scoped = v.parse(
      candidatesSchema,
      await cliValue(root, ["find", "--chapter", "1", "--scope", "volume-b"])
    );
    assert.equal(scoped.ambiguous, false);
    assert.equal(scoped.candidates[0]?.id, "second");
    assert.equal(scoped.candidates[0]?.scopeTitle, "volume-b");
    await put(
      root,
      "duplicate",
      markdown("duplicate", {
        title: "不同名称",
        chapter: { scope: "volume-a", number: 1 }
      })
    );
    await assert.rejects(readSource(root), failure("chapter-number"));
    await fs.unlink(path.join(root, "cards/duplicate.md"));
    await put(
      root,
      "missing-scope",
      markdown("missing-scope", { chapter: { scope: "absent", number: 2 } })
    );
    await assert.rejects(readSource(root), failure("missing-reference"));
  });
});

test("renaming and renumbering chapters preserve stable IDs with a usable unique ID generator", async () => {
  await project(async (root) => {
    await put(root, "book", markdown("book", { kind: "summary" }));
    await put(
      root,
      "original-file",
      markdown("stable-chapter", {
        title: "旧标题",
        chapter: { scope: "book", number: 3 }
      })
    );
    await synchronize(root);
    await put(
      root,
      "original-file",
      markdown("stable-chapter", {
        title: "新标题",
        chapter: { scope: "book", number: 1 }
      })
    );
    await fs.rename(
      path.join(root, "cards/original-file.md"),
      path.join(root, "cards/new-file.md")
    );
    await synchronize(root);
    const result = v.parse(
      candidatesSchema,
      await cliValue(root, ["find", "--chapter", "1", "--scope", "book"])
    );
    assert.equal(result.candidates[0]?.id, "stable-chapter");
    assert.equal(result.candidates[0]?.sourcePath, "cards/new-file.md");
    assert.equal((await cli(root, ["show", "stable-chapter"])).status, 0);
    const generated = v.parse(
      v.object({ id: v.string() }),
      await cliValue(root, ["new-id"])
    ).id;
    assert.match(generated, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
    await put(root, "generated", markdown(generated));
    await synchronize(root);
    assert.equal((await cli(root, ["show", generated])).status, 0);
  });
});
