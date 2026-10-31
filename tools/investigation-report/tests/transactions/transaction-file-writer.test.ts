import assert from "node:assert/strict";
import fs, { type FileHandle } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  discardInvestigationReport,
  discardInvestigationReportWithWriter
} from "../../src/discard/discard.ts";
import { writeInvestigationTextAtomically } from "../../src/transactions/transaction-files.ts";
import { investigationRoot, withTempRoot } from "../support/fixture-support.ts";
import { writeCollection } from "../support/collection-support.ts";

async function withObservedTemporaryHandles<T>(
  t: TestContext,
  root: string,
  instrument: (handle: FileHandle, target: string) => void,
  run: () => Promise<T>
): Promise<T> {
  const open = fs.open;
  const observed = t.mock.method(
    fs,
    "open",
    async (...args: Parameters<typeof open>) => {
      const handle = await open(...args);
      try {
        const target = String(args[0]);
        if (args[1] === "wx" && path.dirname(target) === root)
          instrument(handle, target);
        return handle;
      } catch (error) {
        await handle.close().catch((closeError: unknown) => {
          throw new AggregateError(
            [error, closeError],
            "Source observation setup and handle cleanup failed"
          );
        });
        throw error;
      }
    }
  );
  try {
    return await run();
  } finally {
    observed.mock.restore();
  }
}

test("Investigation atomic text writer cleans failed temporary writes without changing the original source", async (t) => {
  for (const fault of ["write", "mode", "close"] as const)
    await withTempRoot("atomic-writer-" + fault, async (root) => {
      const target = path.join(root, "report.md");
      await fs.writeFile(target, "original source\n");
      await fs.chmod(target, 0o640);
      const before = await fs.stat(target);
      const injected = new Error("injected temporary " + fault + " failure");
      await withObservedTemporaryHandles(
        t,
        root,
        (handle) => {
          if (fault === "write")
            t.mock.method(handle, "writeFile", async () => {
              throw injected;
            });
          else if (fault === "mode")
            t.mock.method(handle, "chmod", async () => {
              throw injected;
            });
          else {
            const close = handle.close.bind(handle);
            t.mock.method(handle, "close", async () => {
              await close();
              throw injected;
            });
          }
        },
        () =>
          assert.rejects(
            writeInvestigationTextAtomically(target, "replacement\n"),
            (error) => error === injected
          )
      );
      const after = await fs.stat(target);
      assert.equal(await fs.readFile(target, "utf8"), "original source\n");
      assert.equal(after.mode, before.mode);
      assert.equal(after.ino, before.ino);
      assert.equal(after.dev, before.dev);
      assert.deepEqual(await fs.readdir(root), ["report.md"]);
    });
});

test("Investigation atomic text writer retains both publication and temporary cleanup failures", async (t) => {
  await withTempRoot("atomic-writer-cleanup-failure", async (root) => {
    const target = path.join(root, "report.md");
    await fs.writeFile(target, "original source\n");
    const writeFailure = new Error("injected temporary mode failure");
    const cleanupFailure = new Error("injected temporary cleanup failure");
    const unlink = fs.unlink;
    let temporary: string | undefined;
    const observedUnlink = t.mock.method(
      fs,
      "unlink",
      async (file: Parameters<typeof unlink>[0]) => {
        if (String(file) === temporary) throw cleanupFailure;
        await unlink(file);
      }
    );
    try {
      await withObservedTemporaryHandles(
        t,
        root,
        (handle, target) => {
          temporary = target;
          t.mock.method(handle, "chmod", async () => {
            throw writeFailure;
          });
        },
        () =>
          assert.rejects(
            writeInvestigationTextAtomically(target, "replacement\n"),
            (error) => {
              assert.ok(error instanceof AggregateError);
              assert.deepEqual(error.errors, [writeFailure, cleanupFailure]);
              return true;
            }
          )
      );
    } finally {
      observedUnlink.mock.restore();
    }
    assert.ok(temporary);
    assert.equal(await fs.readFile(target, "utf8"), "original source\n");
    assert.deepEqual(
      (await fs.readdir(root)).sort(),
      [path.basename(temporary), "report.md"].sort()
    );
  });
});

test("Investigation atomic text writer rejects missing and symbolic-link targets without creating sources", async () => {
  await withTempRoot("atomic-writer-existing-target", async (root) => {
    const target = path.join(root, "report.md");
    await assert.rejects(
      writeInvestigationTextAtomically(target, "replacement\n"),
      { code: "ENOENT" }
    );
    assert.deepEqual(await fs.readdir(root), []);
    const original = path.join(root, "original.md");
    await fs.writeFile(original, "original source\n");
    await fs.symlink(original, target);
    await assert.rejects(
      writeInvestigationTextAtomically(target, "replacement\n"),
      /regular non-symbolic-link/
    );
    assert.equal(await fs.readFile(original, "utf8"), "original source\n");
    assert.equal((await fs.lstat(target)).isSymbolicLink(), true);
    assert.deepEqual((await fs.readdir(root)).sort(), [
      "original.md",
      "report.md"
    ]);
  });
});

