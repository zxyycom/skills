import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  TaskGraphError,
  TaskGraphService
} from "../src/index.ts";
import { TaskGraphStore } from "../src/store.ts";
import {
  expectTaskGraphRejection,
  initialNow,
  mutableClock,
  taskContent,
  uuidSequence,
  withTempWorkspace
} from "./helpers.ts";

const indexRelativePath = "docs/task-graph/task-graph-index.json";

async function createReadyTasks(
  service: TaskGraphService,
  count: number
): Promise<{ revision: number; scopeId: string; taskIds: string[] }> {
  await service.init();
  const scope = await service.createScope({
    expectedRevision: 0,
    key: "concurrency"
  });
  const created = await service.apply({
    expectedRevision: scope.revision,
    operations: Array.from({ length: count }, (_, index) => ({
      kind: "create-task" as const,
      scopeId: scope.data.scopeId,
      alias: `task-${index + 1}`,
      content: taskContent(`task ${index + 1}`),
      control: { mode: "queued" as const }
    }))
  });
  return {
    revision: created.revision,
    scopeId: scope.data.scopeId,
    taskIds: created.data.createdTaskIds
  };
}

async function writeLock(
  lockPath: string,
  options: {
    hostname?: string;
    ownerToken?: string;
    pid?: number;
    updatedAt?: string;
  } = {}
): Promise<void> {
  const ownerToken = options.ownerToken ?? "00000000-0000-4000-8000-000000009001";
  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(path.join(lockPath, `owner-${ownerToken}.json`), `${JSON.stringify({
    ownerToken,
    hostname: options.hostname ?? "test-host",
    pid: options.pid ?? 9001,
    updatedAt: options.updatedAt ?? "2026-08-06T07:00:00.000Z"
  }, null, 2)}\n`, "utf8");
}

async function writeClaimedLock(
  lockPath: string,
  options: {
    hostname?: string;
    observedOwnerToken?: string;
    pid?: number;
    reclaimerToken?: string;
    updatedAt?: string;
  } = {}
): Promise<void> {
  const ownerToken = options.observedOwnerToken
    ?? "00000000-0000-4000-8000-000000009001";
  const reclaimerToken = options.reclaimerToken
    ?? "00000000-0000-4000-8000-000000009301";
  await fs.writeFile(path.join(lockPath, `reclaimer-${reclaimerToken}.json`), `${JSON.stringify({
    hostname: options.hostname ?? "test-host",
    observedOwnerToken: ownerToken,
    pid: options.pid ?? 9301,
    reclaimerToken,
    updatedAt: options.updatedAt ?? "2026-08-06T07:00:00.000Z"
  }, null, 2)}\n`, "utf8");
  await fs.rename(
    path.join(lockPath, `owner-${ownerToken}.json`),
    path.join(lockPath, `owner-${ownerToken}.claimed-by-${reclaimerToken}.json`)
  );
}

async function readCurrentOwnerMetadata(lockPath: string): Promise<{ ownerToken: string }> {
  const ownerName = (await fs.readdir(lockPath)).find((name) =>
    /^owner-[0-9a-f-]+\.json$/u.test(name)
  );
  assert.ok(ownerName);
  return JSON.parse(await fs.readFile(path.join(lockPath, ownerName), "utf8")) as {
    ownerToken: string;
  };
}

test("store serializes concurrent claims and global revision compare-and-swap", async () => {
  await withTempWorkspace(async (root) => {
    const first = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(1),
      leaseIdGenerator: uuidSequence(101),
      lockPollMilliseconds: 1
    });
    const second = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(1001),
      leaseIdGenerator: uuidSequence(201),
      lockPollMilliseconds: 1
    });
    const setup = await createReadyTasks(first, 2);
    await first.setExclusion({
      expectedRevision: setup.revision,
      scopeId: setup.scopeId,
      taskId: setup.taskIds[0]!,
      excludedTaskId: setup.taskIds[1]!,
      present: true
    });

    const claims = await Promise.allSettled([
      first.claim({
        scopeId: setup.scopeId,
        taskId: setup.taskIds[0]!,
        actor: "first"
      }),
      second.claim({
        scopeId: setup.scopeId,
        taskId: setup.taskIds[1]!,
        actor: "second"
      })
    ]);
    assert.equal(claims.filter((result) => result.status === "fulfilled").length, 1);
    const claimFailure = claims.find((result) => result.status === "rejected");
    assert.equal(claimFailure?.status, "rejected");
    if (claimFailure?.status === "rejected") {
      assert.equal(claimFailure.reason.code, "STATE_CONFLICT");
    }

    const current = await first.readIndex();
    const mutations = await Promise.allSettled([
      first.createScope({ expectedRevision: current.revision, key: "cas-first" }),
      second.createScope({ expectedRevision: current.revision, key: "cas-second" })
    ]);
    assert.equal(mutations.filter((result) => result.status === "fulfilled").length, 1);
    const mutationFailure = mutations.find((result) => result.status === "rejected");
    assert.equal(mutationFailure?.status, "rejected");
    if (mutationFailure?.status === "rejected") {
      assert.equal(mutationFailure.reason.code, "REVISION_CONFLICT");
    }
  });
});

