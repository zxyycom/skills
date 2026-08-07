import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { TaskGraphService } from "../src/service.ts";
import { TaskGraphStore, type AtomicWrite } from "../src/store.ts";
import type { NativeLockBinding } from "../src/runtime.ts";
import {
  expectTaskGraphRejection,
  initialNow,
  loadRootNativeLock,
  loadUncontendedNativeLock,
  resolveNodeExecutable,
  withTempWorkspace
} from "./helpers.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);

async function initialize(root: string): Promise<TaskGraphService> {
  const service = new TaskGraphService({
    root,
    clock: () => initialNow,
    loadNativeLock: loadUncontendedNativeLock
  });
  await service.init();
  return service;
}

test("store serializes concurrent native mutations and preserves revision compare-and-swap", async () => {
  await withTempWorkspace(async (root) => {
    const first = new TaskGraphService({ root, loadNativeLock: loadRootNativeLock });
    const second = new TaskGraphService({ root, loadNativeLock: loadRootNativeLock });
    await first.init();
    const settled = await Promise.allSettled([
      first.createScope({ expectedRevision: 0, key: "first" }),
      second.createScope({ expectedRevision: 0, key: "second" })
    ]);
    assert.equal(settled.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = settled.find((result) => result.status === "rejected");
    assert.equal(rejected?.status, "rejected");
    if (rejected?.status === "rejected") {
      assert.equal((rejected.reason as { code?: string }).code, "REVISION_CONFLICT");
    }
    assert.equal((await first.info()).revision, 1);
  });
});

test("native binding excludes two independent file descriptors in one process", async () => {
  await withTempWorkspace(async (root) => {
    const binding = await loadRootNativeLock();
    const lockPath = path.join(root, "lock");
    const first = await fs.open(lockPath, "a+");
    const second = await fs.open(lockPath, "a+");
    try {
      assert.equal(binding.tryLock(first.fd), true);
      assert.equal(binding.tryLock(second.fd), false);
      binding.unlock(first.fd);
      assert.equal(binding.tryLock(second.fd), true);
      binding.unlock(second.fd);
    } finally {
      await first.close();
      await second.close();
    }
  });
});

test("active native lock holder reaches bounded timeout and leaves the stable lock file", async () => {
  await withTempWorkspace(async (root) => {
    let monotonicMilliseconds = 0;
    const service = new TaskGraphService({
      root,
      loadNativeLock: loadRootNativeLock,
      monotonicClock: () => monotonicMilliseconds,
      sleep: async (milliseconds) => {
        monotonicMilliseconds += milliseconds;
      }
    });
    await service.init();
    const binding = await loadRootNativeLock();
    const holder = await fs.open(service.store.lockPath, "a+");
    assert.equal(binding.tryLock(holder.fd), true);
    try {
      const error = await expectTaskGraphRejection(
        () => service.createScope({ expectedRevision: 0, key: "blocked" }),
        "LOCK_TIMEOUT"
      );
      assert.equal(error.details.waitMilliseconds, 5_000);
      assert.equal(monotonicMilliseconds, 5_000);
      assert.equal((await fs.stat(service.store.lockPath)).isFile(), true);
    } finally {
      binding.unlock(holder.fd);
      await holder.close();
    }
  });
});

test("operating system releases a child process native lock without stale metadata recovery", async () => {
  await withTempWorkspace(async (root) => {
    const service = new TaskGraphService({ root, loadNativeLock: loadRootNativeLock });
    await service.init();
    const node = await resolveNodeExecutable();
    const readyPath = path.join(root, "ready");
    const script = [
      "const fs=require('node:fs')",
      "const binding=require('fs-native-extensions')",
      "const handle=fs.openSync(process.argv[1],'a+')",
      "if(!binding.tryLock(handle))process.exit(3)",
      "fs.writeFileSync(process.argv[2],'ready')",
      "setInterval(()=>{},1000)"
    ].join(";");
    const child = spawn(node, ["-e", script, service.store.lockPath, readyPath], {
      cwd: repositoryRoot,
      stdio: "ignore",
      windowsHide: true
    });
    try {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
          if (await fs.readFile(readyPath, "utf8") === "ready") break;
        } catch {
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
        }
      }
      assert.equal(await fs.readFile(readyPath, "utf8"), "ready");
      child.kill("SIGKILL");
      await new Promise<void>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", () => resolve());
      });
      const created = await service.createScope({ expectedRevision: 0, key: "after-exit" });
      assert.equal(created.revision, 1);
      assert.equal(await fs.readFile(service.store.lockPath, "utf8"), "");
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  });
});

