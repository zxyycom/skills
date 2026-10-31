import {
  assert,
  createRepositoryFixture,
  fs,
  gitTestOptions,
  openVersionControl,
  path,
  runGit,
  test,
  VersionControlError,
  withTempRoot
} from "../protocol/version-control-test-support.ts";
import {
  withGitWriteTrace,
  traceEvents,
  peakAndSettlement
} from "./version-control-blob-write-support.ts";
import { ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

test(
  "failed Git object write stops dispatch and settles started writes before unlocking",
  { ...gitTestOptions, skip: process.platform === "win32" },
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      const files = Array.from({ length: 30 }, (_, index) => ({
        path: `payload/${String(index).padStart(2, "0")}`,
        data: Buffer.from(index === 0 ? "FAIL" : `unique-${index}`),
        kind: "regular" as const
      }));
      await withGitWriteTrace(tempRoot, repositoryRoot, async (trace) => {
        const gate = path.join(tempRoot, "release-after-failure");
        const marker = path.join(tempRoot, "failure-pid");
        const previousGate = process.env.GIT_TEST_WRITE_GATE;
        const previousMarker = process.env.GIT_TEST_FAILURE_MARKER;
        process.env.GIT_TEST_WRITE_GATE = gate;
        process.env.GIT_TEST_FAILURE_MARKER = marker;
        const originalEmit = Reflect.get(
          ChildProcess.prototype,
          "emit"
        ) as typeof ChildProcess.prototype.emit;
        ChildProcess.prototype.emit = function (
          this: ChildProcess,
          event: string | symbol,
          ...args: unknown[]
        ): boolean {
          const result: boolean = Reflect.apply(originalEmit, this, [
            event,
            ...args
          ]);
          if (
            event === "close" &&
            existsSync(marker) &&
            Number(readFileSync(marker, "utf8")) === this.pid
          ) {
            setImmediate(() => writeFileSync(gate, "release"));
          }
          return result;
        } as typeof ChildProcess.prototype.emit;
        let failure: unknown;
        try {
          await assert.rejects(
            repository.replacePendingFiles({
              expectedRevision: currentRevision,
              expectedFiles: [],
              files,
              pathScope: "payload"
            }),
            (error: unknown) => {
              failure = error;
              return true;
            }
          );
        } finally {
          ChildProcess.prototype.emit = originalEmit;
          if (previousGate === undefined)
            delete process.env.GIT_TEST_WRITE_GATE;
          else process.env.GIT_TEST_WRITE_GATE = previousGate;
          if (previousMarker === undefined)
            delete process.env.GIT_TEST_FAILURE_MARKER;
          else process.env.GIT_TEST_FAILURE_MARKER = previousMarker;
        }
        const events = await traceEvents(trace);
        const starts = events.filter((event) => event.event === "start").length;
        assert.ok(starts >= 2 && starts <= 4, `started ${starts} writes`);
        assert.ok(failure instanceof VersionControlError);
        assert.equal(failure.code, "pending-replacement-failed");
        assert.match(failure.detail ?? "", /injected object failure/u);
        const failedPid = Number(await fs.readFile(marker, "utf8"));
        assert.ok(
          events.some(
            (event) => event.event === "start" && event.pid === failedPid
          )
        );
        assert.ok(peakAndSettlement(events) <= 4);
        assert.ok(events.every((event) => event.lock));
        assert.deepEqual(
          await repository.readPendingFiles({ pathScopes: ["payload"] }),
          []
        );
        await assert.rejects(
          fs.stat(path.join(repositoryRoot, ".git", "index.lock")),
          { code: "ENOENT" }
        );
        const before = await fs.readFile(trace, "utf8");
        await new Promise((resolve) => setTimeout(resolve, 250));
        assert.equal(await fs.readFile(trace, "utf8"), before);
      });
      assert.match(
        runGit(repositoryRoot, [
          "ls-files",
          "--stage",
          "--",
          "docs/tracked.md"
        ]),
        /docs\/tracked\.md/u
      );
    });
  }
);

