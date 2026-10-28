import assert from "node:assert/strict";
import { ChildProcess, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export async function withGitWriteTrace(
  root: string,
  repositoryRoot: string,
  run: (tracePath: string) => Promise<void>
): Promise<void> {
  const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
  const bin = path.join(root, "git-wrapper");
  const trace = path.join(root, "git-writes.jsonl");
  await fs.mkdir(bin);
  const wrapper = `#!${process.execPath}
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const args = process.argv.slice(2);
if (!args.includes("hash-object")) {
  const result = spawnSync(${JSON.stringify(realGit)}, args, { stdio: "inherit" });
  if (process.env.GIT_TEST_REMOVE_AFTER_LIST === "1" && args.includes("ls-files")) fs.unlinkSync(process.argv[1]);
  process.exit(result.status ?? 1);
}
const record = (event) => fs.appendFileSync(${JSON.stringify(trace)}, JSON.stringify({ event, pid: process.pid, lock: fs.existsSync(${JSON.stringify(path.join(repositoryRoot, ".git", "index.lock"))}) }) + "\\n");
record("start");
if (process.env.GIT_TEST_CLOSE_INPUT === "1") {
  process.on("SIGTERM", () => record("term"));
  fs.closeSync(0);
  setTimeout(() => { record("natural-end"); process.exit(1); }, 5000);
} else {
const input = fs.readFileSync(0);
const fail = input.toString() === "FAIL";
const deadline = Date.now() + 10000;
function dispatch() {
  const gate = process.env.GIT_TEST_WRITE_GATE;
  if (gate && !fs.existsSync(gate)) {
    const starts = fs.readFileSync(${JSON.stringify(trace)}, "utf8").trim().split("\\n").length;
    if (fail && starts >= 2) {
      fs.writeFileSync(process.env.GIT_TEST_FAILURE_MARKER, String(process.pid));
      record("end");
      process.stderr.write("injected object failure");
      process.exit(1);
    }
    if (Date.now() >= deadline) { record("end"); process.exit(2); }
    setTimeout(dispatch, 10);
    return;
  }
  if (fail) { record("end"); process.stderr.write("injected object failure"); process.exit(1); }
  const result = spawnSync(${JSON.stringify(realGit)}, args, { input });
  record("end");
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  process.exit(result.status ?? 1);
}
dispatch();
}
`;
  const executable = path.join(bin, "git");
  await fs.writeFile(executable, wrapper, { mode: 0o755 });
  const previous = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${previous ?? ""}`;
  const children = new Map<
    ChildProcess,
    { closed: boolean; settled: Promise<void> }
  >();
  const originalEmit = Reflect.get(
    ChildProcess.prototype,
    "emit"
  ) as typeof ChildProcess.prototype.emit;
  ChildProcess.prototype.emit = function (
    this: ChildProcess,
    event: string | symbol,
    ...args: unknown[]
  ): boolean {
    if (
      event === "spawn" &&
      this.spawnargs[1] === "-C" &&
      this.spawnargs[2] === repositoryRoot &&
      this.spawnargs[3] === "hash-object"
    ) {
      const state = { closed: false, settled: Promise.resolve() };
      state.settled = new Promise((resolve) =>
        this.once("close", () => {
          state.closed = true;
          resolve();
        })
      );
      children.set(this, state);
    }
    return Reflect.apply(originalEmit, this, [event, ...args]);
  } as typeof ChildProcess.prototype.emit;
  let failure: unknown;
  let hasFailure = false;
  try {
    await run(trace);
  } catch (error) {
    failure = error;
    hasFailure = true;
  } finally {
    ChildProcess.prototype.emit = originalEmit;
    // Let any failure-close gate callback finish before deleting the fixture.
    await new Promise<void>((resolve) => setImmediate(resolve));
    try {
      for (const [child, state] of children) {
        try {
          if (!state.closed) child.kill("SIGKILL");
        } catch (error) {
          if (!hasFailure) {
            failure = error;
            hasFailure = true;
          }
        }
      }
      await Promise.all([...children.values()].map(({ settled }) => settled));
      await new Promise<void>((resolve) => setImmediate(resolve));
    } catch (error) {
      if (!hasFailure) {
        failure = error;
        hasFailure = true;
      }
    }
    if (previous === undefined) delete process.env.PATH;
    else process.env.PATH = previous;
  }
  if (hasFailure) throw failure;
}

type TraceEvent = Readonly<{
  event: "start" | "end" | "term" | "natural-end";
  lock: boolean;
  pid: number;
}>;

function parseTraceEvent(line: string): TraceEvent {
  const value: unknown = JSON.parse(line);
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("event" in value) ||
    !("pid" in value) ||
    !("lock" in value) ||
    (value.event !== "start" &&
      value.event !== "end" &&
      value.event !== "term" &&
      value.event !== "natural-end") ||
    typeof value.pid !== "number" ||
    !Number.isSafeInteger(value.pid) ||
    value.pid <= 0 ||
    typeof value.lock !== "boolean"
  )
    throw new Error("Invalid Git write trace event");
  return { event: value.event, lock: value.lock, pid: value.pid };
}

export async function traceEvents(tracePath: string): Promise<TraceEvent[]> {
  const text = await fs.readFile(tracePath, "utf8");
  return text.trim().split("\n").map(parseTraceEvent);
}

export async function waitForStarts(
  tracePath: string,
  count: number
): Promise<void> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      if (
        (await traceEvents(tracePath)).filter(
          (event) => event.event === "start"
        ).length >= count
      )
        return;
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Git write workers did not reach the start barrier");
}

export function peakAndSettlement(
  events: Awaited<ReturnType<typeof traceEvents>>
) {
  const active = new Set<number>();
  let peak = 0;
  for (const event of events) {
    if (event.event === "start") active.add(event.pid);
    else assert.equal(active.delete(event.pid), true);
    peak = Math.max(peak, active.size);
  }
  assert.equal(active.size, 0);
  return peak;
}
