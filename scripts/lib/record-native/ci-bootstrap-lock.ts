import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { command } from "./ci-bootstrap-process.ts";

/** Require an OS access error against the locked file, not merely an arbitrary updater failure. */
export function isLockedFileFailure(error: unknown, binary: string): boolean {
  const wanted = path.win32.resolve(binary).toLowerCase();
  const visited = new Set<object>();
  let current: unknown = error;
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    if (
      "code" in current &&
      ["EPERM", "EACCES", "EBUSY"].includes(String(current.code))
    ) {
      const paths = [
        "path" in current ? current.path : null,
        "dest" in current ? current.dest : null
      ];
      for (const candidate of paths) {
        if (
          typeof candidate === "string" &&
          path.win32.resolve(candidate).toLowerCase() === wanted
        )
          return true;
      }
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

/** Hold this CI-owned executable open without write/delete sharing until action finishes. */
export async function withReadOnlyWindowsLock(
  binary: string,
  action: () => Promise<void>
): Promise<void> {
  if (process.platform !== "win32")
    throw new Error("Windows lock fixture requires Windows");
  const script = `
$handle = $null
try {
  $handle = [System.IO.File]::Open($env:RECORD_CI_LOCK_FILE, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
  [Console]::Out.WriteLine('READY')
  [Console]::Out.Flush()
  [Console]::In.ReadLine() | Out-Null
} finally {
  if ($null -ne $handle) { $handle.Dispose() }
}`;
  const child = spawn(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
    {
      env: { ...process.env, RECORD_CI_LOCK_FILE: binary },
      stdio: ["pipe", "pipe", "pipe"]
    }
  );
  let diagnostics = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (text: string) => {
    diagnostics += text;
  });
  let launchError: Error | undefined;
  child.on("error", (error) => {
    launchError = error;
  });
  child.stdin.on("error", (error) => {
    launchError ??= error;
  });
  const closed = new Promise<number | null>((resolve) =>
    child.once("close", resolve)
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  let status: number | null = null;
  try {
    const ready = new Promise<void>((resolve) => {
      let output = "";
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        output += chunk;
        if (output.split(/\r?\n/).includes("READY")) resolve();
      });
    });
    await Promise.race([
      ready,
      closed.then(() => {
        throw new Error(
          `lock fixture exited before READY: ${launchError?.message ?? diagnostics}`
        );
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("lock fixture READY timeout")),
          15_000
        );
      })
    ]);
    if (timer) clearTimeout(timer);
    await action();
  } finally {
    if (timer) clearTimeout(timer);
    if (!child.stdin.destroyed) child.stdin.end("\n");
    const timeout = setTimeout(() => child.kill(), 15_000);
    status = await closed;
    clearTimeout(timeout);
  }
  if (status !== 0)
    throw new Error(
      `lock fixture did not release cleanly: ${launchError?.message ?? diagnostics}`
    );
}

/** Exercise the real updater against an OS-locked, already installed A executable. */
export async function verifyWindowsLockedUpgrade(input: {
  binary: string;
  destination: string;
  updater: { run(args: string[]): Promise<number> };
}): Promise<void> {
  const { binary, destination, updater } = input;
  const installed = await fs.readFile(binary);
  const parent = path.dirname(destination);
  const priorNames = (await fs.readdir(parent)).sort();
  await withReadOnlyWindowsLock(binary, async () => {
    await assert.rejects(
      async () => {
        const handle = await fs.open(binary, "r+");
        await handle.close();
      },
      (error: unknown) => isLockedFileFailure(error, binary)
    );
    await assert.rejects(updater.run(["--yes"]), (error: unknown) => {
      assert.ok(
        isLockedFileFailure(error, binary),
        "updater failed without an OS sharing error on the locked executable"
      );
      console.log("Observed Windows updater sharing failure:", error);
      return true;
    });
    assert.deepEqual(await fs.readFile(binary), installed);
    assert.deepEqual((await fs.readdir(parent)).sort(), priorNames);
    assert.equal(
      await fs.readFile(path.join(destination, "sentinel.txt"), "utf8"),
      "keep"
    );
  });
  assert.equal(
    command(binary, ["--version"], destination).toString().trim(),
    "decision-records 0.1.0"
  );
  assert.equal(await updater.run(["--check"]), 1);
  console.log(
    "PASS Windows OS sharing violation: installed A restored, lock released; B upgrade continues"
  );
}