test("index check reports canonical drift without rewriting authoritative content", async () => {
  await withTempWorkspace(async (root) => {
    const service = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(1)
    });
    await service.init();
    const canonical = await fs.readFile(service.store.indexPath, "utf8");
    const nonCanonical = JSON.stringify(JSON.parse(canonical) as unknown);
    await fs.writeFile(service.store.indexPath, nonCanonical, "utf8");

    const checked = await service.check();
    assert.equal(checked.revision, 0);
    assert.equal(checked.data.valid, false);
    assert.equal(checked.data.canonical, false);
    assert.deepEqual(
      checked.data.diagnostics.map((diagnostic) => diagnostic.code),
      ["index-not-canonical"]
    );
    assert.equal(await fs.readFile(service.store.indexPath, "utf8"), nonCanonical);

    await fs.writeFile(service.store.indexPath, canonical, "utf8");
    const scope = await service.createScope({ expectedRevision: 0, key: "semantic-check" });
    const task = await service.createTask({
      expectedRevision: scope.revision,
      scopeId: scope.data.scopeId,
      content: taskContent("invalid running inherit"),
      control: { mode: "queued" }
    });
    const semanticInvalid = (await service.readIndex()).data;
    const entry = semanticInvalid.scopes[scope.data.scopeId]!.tasks[task.data.taskId]!;
    entry.state.control = { mode: "inherit", reason: null };
    entry.state.execution = {
      phase: "running",
      attempt: 1,
      lease: {
        id: "lease-00000000-0000-4000-8000-000000001234",
        actor: "worker",
        claimedAt: initialNow.toISOString(),
        renewedAt: initialNow.toISOString(),
        expiresAt: "2026-08-06T09:00:00.000Z"
      }
    };
    await fs.writeFile(
      service.store.indexPath,
      `${JSON.stringify(semanticInvalid, null, 2)}\n`,
      "utf8"
    );
    const semanticCheck = await service.check();
    assert.equal(semanticCheck.data.valid, false);
    assert.deepEqual(
      semanticCheck.data.diagnostics.map((diagnostic) => diagnostic.code),
      ["index-invalid"]
    );
  });
});

test("fresh incomplete locks retry while stale incomplete locks require recovery", async () => {
  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(1)
    });
    await bootstrap.init();
    await fs.mkdir(bootstrap.store.lockPath);
    let slept = false;
    const retrying = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(101),
      lockPollMilliseconds: 1,
      lockWaitMilliseconds: 100,
      sleep: async () => {
        slept = true;
        await fs.rmdir(bootstrap.store.lockPath);
      }
    });
    const created = await retrying.createScope({
      expectedRevision: 0,
      key: "after-fresh-window"
    });
    assert.equal(slept, true);
    assert.equal(created.revision, 1);

    await fs.mkdir(bootstrap.store.lockPath);
    await fs.utimes(
      bootstrap.store.lockPath,
      new Date("2026-08-06T07:00:00.000Z"),
      new Date("2026-08-06T07:00:00.000Z")
    );
    const stale = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(201),
      lockPollMilliseconds: 1,
      lockWaitMilliseconds: 10,
      lockStaleMilliseconds: 60_000
    });
    await expectTaskGraphRejection(() => stale.createScope({
      expectedRevision: 1,
      key: "must-not-steal"
    }), "LOCK_RECOVERY_REQUIRED");
  });
});

test("injected clock controls effective projection and lock-wait deadlines", async () => {
  await withTempWorkspace(async (root) => {
    const time = mutableClock();
    const service = new TaskGraphService({
      root,
      clock: time.clock,
      idGenerator: uuidSequence(1),
      leaseIdGenerator: uuidSequence(101)
    });
    const setup = await createReadyTasks(service, 1);
    await service.claim({
      scopeId: setup.scopeId,
      taskId: setup.taskIds[0]!,
      actor: "clock-worker"
    });
    time.set("2026-08-06T08:31:00.000Z");
    const shown = await service.showTask(setup.scopeId, setup.taskIds[0]!);
    assert.equal(shown.data.projection.effectiveState, "recovery-needed");
  });

  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(201)
    });
    await bootstrap.init();
    await writeLock(bootstrap.store.lockPath, {
      updatedAt: initialNow.toISOString()
    });
    let now = initialNow.valueOf();
    let sleepCalls = 0;
    const waiting = new TaskGraphService({
      root,
      clock: () => {
        const result = new Date(now);
        now += 10;
        return result;
      },
      hostname: "test-host",
      idGenerator: uuidSequence(301),
      lockPollMilliseconds: 1,
      lockWaitMilliseconds: 5,
      lockStaleMilliseconds: 1_000_000_000,
      sleep: async () => {
        sleepCalls += 1;
      }
    });
    const originalDateNow = Date.now;
    Date.now = () => {
      throw new Error("lock wait must use the injected clock");
    };
    try {
      await expectTaskGraphRejection(() => waiting.createScope({
        expectedRevision: 0,
        key: "clock-timeout"
      }), "LOCK_TIMEOUT");
    } finally {
      Date.now = originalDateNow;
    }
    assert.equal(sleepCalls, 1);
  });
});

