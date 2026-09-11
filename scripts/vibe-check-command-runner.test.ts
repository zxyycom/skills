import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runGateCommand } from "./lib/vibe-gate.ts";
import {
  waitForFile,
  withTemporaryDirectory
} from "./vibe-check-test-support.ts";

test("package script runner waits for a cancelled child to close", async () => {
  await withTemporaryDirectory("skills-vibe-cancel-", async (directory) => {
    const marker = path.join(directory, "child-state.txt");
    const scriptPath = path.join(directory, "wait-for-cancellation.ts");
    await fs.writeFile(
      scriptPath,
      [
        'import { writeFileSync } from "node:fs";',
        `const marker = ${JSON.stringify(marker)};`,
        'writeFileSync(marker, "started\\n");',
        'process.on("SIGTERM", () => {',
        "  setTimeout(() => {",
        '    writeFileSync(marker, "terminated\\n");',
        "    process.exit(0);",
        "  }, 150);",
        "});",
        "setInterval(() => {}, 1_000);",
        ""
      ].join("\n"),
      "utf8"
    );

    const controller = new AbortController();
    const running = runGateCommand({
      args: ["run", scriptPath],
      command: "bun",
      cwd: directory,
      signal: controller.signal
    });
    await waitForFile(marker);
    controller.abort();

    assert.deepEqual(await running, {
      output: "",
      reason: "gate-command-cancelled",
      status: "unavailable"
    });
    assert.equal(await fs.readFile(marker, "utf8"), "terminated\n");
  });
});

test("command runner keeps a bounded diagnostic tail and writes the complete Check transcript", async () => {
  await withTemporaryDirectory("skills-vibe-transcript-", async (directory) => {
    const artifactDirectory = path.join(directory, "checks", "fixture");
    const result = await runGateCommand({
      args: [
        "-e",
        `process.stdout.write("start:" + "x".repeat(5000) + ":end\\n"); process.stderr.write("stderr-detail\\n")`
      ],
      artifactDirectory,
      command: "node",
      cwd: directory,
      signal: new AbortController().signal
    });

    assert.equal(result.status, "completed");
    assert.equal(result.output.startsWith("…"), true);
    assert.match(result.output, /:end\nstderr-detail\n$/u);
    assert.equal(result.transcript, "checks/fixture/process.log");
    const transcript = await fs.readFile(
      path.join(artifactDirectory, "process.log"),
      "utf8"
    );
    assert.match(transcript, /start:x{5000}:end/u);
    assert.match(transcript, /--- stderr ---\nstderr-detail/u);
    assert.match(transcript, /status: exited 0/u);

    assert.deepEqual(
      await runGateCommand({
        args: ["-e", 'process.stdout.write("must-not-run")'],
        artifactDirectory,
        command: "node",
        cwd: directory,
        signal: new AbortController().signal
      }),
      {
        output: "",
        reason: "gate-command-transcript-unavailable",
        status: "unavailable"
      }
    );
  });
});
