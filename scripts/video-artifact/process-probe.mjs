import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";

if (process.argv[2] === "leaf") {
  await writeFile(process.argv[3], String(process.pid));
  setInterval(() => {}, 1000);
} else if (process.argv[2] === "tree") {
  const leaf = spawn(
    process.execPath,
    [import.meta.filename, "leaf", process.argv[3] + ".leaf"],
    { stdio: "inherit", windowsHide: true }
  );
  await writeFile(process.argv[3], String(process.pid));
  assert.ok(leaf.pid);
  setInterval(() => {}, 1000);
} else {
  const [installed, directory] = process.argv.slice(2);
  const { processOutput } = await import(
    pathToFileURL(
      path.join(
        installed,
        "scripts/runtime/tools/video-understanding/src/media-process.ts"
      )
    ).href
  );
  const waitPid = async (file) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const value = await readFile(file, "utf8");
        if (/^[1-9]\d*$/u.test(value)) return Number(value);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      await setTimeout(20);
    }
    throw new Error(`child did not publish PID: ${file}`);
  };
  const alive = (pid) => {
    assert.ok(
      Number.isSafeInteger(pid) && pid > 1,
      "fixture PID must identify one child process"
    );
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
      return false;
    }
  };
  for (const mode of ["timeout", "cancelled"]) {
    const marker = path.join(directory, `tree-${mode}.pid`);
    const diagnostic = path.join(directory, `tree-${mode}.log`);
    const running = processOutput({
      command: {
        program: process.execPath,
        args: [import.meta.filename, "tree", marker]
      },
      env: process.env,
      stage: "inspection",
      diagnostic,
      timeout: mode === "timeout" ? 2 : 15
    });
    const rejected = assert.rejects(running, (error) =>
      error.message.includes(`${mode} at inspection`)
    );
    const pids = [];
    try {
      pids.push(await waitPid(marker));
      pids.push(await waitPid(marker + ".leaf"));
      if (mode === "cancelled") process.emit("SIGTERM", "SIGTERM");
      await rejected;
      for (let attempt = 0; attempt < 100 && pids.some(alive); attempt++)
        await setTimeout(20);
      assert.equal(pids.some(alive), false, `${mode} left a live process`);
      assert.match(
        await readFile(diagnostic, "utf8"),
        new RegExp(`process ${mode}`)
      );
    } finally {
      for (const pid of pids) if (alive(pid)) process.kill(pid, "SIGKILL");
    }
  }
  console.log("timeout and cancellation trees stopped");
}