test("operation errors expose lock-release failures with the original error context", async () => {
  await withTempWorkspace(async (root) => {
    const ids = [
      "00000000-0000-4000-8000-000000007001",
      "00000000-0000-4000-8000-000000007002",
      "00000000-0000-4000-8000-000000007003",
      "00000000-0000-4000-8000-000000007004",
      "00000000-0000-4000-8000-000000007005"
    ];
    const store = new TaskGraphStore({
      root,
      clock: () => initialNow,
      idGenerator: () => ids.shift()
        ?? "00000000-0000-4000-8000-000000007999"
    });
    await store.init();
    const blockedQuarantine = `${store.lockPath}.quarantine-00000000-0000-4000-8000-000000007005`;
    await fs.mkdir(blockedQuarantine, { recursive: true });
    await fs.writeFile(path.join(blockedQuarantine, "blocker"), "occupied\n", "utf8");

    const failure = await expectTaskGraphRejection(() => store.mutate(async () => {
      throw new TaskGraphError(
        "REQUEST_INVALID",
        "operation validation failed",
        { field: "operation" }
      );
    }), "LOCK_RECOVERY_REQUIRED");
    assert.match(JSON.stringify(failure.details), /REQUEST_INVALID/u);
    assert.ok(await fs.stat(store.lockPath));
  });
});

test("committed mutations report unknown outcome when lock release isolation fails", async () => {
  await withTempWorkspace(async (root) => {
    const ids = [
      "00000000-0000-4000-8000-000000006001",
      "00000000-0000-4000-8000-000000006002",
      "00000000-0000-4000-8000-000000006003",
      "00000000-0000-4000-8000-000000006004",
      "00000000-0000-4000-8000-000000006005",
      "00000000-0000-4000-8000-000000006006"
    ];
    const service = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: () => ids.shift()
        ?? "00000000-0000-4000-8000-000000006999"
    });
    await service.init();
    const blockedQuarantine = `${service.store.lockPath}.quarantine-00000000-0000-4000-8000-000000006006`;
    await fs.mkdir(blockedQuarantine, { recursive: true });
    await fs.writeFile(path.join(blockedQuarantine, "blocker"), "occupied\n", "utf8");

    const failure = await expectTaskGraphRejection(() => service.createScope({
      expectedRevision: 0,
      key: "committed-before-release"
    }), "WRITE_OUTCOME_UNKNOWN");
    assert.equal(failure.details.possibleRevision, 1);
    const current = await service.readIndex();
    assert.equal(current.revision, 1);
    assert.ok(current.data.scopes["scope-000001"]);
    assert.ok(await fs.stat(service.store.lockPath));
  });
});

test("stale lock recovery is conservative for live, unknown, remote, and dead owners", async () => {
  for (const variant of [
    { hostname: "test-host", state: "alive" as const },
    { hostname: "test-host", state: "unknown" as const },
    { hostname: "remote-host", state: "dead" as const }
  ]) {
    await withTempWorkspace(async (root) => {
      const bootstrap = new TaskGraphService({
        root,
        clock: () => initialNow,
        hostname: "test-host",
        idGenerator: uuidSequence(1)
      });
      await bootstrap.init();
      await writeLock(bootstrap.store.lockPath, { hostname: variant.hostname });
      const service = new TaskGraphService({
        root,
        clock: () => initialNow,
        hostname: "test-host",
        idGenerator: uuidSequence(101),
        lockStaleMilliseconds: 60_000,
        processState: () => variant.state
      });
      await expectTaskGraphRejection(() => service.createScope({
        expectedRevision: 0,
        key: "blocked"
      }), "LOCK_RECOVERY_REQUIRED");
    });
  }

  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(1)
    });
    await bootstrap.init();
    await writeLock(bootstrap.store.lockPath);
    const recovering = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(101),
      lockStaleMilliseconds: 60_000,
      processState: () => "dead"
    });
    const created = await recovering.createScope({
      expectedRevision: 0,
      key: "recovered"
    });
    assert.equal(created.revision, 1);
    assert.equal(await fs.stat(recovering.store.lockPath).catch(() => null), null);
    const siblings = await fs.readdir(path.dirname(recovering.store.indexPath));
    assert.equal(siblings.some((name) => name.includes(".quarantine-")), false);
  });
});

