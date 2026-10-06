import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { applyTransition } from "../src/apply-transition.ts";
import { currentSource, synchronize } from "../src/index.ts";
import { selectCard } from "../src/query.ts";
import {
  atomicTransactionWrite,
  journalDirectory
} from "../src/transaction.ts";
import { cli, failure, project } from "./test-support.ts";
import {
  stateProject,
  transition,
  batchFile,
  updates
} from "./history-support.ts";

test("multi-file publish failure restores all original cards snapshots and index", async () => {
  await project(async (root) => {
    await stateProject(root);
    const original = await fs.readFile(path.join(root, "card-index.json"));
    const input = await batchFile(root, transition(), updates());
    let writes = 0;
    await assert.rejects(
      applyTransition(root, input, async (file, text, directory) => {
        writes += 1;
        if (writes === 3)
          throw new Error("injected third-file filesystem failure");
        await atomicTransactionWrite(file, text, directory);
      }),
      failure("transaction-failed")
    );
    assert.deepEqual(
      await fs.readFile(path.join(root, "card-index.json")),
      original
    );
    assert.equal((await currentSource(root)).records.length, 3);
    assert.equal(
      selectCard((await currentSource(root)).records, "hero", false).card
        .version,
      1
    );
    await assert.rejects(fs.lstat(path.join(root, journalDirectory)), {
      code: "ENOENT"
    });
  });
});

test("interrupted journals block queries and recover refuses unrelated changed bytes", async () => {
  await project(async (root) => {
    await stateProject(root);
    const sourcePath = "cards/hero.md";
    const file = path.join(root, sourcePath);
    const before = await fs.readFile(file, "utf8");
    const updated = updates()[0]?.markdown;
    assert.ok(updated);
    const after = updated + "\uFFFD";
    const directory = path.join(root, journalDirectory);
    await fs.mkdir(directory);
    await fs.writeFile(
      path.join(directory, "journal.json"),
      JSON.stringify({
        files: [{ sourcePath, before, after }],
        directories: []
      })
    );
    await fs.writeFile(file, "user edits outside transaction");
    await assert.rejects(currentSource(root), failure("transaction-pending"));
    const refused = await cli(root, ["recover", "--write"]);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /source-changed/u);
    assert.equal(
      await fs.readFile(file, "utf8"),
      "user edits outside transaction"
    );
    const invalidUtf8 = Buffer.concat([
      Buffer.from(updated),
      Buffer.from([0xff])
    ]);
    await fs.writeFile(file, invalidUtf8);
    const invalid = await cli(root, ["recover", "--write"]);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /source-changed/u);
    assert.ok(invalid.stderr.includes(file));
    assert.deepEqual(await fs.readFile(file), invalidUtf8);
    assert.ok((await fs.lstat(directory)).isDirectory());
    await fs.writeFile(file, after);
    assert.equal((await cli(root, ["recover"])).status, 2);
    assert.equal((await cli(root, ["recover", "--write"])).status, 0);
    assert.equal(await fs.readFile(file, "utf8"), before);
    assert.equal((await currentSource(root)).records.length, 3);
  });
});

test("UTF-8 BOM cards retain original bytes through snapshot and failed batch rollback", async () => {
  await project(async (root) => {
    await stateProject(root);
    const file = path.join(root, "cards/hero.md");
    const original = "\uFEFF" + (await fs.readFile(file, "utf8"));
    await fs.writeFile(file, original);
    await synchronize(root);
    const input = await batchFile(root, transition(), updates());
    let count = 0;
    await assert.rejects(
      applyTransition(root, input, async (target, text, directory) => {
        count += 1;
        if (count === 3) throw new Error("fail after BOM object replacement");
        await atomicTransactionWrite(target, text, directory);
      }),
      failure("transaction-failed")
    );
    assert.equal(await fs.readFile(file, "utf8"), original);
    assert.equal((await currentSource(root)).records.length, 3);
    await applyTransition(root, input);
    assert.equal(
      selectCard((await currentSource(root)).records, "hero@1", false).markdown,
      original
    );
    assert.equal(
      await fs.readFile(
        path.join(root, "history/snapshots/hero-v1.md"),
        "utf8"
      ),
      original
    );
  });
});

test("transaction and recovery preflight failures create no untracked directories", async () => {
  await project(async (root) => {
    await stateProject(root);
    const { commitTransaction } = await import("../src/transaction.ts");
    await assert.rejects(
      commitTransaction(root, [
        {
          sourcePath: "history/snapshots/new.md",
          before: null,
          after: "unused"
        },
        {
          sourcePath: "cards/hero.md",
          before: "wrong prior bytes",
          after: "unused"
        }
      ]),
      failure("source-changed")
    );
    await assert.rejects(fs.lstat(path.join(root, "history")), {
      code: "ENOENT"
    });
    const directory = path.join(root, journalDirectory);
    await fs.mkdir(directory);
    await fs.writeFile(
      path.join(directory, "journal.json"),
      JSON.stringify({
        files: [
          {
            sourcePath: "history/snapshots/new.md",
            before: null,
            after: "unused"
          },
          {
            sourcePath: "cards/hero.md",
            before: "wrong prior bytes",
            after: "unused"
          }
        ],
        directories: []
      })
    );
    assert.equal((await cli(root, ["recover", "--write"])).status, 1);
    await assert.rejects(fs.lstat(path.join(root, "history")), {
      code: "ENOENT"
    });
    assert.ok((await fs.lstat(directory)).isDirectory());
  });
});

