import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import {
  investigationMembers,
  verifyInvestigationMembers
} from "../../src/transactions/transaction-files.ts";
import { withTempRoot } from "../support/fixture-support.ts";

test("Investigation member scans preserve sorted complete metadata without reading source bodies", async (t) => {
  await withTempRoot("member-metadata", async (root) => {
    const names = [".hidden", "Z.md", "_resources", "a.md"];
    for (let index = 0; index < 40; index++)
      names.push(`b${String(index).padStart(2, "0")}.md`);
    for (const name of names.toReversed()) {
      const target = path.join(root, name);
      if (name === "_resources") await fs.mkdir(target, { mode: 0o750 });
      else
        await fs.writeFile(target, "body must not be read\n", { mode: 0o640 });
      await fs.chmod(target, name === "_resources" ? 0o750 : 0o640);
    }
    // The independently guarded index does not participate in membership.
    await fs.symlink(
      "missing-index",
      path.join(root, "investigation-index.json")
    );
    const expected = [];
    for (const name of names) {
      const target = path.join(root, name);
      const stats = await fs.lstat(target);
      expected.push({
        path: target,
        dev: stats.dev,
        ino: stats.ino,
        mode: name === "_resources" ? 0o750 : 0o640,
        kind: name === "_resources" ? "directory" : "file"
      });
    }
    const forbiddenRead = async () => {
      throw new Error("Membership must not read source bytes");
    };
    const open = t.mock.method(fs, "open", forbiddenRead);
    const read = t.mock.method(fs, "readFile", forbiddenRead);
    try {
      assert.deepEqual(await investigationMembers(root), expected);
    } finally {
      open.mock.restore();
      read.mock.restore();
    }
  });
});

test("Investigation member scans reject symbolic links and special files", async () => {
  await withTempRoot("member-unsafe", async (root) => {
    const link = path.join(root, "a-link");
    const socket = path.join(root, "b-socket");
    await fs.symlink("missing", link);
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(socket, resolve);
    });
    try {
      await assert.rejects(investigationMembers(root), {
        message: "Unsafe Investigation collection member: " + link
      });
      await fs.unlink(link);
      await assert.rejects(investigationMembers(root), {
        message: "Unsafe Investigation collection member: " + socket
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) =>
          error === undefined ? resolve() : reject(error)
        );
      });
    }
  });
});

test("Investigation member verification refreshes identities and modes while guarding excluded paths for safety", async () => {
  await withTempRoot("member-fresh", async (root) => {
    const selected = path.join(root, "selected.md");
    const unrelated = path.join(root, "unrelated.md");
    await fs.writeFile(selected, "selected\n", { mode: 0o640 });
    await fs.writeFile(unrelated, "unrelated\n", { mode: 0o640 });
    await fs.chmod(selected, 0o640);
    await fs.chmod(unrelated, 0o640);
    const expected = await investigationMembers(root);
    await verifyInvestigationMembers(root, expected);
    await fs.chmod(unrelated, 0o600);
    await assert.rejects(verifyInvestigationMembers(root, expected), {
      message: "Investigation collection members changed during transaction"
    });
    await fs.chmod(unrelated, 0o640);
    const replacement = path.join(root, "replacement.md");
    await fs.writeFile(replacement, "replacement\n", { mode: 0o640 });
    await fs.rename(replacement, unrelated);
    await assert.rejects(verifyInvestigationMembers(root, expected), {
      message: "Investigation collection members changed during transaction"
    });
    await verifyInvestigationMembers(root, expected, [unrelated]);
    await fs.unlink(unrelated);
    await verifyInvestigationMembers(root, expected, [unrelated]);
    await fs.symlink("missing", unrelated);
    await assert.rejects(
      verifyInvestigationMembers(root, expected, [unrelated]),
      {
        message: "Unsafe Investigation collection member: " + unrelated
      }
    );
  });
});

test("Investigation member scans drain bounded reads before returning the sorted first failure and stop later batches", async (t) => {
  await withTempRoot("member-drain", async (root) => {
    const names = Array.from({ length: 70 }, (_, index) =>
      String(index).padStart(3, "0")
    );
    for (const name of names) await fs.writeFile(path.join(root, name), "\n");
    const stats = await fs.lstat(path.join(root, names[0]));
    const listing = await fs.readdir(root);
    const directory = t.mock.method(fs, "readdir", async () =>
      listing.toReversed()
    );
    const firstFailure = Object.assign(new Error("first ordered read failed"), {
      code: "EACCES"
    });
    const laterFailure = new Error("later read failed sooner");
    const gate = Promise.withResolvers<void>();
    const started: string[] = [];
    let pending = 0;
    let returned = false;
    let observedError: unknown;
    const scan = t.mock.method(
      fs,
      "lstat",
      async (target: Parameters<typeof fs.lstat>[0]) => {
        const name = path.basename(String(target));
        started.push(name);
        pending++;
        try {
          if (name === names[1]) throw laterFailure;
          await gate.promise;
          if (name === names[0]) throw firstFailure;
          return stats;
        } finally {
          pending--;
        }
      }
    );
    const operation = investigationMembers(root).then(
      () => {
        returned = true;
      },
      (error: unknown) => {
        observedError = error;
        returned = true;
      }
    );
    try {
      // A turn boundary flushes promise reactions, without a timing threshold.
      await setImmediate();
      assert.ok(started.length > 1, "The metadata reads should overlap");
      assert.ok(started.length <= 32, "The read batch must remain bounded");
      const batch = [...started];
      assert.deepEqual(batch, names.slice(0, batch.length));
      assert.equal(
        returned,
        false,
        "A failed read must not bypass pending reads"
      );
      gate.resolve();
      await operation;
      assert.equal(observedError, firstFailure);
      assert.equal(pending, 0, "No launched read may outlive the scan");
      assert.deepEqual(started, batch, "Failure must prevent later batches");
    } finally {
      gate.resolve();
      await operation;
      await setImmediate();
      scan.mock.restore();
      directory.mock.restore();
    }
  });
});