test(
  "stdin failure terminates and closes the child before pending lock recovery",
  { ...gitTestOptions, skip: process.platform === "win32" },
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      await withGitWriteTrace(tempRoot, repositoryRoot, async (trace) => {
        const previous = process.env.GIT_TEST_CLOSE_INPUT;
        process.env.GIT_TEST_CLOSE_INPUT = "1";
        try {
          await assert.rejects(
            repository.replacePendingFiles({
              expectedRevision: currentRevision,
              expectedFiles: [],
              files: [
                {
                  path: "payload/large",
                  data: Buffer.alloc(8 * 1024 * 1024, 42),
                  kind: "regular"
                }
              ],
              pathScope: "payload"
            })
          );
        } finally {
          if (previous === undefined) delete process.env.GIT_TEST_CLOSE_INPUT;
          else process.env.GIT_TEST_CLOSE_INPUT = previous;
        }
        const events = await traceEvents(trace);
        assert.deepEqual(
          events.map((event) => event.event),
          ["start", "term"]
        );
        assert.ok(events.every((event) => event.lock));
        assert.throws(() => process.kill(events[0]!.pid, 0), { code: "ESRCH" });
        await assert.rejects(
          fs.stat(path.join(repositoryRoot, ".git", "index.lock")),
          { code: "ENOENT" }
        );
        assert.deepEqual(
          await repository.readPendingFiles({ pathScopes: ["payload"] }),
          []
        );
      });
    });
  }
);

test(
  "signal failures do not release the pending lock before forced child termination",
  { ...gitTestOptions, skip: process.platform === "win32" },
  async () => {
    for (const failure of ["emitted", "thrown"] as const) {
      await withTempRoot(async (tempRoot) => {
        const { repositoryRoot, currentRevision } =
          await createRepositoryFixture(tempRoot);
        const repository = await openVersionControl(repositoryRoot);
        await withGitWriteTrace(tempRoot, repositoryRoot, async (trace) => {
          const oldPath = process.env.GIT_TEST_CLOSE_INPUT;
          process.env.GIT_TEST_CLOSE_INPUT = "1";
          const original = Reflect.get(
            ChildProcess.prototype,
            "kill"
          ) as typeof ChildProcess.prototype.kill;
          const lockPath = path.join(repositoryRoot, ".git", "index.lock");
          const signals: Array<{ signal: string; lock: boolean }> = [];
          ChildProcess.prototype.kill = function (signal) {
            signals.push({
              signal: String(signal ?? "SIGTERM"),
              lock: existsSync(lockPath)
            });
            if (signal === undefined) {
              const error = Object.assign(new Error("injected kill failure"), {
                code: "EPERM"
              });
              if (failure === "thrown") throw error;
              this.emit("error", error);
              return false;
            }
            return original.call(this, signal);
          };
          try {
            await assert.rejects(
              repository.replacePendingFiles({
                expectedRevision: currentRevision,
                expectedFiles: [],
                files: [
                  {
                    path: "payload/large",
                    data: Buffer.alloc(8 * 1024 * 1024, 42),
                    kind: "regular"
                  }
                ],
                pathScope: "payload"
              })
            );
          } finally {
            ChildProcess.prototype.kill = original;
            if (oldPath === undefined) delete process.env.GIT_TEST_CLOSE_INPUT;
            else process.env.GIT_TEST_CLOSE_INPUT = oldPath;
          }
          assert.deepEqual(signals, [
            { signal: "SIGTERM", lock: true },
            { signal: "SIGKILL", lock: true }
          ]);
          const events = await traceEvents(trace);
          assert.equal(events[0]?.event, "start");
          assert.throws(() => process.kill(events[0]!.pid, 0), {
            code: "ESRCH"
          });
          await assert.rejects(fs.stat(lockPath), { code: "ENOENT" });
          assert.deepEqual(
            await repository.readPendingFiles({ pathScopes: ["payload"] }),
            []
          );
        });
      });
    }
  }
);

test(
  "failed Git process startup releases the lock without changing pending",
  { ...gitTestOptions, skip: process.platform === "win32" },
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      const indexPath = path.join(repositoryRoot, ".git", "index");
      const originalIndex = await fs.readFile(indexPath);
      await withGitWriteTrace(tempRoot, repositoryRoot, async () => {
        const previous = process.env.GIT_TEST_REMOVE_AFTER_LIST;
        process.env.GIT_TEST_REMOVE_AFTER_LIST = "1";
        process.env.PATH = path.join(tempRoot, "git-wrapper");
        try {
          await assert.rejects(
            repository.replacePendingFiles({
              expectedRevision: currentRevision,
              expectedFiles: [],
              files: [
                {
                  path: "payload/file",
                  data: Buffer.from("new"),
                  kind: "regular"
                }
              ],
              pathScope: "payload"
            })
          );
        } finally {
          if (previous === undefined)
            delete process.env.GIT_TEST_REMOVE_AFTER_LIST;
          else process.env.GIT_TEST_REMOVE_AFTER_LIST = previous;
        }
        await assert.rejects(fs.stat(indexPath + ".lock"), { code: "ENOENT" });
        assert.deepEqual(await fs.readFile(indexPath), originalIndex);
      });
    });
  }
);