test("lock FileHandle stat failure still closes the opened descriptor", async () => {
  await withTempWorkspace(async (root) => {
    const service = await initialize(root);
    const sample = await fs.open(path.join(root, "prototype-sample"), "a+");
    const prototype = Object.getPrototypeOf(sample) as {
      close: (this: fs.FileHandle) => Promise<void>;
      stat: (this: fs.FileHandle) => ReturnType<fs.FileHandle["stat"]>;
    };
    await sample.close();
    const originalClose = prototype.close;
    const originalStat = prototype.stat;
    let closed = 0;
    prototype.stat = async function statFailure() {
      throw Object.assign(new Error("stat failed"), { code: "EIO" });
    };
    prototype.close = async function trackedClose() {
      closed += 1;
      await originalClose.call(this);
    };
    try {
      const error = await expectTaskGraphRejection(
        () => service.createScope({ expectedRevision: 0, key: "stat-failure" }),
        "WRITE_FAILED"
      );
      assert.equal(error.details.phase, "lock-open");
      assert.equal(closed, 1);
    } finally {
      prototype.stat = originalStat;
      prototype.close = originalClose;
    }
  });
});

test("successful close preserves a committed mutation when native unlock fails", async () => {
  await withTempWorkspace(async (root) => {
    await initialize(root);
    const binding: NativeLockBinding = {
      tryLock: () => true,
      unlock: () => { throw new Error("unlock failed"); }
    };
    const service = new TaskGraphService({ root, loadNativeLock: async () => binding });
    const created = await service.createScope({ expectedRevision: 0, key: "closed" });
    assert.equal(created.revision, 1);
    assert.equal((await service.info()).revision, 1);
  });
});

test("failed unlock and close classify a committed mutation as outcome unknown", async () => {
  await withTempWorkspace(async (root) => {
    await initialize(root);
    const binding: NativeLockBinding = {
      tryLock: () => true,
      unlock: () => { throw new Error("unlock failed"); }
    };
    const service = new TaskGraphService({ root, loadNativeLock: async () => binding });
    const sample = await fs.open(path.join(root, "prototype-sample"), "a+");
    const prototype = Object.getPrototypeOf(sample) as {
      close: (this: fs.FileHandle) => Promise<void>;
      stat: (this: fs.FileHandle) => ReturnType<fs.FileHandle["stat"]>;
    };
    await sample.close();
    const originalClose = prototype.close;
    const originalStat = prototype.stat;
    let target: fs.FileHandle | null = null;
    prototype.stat = async function trackedStat(...args) {
      target = this;
      return await originalStat.apply(this, args);
    };
    prototype.close = async function closeFailure() {
      if (this === target) throw new Error("close failed");
      await originalClose.call(this);
    };
    try {
      const error = await expectTaskGraphRejection(
        () => service.createScope({ expectedRevision: 0, key: "unknown-release" }),
        "WRITE_OUTCOME_UNKNOWN"
      );
      assert.equal(error.details.phase, "lock-release");
      assert.equal(error.details.possibleRevision, 1);
    } finally {
      prototype.stat = originalStat;
      prototype.close = originalClose;
      if (target !== null) await originalClose.call(target);
    }
  });
});

async function classificationService(
  root: string,
  atomicWrite: AtomicWrite
): Promise<TaskGraphService> {
  await initialize(root);
  return new TaskGraphService({
    root,
    atomicWrite,
    loadNativeLock: loadUncontendedNativeLock
  });
}

test("single atomic write failure with the complete old text returns WRITE_FAILED", async () => {
  await withTempWorkspace(async (root) => {
    let calls = 0;
    const service = await classificationService(root, async () => {
      calls += 1;
      throw new Error("write failed before replacement");
    });
    await expectTaskGraphRejection(
      () => service.createScope({ expectedRevision: 0, key: "old" }),
      "WRITE_FAILED"
    );
    assert.equal(calls, 1);
    assert.equal((await service.info()).revision, 0);
  });
});