test("stale recovery never isolates a fresh owner published after observation", async () => {
  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(1)
    });
    await bootstrap.init();
    await writeLock(bootstrap.store.lockPath, {
      ownerToken: "00000000-0000-4000-8000-000000009001"
    });
    await writeClaimedLock(bootstrap.store.lockPath);

    let allowWinnerClaim!: () => void;
    const winnerClaimAllowed = new Promise<void>((resolve) => {
      allowWinnerClaim = resolve;
    });
    let reportWinnerClaim!: () => void;
    const winnerClaimEntered = new Promise<void>((resolve) => {
      reportWinnerClaim = resolve;
    });
    let allowWinnerIsolation!: () => void;
    const winnerIsolationAllowed = new Promise<void>((resolve) => {
      allowWinnerIsolation = resolve;
    });
    let reportWinnerIsolation!: () => void;
    const winnerIsolationEntered = new Promise<void>((resolve) => {
      reportWinnerIsolation = resolve;
    });
    let allowWinnerCommit!: () => void;
    const winnerCommitAllowed = new Promise<void>((resolve) => {
      allowWinnerCommit = resolve;
    });
    let reportWinnerFreshLock!: () => void;
    const winnerFreshLockPublished = new Promise<void>((resolve) => {
      reportWinnerFreshLock = resolve;
    });
    let winnerIsolationCalls = 0;
    let winnerOwnerToken: string | null = null;
    const winner = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(101),
      lockPollMilliseconds: 1,
      lockStaleMilliseconds: 60_000,
      pid: 9101,
      processState: (pid) => {
        assert.equal(pid, 9301);
        return "dead";
      },
      hooks: {
        beforeStaleLockClaim: async ({ observedClaimantToken }) => {
          assert.equal(
            observedClaimantToken,
            "00000000-0000-4000-8000-000000009301"
          );
          reportWinnerClaim();
          await winnerClaimAllowed;
        },
        beforeStaleLockIsolation: async ({ ownerToken }) => {
          assert.equal(ownerToken, "00000000-0000-4000-8000-000000009001");
          winnerIsolationCalls += 1;
          reportWinnerIsolation();
          await winnerIsolationAllowed;
        },
        beforeLockMetadataPublish: ({ ownerToken }) => {
          winnerOwnerToken = ownerToken;
        },
        beforeCommit: async ({ revision }) => {
          if (revision === 1) {
            reportWinnerFreshLock();
            await winnerCommitAllowed;
          }
        }
      }
    });
    const winnerMutation = winner.createScope({
      expectedRevision: 0,
      key: "recovery-winner"
    });
    await winnerClaimEntered;

    let allowLoserClaim!: () => void;
    const loserClaimAllowed = new Promise<void>((resolve) => {
      allowLoserClaim = resolve;
    });
    let reportLoserClaim!: () => void;
    const loserClaimEntered = new Promise<void>((resolve) => {
      reportLoserClaim = resolve;
    });
    let allowLoserRetry!: () => void;
    const loserRetryAllowed = new Promise<void>((resolve) => {
      allowLoserRetry = resolve;
    });
    let reportLoserWait!: () => void;
    const loserWaitEntered = new Promise<void>((resolve) => {
      reportLoserWait = resolve;
    });
    let loserIsolationCalls = 0;
    let loserProcessChecks = 0;
    let loserSleepCalls = 0;
    const monotonicReadings = [0, 0, 10];
    const loser = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(201),
      lockPollMilliseconds: 1,
      lockStaleMilliseconds: 60_000,
      lockWaitMilliseconds: 1,
      monotonicClock: () => monotonicReadings.shift() ?? 10,
      pid: 9102,
      processState: (pid) => {
        assert.equal(pid, 9301);
        loserProcessChecks += 1;
        return "dead";
      },
      sleep: async () => {
        loserSleepCalls += 1;
        if (loserSleepCalls === 1) {
          reportLoserWait();
          await loserRetryAllowed;
        }
      },
      hooks: {
        beforeStaleLockClaim: async ({ observedClaimantToken }) => {
          assert.equal(
            observedClaimantToken,
            "00000000-0000-4000-8000-000000009301"
          );
          reportLoserClaim();
          await loserClaimAllowed;
        },
        beforeStaleLockIsolation: () => {
          loserIsolationCalls += 1;
        }
      }
    });
    const loserMutation = expectTaskGraphRejection(() => loser.createScope({
      expectedRevision: 0,
      key: "recovery-loser"
    }), "LOCK_TIMEOUT");
    await loserClaimEntered;
    allowWinnerClaim();
    await winnerIsolationEntered;
    allowLoserClaim();
    await loserWaitEntered;
    assert.equal(loserProcessChecks, 1);
    assert.equal(winnerIsolationCalls, 1);
    assert.equal(loserIsolationCalls, 0);

    allowWinnerIsolation();
    await winnerFreshLockPublished;
    allowLoserRetry();
    await loserMutation;

    const freshMetadata = await readCurrentOwnerMetadata(winner.store.lockPath);
    assert.equal(freshMetadata.ownerToken, winnerOwnerToken);
    assert.equal(loserIsolationCalls, 0);

    allowWinnerCommit();
    const committed = await winnerMutation;
    assert.equal(committed.revision, 1);
    const index = await winner.readIndex();
    assert.deepEqual(Object.keys(index.data.scopes), ["scope-000001"]);
  });

  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(1201)
    });
    await bootstrap.init();
    await writeLock(bootstrap.store.lockPath, {
      ownerToken: "00000000-0000-4000-8000-000000009001"
    });
    await writeClaimedLock(bootstrap.store.lockPath);

    let releaseObservedDirectory!: () => void;
    const observedDirectoryReleased = new Promise<void>((resolve) => {
      releaseObservedDirectory = resolve;
    });
    let reportObservedDirectory!: () => void;
    const directoryObserved = new Promise<void>((resolve) => {
      reportObservedDirectory = resolve;
    });
    let observationPaused = false;
    const monotonicReadings = [0, 10];
    const observer = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(1301),
      lockPollMilliseconds: 1,
      lockStaleMilliseconds: 60_000,
      lockWaitMilliseconds: 1,
      monotonicClock: () => monotonicReadings.shift() ?? 10,
      processState: () => assert.fail("the replaced generation must be re-read"),
      sleep: async () => undefined,
      hooks: {
        afterStaleLockDirectoryObserved: async () => {
          if (observationPaused) return;
          observationPaused = true;
          reportObservedDirectory();
          await observedDirectoryReleased;
        },
        beforeStaleLockIsolation: () => assert.fail(
          "an observer of the replaced directory must not isolate the fresh owner"
        )
      }
    });
    const observerMutation = expectTaskGraphRejection(() => observer.createScope({
      expectedRevision: 0,
      key: "stale-observer"
    }), "LOCK_TIMEOUT");
    await directoryObserved;

    let allowWinnerCommit!: () => void;
    const winnerCommitAllowed = new Promise<void>((resolve) => {
      allowWinnerCommit = resolve;
    });
    let reportFreshOwner!: () => void;
    const freshOwnerPublished = new Promise<void>((resolve) => {
      reportFreshOwner = resolve;
    });
    const winner = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(1401),
      lockPollMilliseconds: 1,
      lockStaleMilliseconds: 60_000,
      pid: 9501,
      processState: (pid) => {
        assert.equal(pid, 9301);
        return "dead";
      },
      hooks: {
        beforeCommit: async ({ revision }) => {
          if (revision !== 1) return;
          reportFreshOwner();
          await winnerCommitAllowed;
        }
      }
    });
    const winnerMutation = winner.createScope({
      expectedRevision: 0,
      key: "replacement-winner"
    });
    await freshOwnerPublished;

    releaseObservedDirectory();
    await observerMutation;
    const freshOwner = await readCurrentOwnerMetadata(winner.store.lockPath);
    assert.match(freshOwner.ownerToken, /^[0-9a-f-]{36}$/u);

    allowWinnerCommit();
    const committed = await winnerMutation;
    assert.equal(committed.revision, 1);
  });
});