test("recovery rejects linked roots linked parents and escaping journal paths before touching cards", async () => {
  await project(async (root) => {
    await stateProject(root);
    const file = path.join(root, "cards/hero.md");
    const after = await fs.readFile(file, "utf8");
    const directory = path.join(root, journalDirectory);
    await fs.mkdir(directory);
    const journalFile = path.join(directory, "journal.json");
    await fs.writeFile(
      journalFile,
      JSON.stringify({
        files: [{ sourcePath: "cards/hero.md", before: "prior", after }],
        directories: []
      })
    );
    const alias = path.join(root, "alias");
    await fs.symlink(root, alias);
    const linked = await cli(alias, ["recover", "--write"]);
    assert.equal(linked.status, 1);
    assert.match(linked.stderr, /source-path/u);
    assert.equal(await fs.readFile(file, "utf8"), after);
    await fs.writeFile(
      journalFile,
      JSON.stringify({
        files: [{ sourcePath: "../outside.md", before: null, after: "bad" }],
        directories: []
      })
    );
    assert.equal((await cli(root, ["recover", "--write"])).status, 1);
    await fs.mkdir(path.join(root, "outside"));
    const outside = path.join(root, "outside/x.md");
    await fs.writeFile(outside, "after");
    await fs.mkdir(path.join(root, "history"));
    await fs.symlink(
      path.join(root, "outside"),
      path.join(root, "history/snapshots")
    );
    await fs.writeFile(
      journalFile,
      JSON.stringify({
        files: [
          {
            sourcePath: "history/snapshots/x.md",
            before: "before",
            after: "after"
          }
        ],
        directories: []
      })
    );
    const parent = await cli(root, ["recover", "--write"]);
    assert.equal(parent.status, 1);
    assert.match(parent.stderr, /source-path/u);
    assert.equal(await fs.readFile(outside, "utf8"), "after");
    assert.ok((await fs.lstat(directory)).isDirectory());
  });
});

test("malformed Unicode batch text is rejected before UTF-8 publication can alter transaction bytes", async () => {
  await project(async (root) => {
    await stateProject(root);
    const before = await fs.readFile(path.join(root, "card-index.json"));
    const invalid = updates().map((update) => ({
      ...update,
      markdown: update.markdown + "\uD800"
    }));
    const result = await cli(root, [
      "apply-transition",
      "--input",
      await batchFile(root, transition(), invalid),
      "--write"
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /完整Unicode/u);
    assert.deepEqual(
      await fs.readFile(path.join(root, "card-index.json")),
      before
    );
    assert.equal((await currentSource(root)).records.length, 3);
    await assert.rejects(fs.lstat(path.join(root, "history")), {
      code: "ENOENT"
    });
    await assert.rejects(fs.lstat(path.join(root, journalDirectory)), {
      code: "ENOENT"
    });
  });
});

test("unreadable malformed and invalid batch inputs report their input file without publishing", async () => {
  await project(async (root) => {
    await stateProject(root);
    const input = path.join(root, "invalid-batch.json");
    const index = await fs.readFile(path.join(root, "card-index.json"));
    for (const bytes of [
      null,
      Buffer.from("{"),
      Buffer.from([0xff]),
      Buffer.from('{"transition":1,"updates":[]}')
    ]) {
      if (bytes !== null) await fs.writeFile(input, bytes);
      const result = await cli(root, [
        "apply-transition",
        "--input",
        input,
        "--write"
      ]);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /"status":"error"/u);
      assert.match(
        result.stderr,
        bytes === null ? /read-failed/u : /transition-contract/u
      );
      assert.ok(result.stderr.includes(input));
      assert.deepEqual(
        await fs.readFile(path.join(root, "card-index.json")),
        index
      );
      assert.equal((await currentSource(root)).records.length, 3);
      await assert.rejects(fs.lstat(path.join(root, "history")), {
        code: "ENOENT"
      });
      await assert.rejects(fs.lstat(path.join(root, journalDirectory)), {
        code: "ENOENT"
      });
    }
  });
});

test("malformed journal inputs report their journal file and preserve recovery evidence", async () => {
  await project(async (root) => {
    await stateProject(root);
    const file = path.join(root, "cards/hero.md");
    const before = await fs.readFile(file);
    const indexFile = path.join(root, "card-index.json");
    const index = await fs.readFile(indexFile);
    const directory = path.join(root, journalDirectory);
    await fs.mkdir(directory);
    const journalFile = path.join(directory, "journal.json");
    for (const bytes of [
      Buffer.from("{"),
      Buffer.from("{}"),
      Buffer.from([0xff])
    ]) {
      await fs.writeFile(journalFile, bytes);
      const result = await cli(root, ["recover", "--write"]);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /"status":"error"/u);
      assert.ok(result.stderr.includes(journalFile));
      assert.deepEqual(await fs.readFile(file), before);
      assert.deepEqual(await fs.readFile(indexFile), index);
      assert.deepEqual(await fs.readFile(journalFile), bytes);
    }
  });
});
