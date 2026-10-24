import assert from "node:assert/strict";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fixture, many } from "./reader-fixture.ts";
import {
  forEachRecordText,
  forEachRecordTextSnapshot,
  forEachRecordFileSnapshot,
  recordReaderWorkerThreshold
} from "../src/reader-batch.ts";
import { readRecordText } from "../src/source.ts";
import {
  readRecordFileSnapshot,
  readRecordTextSnapshot,
  sameRecordFile,
  requireRecordTextSnapshot
} from "../src/transaction-snapshot.ts";
import { readRecordFileSnapshotSync } from "../src/reader-sync.ts";
import { RecordVerificationPhase } from "../src/transaction-verification.ts";
import { readDecisionSourceRevision } from "../../decision-records/src/decision-index-source.ts";

test("record worker batch preserves ordered text and complete root-bound snapshots", async () => {
  await fixture(async (root) => {
    const paths = Array.from(
      { length: recordReaderWorkerThreshold },
      (_, index) => (index % 2 === 0 ? "archive/" : "") + `source-${index}.md`
    );
    const texts = paths.map((_, index) => `\ufeffsource ${index} 中文\r\n`);
    for (const [index, source] of paths.entries()) {
      fsSync.writeFileSync(path.join(root, source), texts[index]!);
      fsSync.chmodSync(
        path.join(root, source),
        index % 3 === 0 ? 0o640 : 0o644
      );
    }
    assert.equal(await readRecordText(root, paths[0]!), texts[0]);
    let count = 0;
    await forEachRecordText(root, paths, (result, index) => {
      assert.equal(index, count++);
      assert.ok(result.ok);
      assert.equal(result.value, texts[index]);
    });
    assert.equal(count, paths.length);
    const expected: Awaited<ReturnType<typeof readRecordTextSnapshot>>[] = [];
    for (const source of paths)
      expected.push(
        await readRecordTextSnapshot(root, path.join(root, source))
      );
    count = 0;
    await forEachRecordTextSnapshot(
      root,
      paths.map((source) => path.join(root, source)),
      (result, index) => {
        assert.equal(index, count++);
        assert.ok(result.ok);
        assert.ok(
          sameRecordFile(result.value.snapshot, expected[index]!.snapshot)
        );
        assert.equal(result.value.text, expected[index]!.text);
        requireRecordTextSnapshot(
          result.value,
          root,
          path.join(root, paths[index]!),
          result.value.text
        );
        assert.throws(
          () =>
            requireRecordTextSnapshot(
              result.value,
              path.join(root, "archive"),
              result.value.path,
              result.value.text
            ),
          /proof does not match/
        );
      }
    );
    assert.equal(count, paths.length);
  });
});

test("record worker batch preserves missing unsafe-path and strict UTF-8 failures", async () => {
  await fixture(async (root) => {
    await fs.writeFile(path.join(root, "invalid.md"), Buffer.from([0xff]));
    await fs.symlink(path.join(root, "a.md"), path.join(root, "link.md"));
    await fs.symlink(path.join(root, "archive"), path.join(root, "alias"));
    const bad = [
      "missing.md",
      "link.md",
      "alias/b.md",
      "archive",
      "../outside.md",
      "invalid.md"
    ];
    const expected = await Promise.all(
      bad.map(async (source) => {
        try {
          await readRecordText(root, source);
          assert.fail("unsafe source was accepted");
        } catch (error) {
          assert.ok(error instanceof Error);
          return error;
        }
      })
    );
    const paths = [...bad, ...many(["a.md"])];
    await forEachRecordText(root, paths, (result, index) => {
      if (index >= bad.length) {
        assert.ok(result.ok);
        return;
      }
      assert.equal(result.ok, false);
      if (result.ok) assert.fail("unsafe source was accepted");
      assert.equal(result.error.name, expected[index]!.name);
      assert.equal(result.error.message, expected[index]!.message);
      const expectedError = expected[index]!;
      if ("code" in expectedError)
        assert.equal(
          "code" in result.error ? result.error.code : undefined,
          expectedError.code
        );
      if (index === bad.length - 1)
        assert.ok(result.error instanceof TypeError);
    });
    let missing = false;
    await forEachRecordFileSnapshot(
      root,
      [path.join(root, "absent/leaf.md"), ...many([path.join(root, "a.md")])],
      (result, index) => {
        assert.ok(result.ok);
        if (index === 0) {
          assert.equal(result.value, null);
          missing = true;
        }
      }
    );
    assert.ok(missing);
    const snapshotPaths = bad.map((source) => path.resolve(root, source));
    const snapshotErrors = await Promise.all(
      snapshotPaths.map(async (target) => {
        try {
          await readRecordTextSnapshot(root, target);
          assert.fail("unsafe snapshot was accepted");
        } catch (error) {
          assert.ok(error instanceof Error);
          return error;
        }
      })
    );
    await forEachRecordTextSnapshot(
      root,
      [...snapshotPaths, ...many([path.join(root, "a.md")])],
      (result, index) => {
        if (index >= bad.length) {
          assert.ok(result.ok);
          return;
        }
        assert.equal(result.ok, false);
        if (result.ok) assert.fail("invalid text snapshot was accepted");
        const expectedError = snapshotErrors[index]!;
        assert.equal(result.error.name, expectedError.name);
        assert.equal(result.error.message, expectedError.message);
        if ("code" in expectedError)
          assert.equal(
            "code" in result.error ? result.error.code : undefined,
            expectedError.code
          );
        if (index === bad.length - 1)
          assert.ok(result.error instanceof TypeError);
      }
    );
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

test("record worker backpressure keeps a large source complete and later chunks fresh", async () => {
  await fixture(async (root) => {
    const large = "正文".repeat(2 * 1024 * 1024);
    await fs.writeFile(path.join(root, "large.md"), large);
    const paths = ["large.md", ...many(["a.md"])];
    let count = 0;
    await forEachRecordText(root, paths, async (result, index) => {
      assert.ok(result.ok);
      if (index === 0) {
        assert.equal(result.value, large);
        await fs.writeFile(path.join(root, "a.md"), "new chunk");
      } else assert.equal(result.value, "new chunk");
      count++;
    });
    assert.equal(count, paths.length);
  });
});

test("record verification batches retain actual observations and independently reread new phases", async () => {
  await fixture(async (root) => {
    const guards: {
      path: string;
      before: NonNullable<Awaited<ReturnType<typeof readRecordFileSnapshot>>>;
    }[] = [];
    for (let index = 0; index < recordReaderWorkerThreshold; index++) {
      const target = path.join(root, `guard-${index}.md`);
      fsSync.writeFileSync(target, "guard");
      const before = readRecordFileSnapshotSync(root, target);
      assert.ok(before);
      guards.push({ path: target, before });
    }
    const phase = new RecordVerificationPhase(root);
    await phase.verifyMany(guards);
    await fs.chmod(guards[0]!.path, guards[0]!.before.mode ^ 0o100);
    await phase.verifyMany([...guards, ...guards]);
    await assert.rejects(
      new RecordVerificationPhase(root).verifyMany(guards),
      /Transaction member changed:.*guard-0.md/
    );
    await fs.chmod(guards[0]!.path, guards[0]!.before.mode);
    guards[0]!.before.bytes[0] = 0xff;
    await assert.rejects(
      phase.verifyMany(guards),
      /Transaction member changed:.*guard-0.md/
    );
  });
});