test("claimed recovery generations wait, reject uncertainty, and allow dead takeover", async () => {
  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(1)
    });
    await bootstrap.init();
    await writeLock(bootstrap.store.lockPath, {
      ownerToken: "00000000-0000-4000-8000-000000009001"
    });
    await writeClaimedLock(bootstrap.store.lockPath, {
      updatedAt: initialNow.toISOString()
    });
    const monotonicReadings = [0, 10];
    const waiting = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(501),
      lockPollMilliseconds: 1,
      lockStaleMilliseconds: 60_000,
      lockWaitMilliseconds: 1,
      monotonicClock: () => monotonicReadings.shift() ?? 10,
      processState: () => assert.fail("fresh claimant must not be probed"),
      sleep: async () => undefined
    });
    await expectTaskGraphRejection(() => waiting.createScope({
      expectedRevision: 0,
      key: "fresh-claim-waits"
    }), "LOCK_TIMEOUT");
    const entries = await fs.readdir(waiting.store.lockPath);
    assert.ok(entries.some((entry) => entry.includes(".claimed-by-")));
    assert.ok(entries.some((entry) => entry.startsWith("reclaimer-")));
  });

  for (const variant of [
    { hostname: "test-host", state: "alive" as const },
    { hostname: "test-host", state: "unknown" as const },
    { hostname: "remote-host", state: "dead" as const }
  ]) {
    await withTempWorkspace(async (root) => {
      const bootstrap = new TaskGraphService({
        root,
        clock: () => initialNow,
        hostname: "test-host",
        idGenerator: uuidSequence(601)
      });
      await bootstrap.init();
      await writeLock(bootstrap.store.lockPath, {
        ownerToken: "00000000-0000-4000-8000-000000009001"
      });
      await writeClaimedLock(bootstrap.store.lockPath, {
        hostname: variant.hostname
      });
      const blocked = new TaskGraphService({
        root,
        clock: () => initialNow,
        hostname: "test-host",
        idGenerator: uuidSequence(701),
        lockStaleMilliseconds: 60_000,
        processState: (pid) => {
          assert.equal(pid, 9301);
          return variant.state;
        }
      });
      await expectTaskGraphRejection(() => blocked.createScope({
        expectedRevision: 0,
        key: "stale-claim-blocked"
      }), "LOCK_RECOVERY_REQUIRED");
      const entries = await fs.readdir(blocked.store.lockPath);
      assert.ok(entries.some((entry) => entry.includes(".claimed-by-")));
    });
  }

  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(801)
    });
    await bootstrap.init();
    await writeLock(bootstrap.store.lockPath, {
      ownerToken: "00000000-0000-4000-8000-000000009001"
    });
    await writeClaimedLock(bootstrap.store.lockPath);
    const reclaimerPath = path.join(
      bootstrap.store.lockPath,
      "reclaimer-00000000-0000-4000-8000-000000009301.json"
    );
    await fs.writeFile(reclaimerPath, "{\"invalid\":true}\n", "utf8");
    const invalid = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(901),
      lockStaleMilliseconds: 60_000,
      processState: () => "dead"
    });
    await expectTaskGraphRejection(() => invalid.createScope({
      expectedRevision: 0,
      key: "invalid-stale-claim"
    }), "LOCK_RECOVERY_REQUIRED");
    assert.equal(await fs.readFile(reclaimerPath, "utf8"), "{\"invalid\":true}\n");
  });

  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(951)
    });
    await bootstrap.init();
    await writeLock(bootstrap.store.lockPath, {
      ownerToken: "00000000-0000-4000-8000-000000009001"
    });
    await writeClaimedLock(bootstrap.store.lockPath);
    const claimedOwnerPath = path.join(
      bootstrap.store.lockPath,
      "owner-00000000-0000-4000-8000-000000009001"
        + ".claimed-by-00000000-0000-4000-8000-000000009301.json"
    );
    await fs.writeFile(claimedOwnerPath, "{not-json}\n", "utf8");
    const invalid = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(961),
      lockStaleMilliseconds: 60_000,
      processState: () => "dead"
    });
    await expectTaskGraphRejection(() => invalid.createScope({
      expectedRevision: 0,
      key: "invalid-claimed-owner"
    }), "LOCK_RECOVERY_REQUIRED");
    assert.equal(await fs.readFile(claimedOwnerPath, "utf8"), "{not-json}\n");
  });

  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(971)
    });
    await bootstrap.init();
    await writeLock(bootstrap.store.lockPath, {
      ownerToken: "00000000-0000-4000-8000-000000009001"
    });
    const conflictingToken = "00000000-0000-4000-8000-000000009302";
    const conflictingPath = path.join(
      bootstrap.store.lockPath,
      `reclaimer-${conflictingToken}.json`
    );
    const existingGeneration = "occupied reclaimer generation\n";
    await fs.writeFile(conflictingPath, existingGeneration, "utf8");
    const generatedIds = [
      "00000000-0000-4000-8000-000000009201",
      conflictingToken
    ];
    const conflicting = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: () => generatedIds.shift()
        ?? "00000000-0000-4000-8000-000000009202",
      lockStaleMilliseconds: 60_000,
      processState: () => "dead"
    });
    await expectTaskGraphRejection(() => conflicting.createScope({
      expectedRevision: 0,
      key: "reclaimer-token-collision"
    }), "LOCK_RECOVERY_REQUIRED");
    assert.equal(await fs.readFile(conflictingPath, "utf8"), existingGeneration);
  });

  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(981)
    });
    await bootstrap.init();
    await writeLock(bootstrap.store.lockPath, {
      ownerToken: "00000000-0000-4000-8000-000000009001"
    });
    const faulting = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(991),
      lockStaleMilliseconds: 60_000,
      processState: () => "dead",
      hooks: {
        beforeStaleLockClaim: () => {
          throw Object.assign(new Error("simulated recovery permission failure"), {
            code: "EACCES"
          });
        }
      }
    });
    await expectTaskGraphRejection(() => faulting.createScope({
      expectedRevision: 0,
      key: "recovery-errno"
    }), "LOCK_RECOVERY_REQUIRED");
    const entries = await fs.readdir(faulting.store.lockPath);
    assert.equal(entries.some((entry) => entry.startsWith("reclaimer-")), false);
  });

  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(1001)
    });
    await bootstrap.init();
    await writeLock(bootstrap.store.lockPath, {
      ownerToken: "00000000-0000-4000-8000-000000009001"
    });
    await writeClaimedLock(bootstrap.store.lockPath);
    let isolationCalls = 0;
    const recovering = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(1101),
      lockStaleMilliseconds: 60_000,
      pid: 9401,
      processState: (pid) => {
        assert.equal(pid, 9301);
        return "dead";
      },
      hooks: {
        beforeStaleLockIsolation: () => {
          isolationCalls += 1;
        }
      }
    });
    const created = await recovering.createScope({
      expectedRevision: 0,
      key: "stale-local-dead-claim-taken-over"
    });
    assert.equal(created.revision, 1);
    assert.equal(isolationCalls, 1);
    assert.equal(await fs.stat(recovering.store.lockPath).catch(() => null), null);
  });
});

