import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { TaskGraphService } from "../../src/service.ts";
import { TaskGraphError } from "../../src/errors.ts";
import {
  expectTaskGraphRejection,
  loadRootNativeLock,
  resolveNodeExecutable,
  withTempWorkspace
} from "../support/helpers.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
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
    assert.ok(rejected?.status === "rejected");
    const error: unknown = rejected.reason;
    assert.ok(error instanceof TaskGraphError);
    assert.equal(error.code, "REVISION_CONFLICT");
    assert.equal((await first.info()).revision, 1);
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
    let childError: Error | undefined;
    child.once("error", (error) => {
      childError = error;
    });
    const closed = new Promise<void>((resolve) => {
      child.once("close", () => resolve());
    });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const exited = Promise.race([
      closed,
      new Promise<never>((_resolve, reject) => {
        deadline = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error("native lock holder did not close within 5000 ms"));
        }, 5_000);
      })
    ]);
    // 退出可能先于 ready 观察；先接住拒绝，再在正常或 finally 路径等待同一结果。
    void exited.catch(() => {});
    try {
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (childError !== undefined) throw childError;
        assert.equal(
          child.exitCode,
          null,
          "native lock holder exited before ready"
        );
        assert.equal(
          child.signalCode,
          null,
          "native lock holder was killed before ready"
        );
        try {
          ready = (await fs.readFile(readyPath, "utf8")) === "ready";
        } catch (error) {
          if (
            !(
              error instanceof Error &&
              "code" in error &&
              error.code === "ENOENT"
            )
          )
            throw error;
        }
        if (ready) break;
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(
        ready,
        true,
        "native lock holder did not become ready within 100 attempts"
      );
      child.kill("SIGKILL");
      await exited;
      const created = await createTask(service, 0, "after-exit");
      assert.equal(created.revision, 1);
      assert.equal(await fs.readFile(service.store.lockPath, "utf8"), "");
    } finally {
      try {
        if (child.exitCode === null && child.signalCode === null)
          child.kill("SIGKILL");
        await closed;
      } finally {
        clearTimeout(deadline);
      }
    }
  });
});
