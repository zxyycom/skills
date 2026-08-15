import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { NativeLockBinding } from "../src/runtime.ts";
import { TaskGraphService } from "../src/service.ts";
import { TaskGraphStore, type AtomicWrite } from "../src/store.ts";
import {
  expectTaskGraphRejection,
  initialNow,
  loadUncontendedNativeLock,
  withTempWorkspace
} from "./helpers.ts";

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
    operations: [
      { kind: "create-task", content: { title, goal: `${title} goal` } }
    ]
  });
}

test("lock release failure reports a committed mutation as outcome unknown", async () => {
  await withTempWorkspace(async (root) => {
    await initialize(root);
    const binding: NativeLockBinding = {
      tryLock: () => true,
      unlock: () => {
        throw new Error("unlock failed");
      }
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
    const parsed = JSON.parse(
      await fs.readFile(service.store.indexPath, "utf8")
    ) as unknown;
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
    await fs.writeFile(
      ignorePath,
      "# caller-owned\r\n/custom-rule\r\n",
      "utf8"
    );
    const service = new TaskGraphService({
      root,
      loadNativeLock: loadUncontendedNativeLock
    });
    const same = new TaskGraphStore({ root });
    const other = new TaskGraphStore({
      root,
      indexPath: "docs/task-graph/other.json"
    });
    assert.equal(service.store.lockPath, same.lockPath);
    assert.notEqual(service.store.lockPath, other.lockPath);
    assert.equal(
      path.dirname(service.store.lockPath),
      path.join(os.tmpdir(), "task-graph-locks")
    );
    assert.match(
      path.basename(service.store.lockPath),
      /^[a-f0-9]{64}\.lock$/u
    );
    await service.init();
    assert.equal(
      await fs.readFile(ignorePath, "utf8"),
      "# caller-owned\r\n/custom-rule\r\n"
    );
    await assert.rejects(fs.stat(`${service.store.indexPath}.lock`), {
      code: "ENOENT"
    });
    await fs.unlink(service.store.lockPath);
  });
});