test("metadata publish failure never discards a replacement canonical owner", async () => {
  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(1)
    });
    await bootstrap.init();

    const replacementOwnerToken = "00000000-0000-4000-8000-000000009101";
    const publishing = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(301),
      hooks: {
        beforeLockMetadataPublish: async ({ lockPath, ownerToken }) => {
          const abandonedPath = `${lockPath}.simulated-abandoned-${ownerToken}`;
          await fs.rename(lockPath, abandonedPath);
          await writeLock(lockPath, {
            ownerToken: replacementOwnerToken,
            pid: 9201,
            updatedAt: initialNow.toISOString()
          });
          await fs.rm(abandonedPath, { force: true, recursive: true });
          throw new Error("metadata publication lost ownership");
        }
      }
    });

    await expectTaskGraphRejection(() => publishing.createScope({
      expectedRevision: 0,
      key: "must-not-discard-replacement"
    }), "LOCK_RECOVERY_REQUIRED");
    const currentOwner = await readCurrentOwnerMetadata(publishing.store.lockPath);
    assert.equal(currentOwner.ownerToken, replacementOwnerToken);
    const index = await publishing.readIndex();
    assert.equal(index.revision, 0);
    assert.deepEqual(index.data.scopes, {});
  });
});

test("release isolation never removes a replacement owner after commit", async () => {
  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(1)
    });
    await bootstrap.init();

    const replacementOwnerToken = "00000000-0000-4000-8000-000000009201";
    let releaseHookCalls = 0;
    const committing = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(401),
      hooks: {
        beforeLockReleaseIsolation: async ({ lockPath, quarantinePath }) => {
          releaseHookCalls += 1;
          const abandonedPath = `${quarantinePath}.simulated-old-owner`;
          await fs.rename(lockPath, abandonedPath);
          await writeLock(lockPath, {
            ownerToken: replacementOwnerToken,
            pid: 9202,
            updatedAt: initialNow.toISOString()
          });
          await fs.rm(abandonedPath, { force: true, recursive: true });
        }
      }
    });

    const failure = await expectTaskGraphRejection(() => committing.createScope({
      expectedRevision: 0,
      key: "committed-before-release-race"
    }), "WRITE_OUTCOME_UNKNOWN");
    assert.equal(failure.details.possibleRevision, 1);
    assert.equal(failure.details.observedRevision, 1);
    assert.equal(releaseHookCalls, 1);
    const currentOwner = await readCurrentOwnerMetadata(committing.store.lockPath);
    assert.equal(currentOwner.ownerToken, replacementOwnerToken);
    const index = await committing.readIndex();
    assert.equal(index.revision, 1);
    assert.ok(index.data.scopes["scope-000001"]);
  });
});

