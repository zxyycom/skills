import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { TaskGraphService } from "../src/service.ts";
import {
  expectTaskGraphRejection,
  loadRootNativeLock,
  resolveNodeExecutable,
  withTempWorkspace
} from "./helpers.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);

async function createTask(
  service: TaskGraphService,
  expectedRevision: number,
  title: string
) {
  return await service.apply({
    expectedRevision,
    operations: [
      { kind: "create-task", content: { title, goal: `${title} goal` } }
    ]
  });
}

test("store serializes concurrent native mutations and preserves revision compare-and-swap", async () => {
  await withTempWorkspace(async (root) => {
    const lockRoot = path.join(root, "test-locks");
    const first = new TaskGraphService({
      root,
      lockRoot,
      loadNativeLock: loadRootNativeLock
    });
    const second = new TaskGraphService({
      root,
      lockRoot,
      loadNativeLock: loadRootNativeLock
    });
    await first.init();
    const settled = await Promise.allSettled([
      createTask(first, 0, "first"),
      createTask(second, 0, "second")
    ]);
    assert.equal(
      settled.filter((result) => result.status === "fulfilled").length,
      1
    );
    const rejected = settled.find((result) => result.status === "rejected");
    assert.equal(rejected?.status, "rejected");
    if (rejected?.status === "rejected") {
      assert.equal(
        (rejected.reason as { code?: string }).code,
        "REVISION_CONFLICT"
      );
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
    const child = spawn(
      node,
      ["-e", script, service.store.lockPath, readyPath],
      {
        cwd: repositoryRoot,
        stdio: "ignore",
        windowsHide: true
      }
    );
    try {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
          if ((await fs.readFile(readyPath, "utf8")) === "ready") break;
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
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    }
  });
});