test("single atomic write that installs the complete candidate before throwing succeeds", async () => {
  await withTempWorkspace(async (root) => {
    let calls = 0;
    const service = await classificationService(root, async (target, text) => {
      calls += 1;
      await fs.writeFile(target, text, "utf8");
      throw new Error("response lost after replacement");
    });
    const created = await service.createScope({ expectedRevision: 0, key: "candidate" });
    assert.equal(created.revision, 1);
    assert.equal(calls, 1);
  });
});

test("single atomic write leaving different text returns WRITE_OUTCOME_UNKNOWN", async () => {
  await withTempWorkspace(async (root) => {
    let calls = 0;
    const service = await classificationService(root, async (target) => {
      calls += 1;
      await fs.writeFile(target, "{corrupt", "utf8");
      throw new Error("replacement outcome differs");
    });
    const error = await expectTaskGraphRejection(
      () => service.createScope({ expectedRevision: 0, key: "different" }),
      "WRITE_OUTCOME_UNKNOWN"
    );
    assert.equal(error.details.observedRevision, "unreadable");
    assert.equal(calls, 1);
  });
});

test("successful atomic call with missing readback returns WRITE_OUTCOME_UNKNOWN", async () => {
  await withTempWorkspace(async (root) => {
    let calls = 0;
    const service = await classificationService(root, async (target) => {
      calls += 1;
      await fs.unlink(target);
    });
    const error = await expectTaskGraphRejection(
      () => service.createScope({ expectedRevision: 0, key: "missing" }),
      "WRITE_OUTCOME_UNKNOWN"
    );
    assert.equal(error.details.observedRevision, null);
    assert.equal(calls, 1);
  });
});

test("store check detects complete-text canonical drift", async () => {
  await withTempWorkspace(async (root) => {
    const service = await initialize(root);
    const parsed = JSON.parse(await fs.readFile(service.store.indexPath, "utf8")) as unknown;
    await fs.writeFile(service.store.indexPath, JSON.stringify(parsed), "utf8");
    const checked = await service.check();
    assert.equal(checked.data.valid, false);
    assert.equal(checked.data.canonical, false);
    assert.equal(checked.data.diagnostics[0]?.code, "index-not-canonical");
  });
});

test("index init appends the local ignore rule without changing existing CRLF content or order", async () => {
  await withTempWorkspace(async (root) => {
    const indexDirectory = path.join(root, "docs", "task-graph");
    const ignorePath = path.join(indexDirectory, ".gitignore");
    await fs.mkdir(indexDirectory, { recursive: true });
    await fs.writeFile(ignorePath, "# existing\r\n/existing-artifact\r\n", "utf8");
    const service = new TaskGraphService({
      root,
      loadNativeLock: loadUncontendedNativeLock
    });
    await service.init();
    assert.equal(
      await fs.readFile(ignorePath, "utf8"),
      "# existing\r\n/existing-artifact\r\n# task-graph runtime artifacts\r\n/task-graph-index.json.*\r\n"
    );
    assert.equal((await fs.stat(service.store.lockPath)).isFile(), true);
  });
});

test("local ignore write failure creates no index, lock, or atomic runtime artifact", async () => {
  await withTempWorkspace(async (root) => {
    const service = new TaskGraphService({
      root,
      loadNativeLock: loadUncontendedNativeLock,
      atomicWrite: async () => { throw new Error("ignore write failed"); }
    });
    const error = await expectTaskGraphRejection(() => service.init(), "WRITE_FAILED");
    assert.equal(error.details.phase, "gitignore-write");
    for (const target of [
      service.store.indexPath,
      service.store.lockPath,
      path.join(path.dirname(service.store.indexPath), ".gitignore")
    ]) {
      await assert.rejects(fs.stat(target), { code: "ENOENT" });
    }
    assert.deepEqual(await fs.readdir(path.dirname(service.store.indexPath)), []);
  });
});

test("store rejects an index path crossing an existing symbolic link", async () => {
  if (process.platform === "win32") {
    return;
  }
  await withTempWorkspace(async (root) => {
    const outside = path.join(root, "outside");
    const linked = path.join(root, "linked");
    await fs.mkdir(outside);
    await fs.symlink(outside, linked, "dir");
    const store = new TaskGraphStore({
      root,
      indexPath: "linked/index.json",
      loadNativeLock: loadUncontendedNativeLock
    });
    const error = await expectTaskGraphRejection(() => store.init(), "PATH_SYMLINK");
    assert.equal(error.details.path, linked);
  });
});