test("a changed lock owner token prevents the old owner from committing", async () => {
  await withTempWorkspace(async (root) => {
    let service: TaskGraphService;
    service = new TaskGraphService({
      root,
      clock: () => initialNow,
      hostname: "test-host",
      idGenerator: uuidSequence(1),
      hooks: {
        beforeCommit: async ({ revision }) => {
          if (revision !== 1) return;
          for (const entry of await fs.readdir(service.store.lockPath)) {
            if (/^owner-[0-9a-f-]+(?:\.claimed-by-[0-9a-f-]+)?\.json$/u.test(entry)) {
              await fs.unlink(path.join(service.store.lockPath, entry));
            }
          }
          await writeLock(service.store.lockPath, {
            ownerToken: "00000000-0000-4000-8000-000000009999"
          });
        }
      }
    });
    await service.init();
    await expectTaskGraphRejection(() => service.createScope({
      expectedRevision: 0,
      key: "must-not-commit"
    }), "LOCK_LOST");
    const index = await service.readIndex();
    assert.equal(index.revision, 0);
    assert.deepEqual(index.data.scopes, {});
    const currentOwner = await readCurrentOwnerMetadata(service.store.lockPath);
    assert.equal(currentOwner.ownerToken, "00000000-0000-4000-8000-000000009999");
  });
});

test("commit-point failures distinguish old, committed, unknown, and post-commit outcomes", async () => {
  await withTempWorkspace(async (root) => {
    const service = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(1),
      hooks: {
        beforeCommit: ({ revision }) => {
          if (revision === 1) throw new Error("before commit");
        }
      }
    });
    await service.init();
    const failure = await expectTaskGraphRejection(() => service.createScope({
      expectedRevision: 0,
      key: "before-failure"
    }), "WRITE_FAILED");
    assert.equal(failure.retryable, true);
    assert.equal((await service.info()).revision, 0);
  });

  await withTempWorkspace(async (root) => {
    let failReplace = false;
    const service = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(101),
      hooks: {
        replaceFile: async (temporaryPath, indexPath) => {
          if (failReplace) throw new Error("replace rejected");
          await fs.rename(temporaryPath, indexPath);
        }
      }
    });
    await service.init();
    failReplace = true;
    await expectTaskGraphRejection(() => service.createScope({
      expectedRevision: 0,
      key: "replace-old-revision"
    }), "WRITE_FAILED");
    assert.equal((await service.info()).revision, 0);
  });

  await withTempWorkspace(async (root) => {
    let shouldThrowAfterRename = false;
    const service = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(201),
      hooks: {
        replaceFile: async (temporaryPath, indexPath) => {
          await fs.rename(temporaryPath, indexPath);
          if (shouldThrowAfterRename) throw new Error("rename returned failure");
        }
      }
    });
    await service.init();
    shouldThrowAfterRename = true;
    const failure = await expectTaskGraphRejection(() => service.createScope({
      expectedRevision: 0,
      key: "committed-unknown"
    }), "WRITE_OUTCOME_UNKNOWN");
    assert.equal(failure.retryable, false);
    assert.equal((await service.info()).revision, 1);
  });

  await withTempWorkspace(async (root) => {
    let corruptAfterInit = false;
    const service = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(301),
      hooks: {
        replaceFile: async (temporaryPath, indexPath) => {
          if (!corruptAfterInit) {
            await fs.rename(temporaryPath, indexPath);
            return;
          }
          await fs.writeFile(indexPath, "{ unreadable\n", "utf8");
          throw new Error("replace left an unreadable outcome");
        }
      }
    });
    await service.init();
    corruptAfterInit = true;
    await expectTaskGraphRejection(() => service.createScope({
      expectedRevision: 0,
      key: "unreadable-outcome"
    }), "WRITE_OUTCOME_UNKNOWN");
  });

  await withTempWorkspace(async (root) => {
    let failAfterCommit = false;
    const service = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(401),
      hooks: {
        afterCommit: ({ revision }) => {
          if (failAfterCommit && revision === 1) throw new Error("response lost");
        }
      }
    });
    await service.init();
    failAfterCommit = true;
    await expectTaskGraphRejection(() => service.createScope({
      expectedRevision: 0,
      key: "post-commit"
    }), "WRITE_OUTCOME_UNKNOWN");
    assert.equal((await service.info()).revision, 1);
  });

  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(501)
    });
    await bootstrap.init();
    const ownerId = "00000000-0000-4000-8000-000000008501";
    const tempId = "00000000-0000-4000-8000-000000008502";
    const generatedIds = [ownerId, tempId];
    const service = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: () => generatedIds.shift()
        ?? "00000000-0000-4000-8000-000000008503"
    });
    const temporaryPath = `${service.store.indexPath}.tmp-${tempId}`;
    const foreignContent = "foreign temporary generation\n";
    await fs.writeFile(temporaryPath, foreignContent, "utf8");
    await expectTaskGraphRejection(() => service.createScope({
      expectedRevision: 0,
      key: "temp-collision"
    }), "WRITE_FAILED");
    assert.equal(await fs.readFile(temporaryPath, "utf8"), foreignContent);
    assert.equal((await service.info()).revision, 0);
  });
});