test("Investigation default discard restores its collection after an index temporary write failure", async (t) => {
  await withTempRoot("discard-atomic-writer-failure", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [
      { id: "selected" },
      { id: "retained" }
    ]);
    const root = investigationRoot(workspaceRoot);
    const paths = ["selected.md", "retained.md", "investigation-index.json"];
    const originals = await Promise.all(
      paths.map((name) => fs.readFile(path.join(root, name)))
    );
    const injected = new Error("injected index temporary mode failure");
    let injectedOnce = false;
    const result = await withObservedTemporaryHandles(
      t,
      root,
      (handle, target) => {
        if (paths.includes(path.basename(target))) return;
        injectedOnce = true;
        t.mock.method(handle, "chmod", async () => {
          throw injected;
        });
      },
      () => discardInvestigationReport({ workspaceRoot, id: "selected" })
    );
    assert.equal(injectedOnce, true);
    assert.match(
      result.errors.join("; "),
      /injected index temporary mode failure/
    );
    assert.equal(result.mutation?.outcome, "rolled-back");
    assert.deepEqual((await fs.readdir(root)).sort(), [...paths].sort());
    assert.deepEqual(
      await Promise.all(
        paths.map((name) => fs.readFile(path.join(root, name)))
      ),
      originals
    );
  });
});

test("Investigation default discard reports both index publication and exact temporary cleanup failures", async (t) => {
  await withTempRoot(
    "discard-atomic-writer-double-failure",
    async (workspaceRoot) => {
      await writeCollection(workspaceRoot, [
        { id: "selected" },
        { id: "retained" }
      ]);
      const root = investigationRoot(workspaceRoot);
      const paths = ["selected.md", "retained.md", "investigation-index.json"];
      const originals = await Promise.all(
        paths.map((name) => fs.readFile(path.join(root, name)))
      );
      const operationFailure = new Error(
        "injected index temporary mode failure"
      );
      const unlink = fs.unlink;
      let temporary: string | undefined;
      const observedUnlink = t.mock.method(
        fs,
        "unlink",
        async (target: Parameters<typeof unlink>[0]) => {
          if (String(target) === temporary)
            throw Object.assign(
              new Error("injected index temporary cleanup access failure"),
              {
                code: "EACCES",
                path: temporary,
                syscall: "unlink"
              }
            );
          await unlink(target);
        }
      );
      let result;
      try {
        result = await withObservedTemporaryHandles(
          t,
          root,
          (handle, target) => {
            if (paths.includes(path.basename(target))) return;
            temporary = target;
            t.mock.method(handle, "chmod", async () => {
              throw operationFailure;
            });
          },
          () => discardInvestigationReport({ workspaceRoot, id: "selected" })
        );
      } finally {
        observedUnlink.mock.restore();
      }
      assert.ok(temporary);
      assert.equal(result.mutation?.outcome, "partial-or-unknown");
      assert.match(
        result.errors.join("; "),
        /injected index temporary mode failure/
      );
      assert.match(
        result.errors.join("; "),
        /injected index temporary cleanup access failure/
      );
      assert.ok(
        result.diagnostics.some((diagnostic) =>
          diagnostic.detail?.includes("injected index temporary mode failure")
        )
      );
      const cleanup = result.diagnostics.find((diagnostic) =>
        diagnostic.detail?.includes(
          "injected index temporary cleanup access failure"
        )
      );
      assert.ok(cleanup);
      assert.equal(cleanup.causeCategory, "access-denied");
      assert.equal(
        cleanup.target,
        "collection-relative: " +
          path.relative(root, temporary).split(path.sep).join("/")
      );
      assert.equal(cleanup.operation, "unlink");
      assert.deepEqual(
        (await fs.readdir(root)).sort(),
        [...paths, path.basename(temporary)].sort()
      );
      assert.deepEqual(
        await Promise.all(
          paths.map((name) => fs.readFile(path.join(root, name)))
        ),
        originals
      );
    }
  );
});

test("Investigation discard preserves empty cyclic and unknown writer failure facts", async () => {
  const cyclic = new AggregateError([], "cyclic writer failure");
  cyclic.errors.push(cyclic);
  for (const { error, detail } of [
    {
      error: new AggregateError([], "empty writer failure"),
      detail: "empty writer failure"
    },
    { error: cyclic, detail: "cyclic writer failure" },
    { error: "unknown writer failure", detail: "unknown writer failure" }
  ])
    await withTempRoot("discard-compound-failure", async (workspaceRoot) => {
      await writeCollection(workspaceRoot, [
        { id: "selected" },
        { id: "retained" }
      ]);
      const root = investigationRoot(workspaceRoot);
      const files = (await fs.readdir(root)).sort();
      const bytes = await Promise.all(
        files.map((name) => fs.readFile(path.join(root, name)))
      );
      const result = await discardInvestigationReportWithWriter(
        { workspaceRoot, id: "selected" },
        async () => {
          throw error;
        }
      );
      assert.equal(result.mutation?.outcome, "rolled-back");
      assert.ok(result.errors.some((message) => message.includes(detail)));
      assert.ok(
        result.diagnostics.some((diagnostic) =>
          diagnostic.detail?.includes(detail)
        )
      );
      assert.deepEqual(
        await Promise.all(
          files.map((name) => fs.readFile(path.join(root, name)))
        ),
        bytes
      );
      assert.deepEqual((await fs.readdir(root)).sort(), [
        "investigation-index.json",
        "retained.md",
        "selected.md"
      ]);
    });
});
