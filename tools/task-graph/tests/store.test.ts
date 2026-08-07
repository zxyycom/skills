import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { NativeLockBinding } from "../src/runtime.ts";
import { TaskGraphService } from "../src/service.ts";
import { TaskGraphStore, type AtomicWrite } from "../src/store.ts";
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
    loadNativeLock: loadUncontendedNativeLock,
    lockRoot: path.join(root, "test-locks")
  });
  await service.init();
  return service;
}

async function createTask(
  service: TaskGraphService,
  expectedRevision: number,
  title: string
) {
  return await service.apply({
    expectedRevision,
    operations: [{ kind: "create-task", content: { title, goal: `${title} goal` } }]
  });
}

test("store serializes concurrent native mutations and preserves revision compare-and-swap", async () => {
  await withTempWorkspace(async (root) => {
    const lockRoot = path.join(root, "test-locks");
    const first = new TaskGraphService({ root, lockRoot, loadNativeLock: loadRootNativeLock });
    const second = new TaskGraphService({ root, lockRoot, loadNativeLock: loadRootNativeLock });
    await first.init();
    const settled = await Promise.allSettled([
      createTask(first, 0, "first"),
      createTask(second, 0, "second")
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
      lockRoot: path.join(root, "test-locks"),
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
        () => createTask(service, 0, "blocked"),
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
    const service = new TaskGraphService({
      root,
      lockRoot: path.join(root, "test-locks"),
      loadNativeLock: loadRootNativeLock
    });
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
      const created = await createTask(service, 0, "after-exit");
      assert.equal(created.revision, 1);
      assert.equal(await fs.readFile(service.store.lockPath, "utf8"), "");
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  });
});

test("lock release failure reports a committed mutation as outcome unknown", async () => {
  await withTempWorkspace(async (root) => {
    await initialize(root);
    const binding: NativeLockBinding = {
      tryLock: () => true,
      unlock: () => { throw new Error("unlock failed"); }
    };
    const service = new TaskGraphService({
      root,
      lockRoot: path.join(root, "test-locks"),
      loadNativeLock: async () => binding
    });
    const error = await expectTaskGraphRejection(
      () => createTask(service, 0, "unknown-release"),
      "WRITE_OUTCOME_UNKNOWN"
    );
    assert.equal(error.details.phase, "lock-release");
    assert.equal(error.details.possibleRevision, 1);
    assert.equal((await service.info()).revision, 1);
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
    lockRoot: path.join(root, "test-locks"),
    loadNativeLock: loadUncontendedNativeLock
  });
}

test("every rejected atomic write has one conservative outcome-unknown result", async () => {
  const writers: AtomicWrite[] = [
    async () => {
      throw new Error("write failed before replacement");
    },
    async (target, text) => {
      await fs.writeFile(target, text, "utf8");
      throw new Error("response lost after replacement");
    },
    async (target) => {
      await fs.writeFile(target, "{corrupt", "utf8");
      throw new Error("replacement outcome differs");
    }
  ];
  for (const writer of writers) {
    await withTempWorkspace(async (root) => {
      let calls = 0;
      const service = await classificationService(root, async (...args) => {
        calls += 1;
        await writer(...args);
      });
      const error = await expectTaskGraphRejection(
        () => createTask(service, 0, "candidate"),
        "WRITE_OUTCOME_UNKNOWN"
      );
      assert.equal(error.details.possibleRevision, 1);
      assert.equal(calls, 1);
    });
  }
});

test("resolved atomic write succeeds without commit readback", async () => {
  await withTempWorkspace(async (root) => {
    let calls = 0;
    const service = await classificationService(root, async (target) => {
      calls += 1;
      await fs.unlink(target);
    });
    const created = await createTask(service, 0, "no-readback");
    assert.equal(created.revision, 1);
    assert.equal(calls, 1);
    await assert.rejects(fs.stat(service.store.indexPath), { code: "ENOENT" });
  });
});

test("store info reports canonical drift without a separate check operation", async () => {
  await withTempWorkspace(async (root) => {
    const service = await initialize(root);
    const parsed = JSON.parse(await fs.readFile(service.store.indexPath, "utf8")) as unknown;
    await fs.writeFile(service.store.indexPath, JSON.stringify(parsed), "utf8");
    const info = await service.info();
    assert.equal(info.data.valid, true);
    assert.equal(info.data.canonical, false);
    assert.equal(info.data.diagnostics[0]?.code, "index-not-canonical");
  });
});

test("lock path is a deterministic temp hash and index init leaves gitignore caller-owned", async () => {
  await withTempWorkspace(async (root) => {
    const indexDirectory = path.join(root, "docs", "task-graph");
    const ignorePath = path.join(indexDirectory, ".gitignore");
    await fs.mkdir(indexDirectory, { recursive: true });
    await fs.writeFile(ignorePath, "# caller-owned\r\n/custom-rule\r\n", "utf8");
    const service = new TaskGraphService({ root, loadNativeLock: loadUncontendedNativeLock });
    const same = new TaskGraphStore({ root });
    const other = new TaskGraphStore({ root, indexPath: "docs/task-graph/other.json" });
    assert.equal(service.store.lockPath, same.lockPath);
    assert.notEqual(service.store.lockPath, other.lockPath);
    assert.equal(path.dirname(service.store.lockPath), path.join(os.tmpdir(), "task-graph-locks"));
    assert.match(path.basename(service.store.lockPath), /^[a-f0-9]{64}\.lock$/u);
    await service.init();
    assert.equal(
      await fs.readFile(ignorePath, "utf8"),
      "# caller-owned\r\n/custom-rule\r\n"
    );
    await assert.rejects(fs.stat(`${service.store.indexPath}.lock`), { code: "ENOENT" });
    await fs.unlink(service.store.lockPath);
  });
});