test("index, lock, and temporary paths reject symbolic-link boundaries", async (t) => {
  let symbolicLinksAvailable = true;
  await withTempWorkspace(async (root) => {
    const target = path.join(root, "target");
    const linked = path.join(root, "linked");
    await fs.mkdir(target);
    try {
      await fs.symlink(target, linked, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        symbolicLinksAvailable = false;
        return;
      }
      throw error;
    }
    const service = new TaskGraphService({
      root,
      indexPath: "linked/index.json",
      clock: () => initialNow,
      idGenerator: uuidSequence(1)
    });
    await expectTaskGraphRejection(() => service.init(), "PATH_SYMLINK");
  });
  if (!symbolicLinksAvailable) {
    t.skip("Symbolic links are unavailable in this environment");
    return;
  }

  await withTempWorkspace(async (root) => {
    const service = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(101)
    });
    await service.init();
    const target = path.join(root, "lock-target");
    await fs.mkdir(target);
    await fs.symlink(
      target,
      service.store.lockPath,
      process.platform === "win32" ? "junction" : "dir"
    );
    await expectTaskGraphRejection(() => service.createScope({
      expectedRevision: 0,
      key: "lock-link"
    }), "PATH_SYMLINK");
  });

  for (const symbolicGeneration of ["claimed-owner", "reclaimer"] as const) {
    await withTempWorkspace(async (root) => {
      const bootstrap = new TaskGraphService({
        root,
        clock: () => initialNow,
        hostname: "test-host",
        idGenerator: uuidSequence(151)
      });
      await bootstrap.init();
      await writeLock(bootstrap.store.lockPath, {
        ownerToken: "00000000-0000-4000-8000-000000009001"
      });
      await writeClaimedLock(bootstrap.store.lockPath);
      const generationPath = symbolicGeneration === "claimed-owner"
        ? path.join(
            bootstrap.store.lockPath,
            "owner-00000000-0000-4000-8000-000000009001"
              + ".claimed-by-00000000-0000-4000-8000-000000009301.json"
          )
        : path.join(
            bootstrap.store.lockPath,
            "reclaimer-00000000-0000-4000-8000-000000009301.json"
          );
      await fs.unlink(generationPath);
      const generationTarget = path.join(root, `${symbolicGeneration}-target`);
      await fs.mkdir(generationTarget);
      await fs.symlink(
        generationTarget,
        generationPath,
        process.platform === "win32" ? "junction" : "dir"
      );
      const recovering = new TaskGraphService({
        root,
        clock: () => initialNow,
        hostname: "test-host",
        idGenerator: uuidSequence(251),
        lockStaleMilliseconds: 60_000,
        processState: () => assert.fail("symbolic generations must not be trusted")
      });
      await expectTaskGraphRejection(() => recovering.createScope({
        expectedRevision: 0,
        key: `${symbolicGeneration}-link`
      }), "LOCK_RECOVERY_REQUIRED");
      assert.equal((await fs.lstat(generationPath)).isSymbolicLink(), true);
    });
  }

  await withTempWorkspace(async (root) => {
    const bootstrap = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: uuidSequence(201)
    });
    await bootstrap.init();
    const ownerId = "00000000-0000-4000-8000-000000008001";
    const tempId = "00000000-0000-4000-8000-000000008002";
    const ids = [ownerId, tempId];
    const service = new TaskGraphService({
      root,
      clock: () => initialNow,
      idGenerator: () => ids.shift() ?? "00000000-0000-4000-8000-000000008003"
    });
    const target = path.join(root, "temp-target");
    await fs.mkdir(target);
    await fs.symlink(
      target,
      `${service.store.indexPath}.tmp-${tempId}`,
      process.platform === "win32" ? "junction" : "dir"
    );
    await expectTaskGraphRejection(() => service.createScope({
      expectedRevision: 0,
      key: "temp-link"
    }), "PATH_SYMLINK");
  });
});
