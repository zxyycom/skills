import assert from "node:assert/strict";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { runProcess } from "./fixtures/process.ts";
import { readFileDigest, readSubtitleReferences } from "../src/evidence.ts";
import { processOutput } from "../src/media-runtime.ts";
import { VideoFailure } from "../src/failure.ts";
import { complete, readyText } from "./fixtures/evidence-state.ts";
import { requestKey } from "../src/material.ts";
import { cli, workspace } from "./fixtures/public-cli.ts";
import { loadEvidence, publishEvidence } from "../src/store.ts";
const fixture = path.join(import.meta.dirname, "fixtures", "media-process.mjs");
test("process errors preserve diagnostics, timeout stops the child and marks interruption", async () =>
  workspace(async (directory) => {
    const run = (mode: string, diagnostic: string, timeout = 0) =>
      processOutput({
        command: { program: "node", args: [fixture, mode] },
        env: process.env,
        stage: "inspection",
        diagnostic: path.join(directory, diagnostic),
        timeout
      });
    const success = await run("success", "ok.log");
    assert.equal(success.trim(), '{"value":1}');
    assert.ok(
      !(await readFile(path.join(directory, "ok.log"), "utf8")).includes(
        '"value"'
      )
    );
    await assert.rejects(
      run("fail", "fail.log"),
      (error) => error instanceof Error && error.message.includes("exit=2")
    );
    assert.ok(
      (await readFile(path.join(directory, "fail.log"), "utf8")).includes(
        "fixture diagnostic"
      )
    );
    try {
      await run("wait", "timeout.log", 0.15);
      throw new Error("timeout did not interrupt");
    } catch (error) {
      assert.equal(
        error instanceof VideoFailure && error.failure.kind,
        "timeout"
      );
    }
  }));

test("cancellation stops the child and has a separate actionable failure", async () =>
  workspace(async (directory) => {
    const running = processOutput({
      command: { program: "node", args: [fixture, "wait"] },
      env: process.env,
      stage: "inspection",
      diagnostic: path.join(directory, "cancelled.log"),
      timeout: 0
    });
    const cancel = setTimeout(() => process.emit("SIGTERM", "SIGTERM"), 150);
    try {
      await assert.rejects(
        running,
        (error) =>
          error instanceof Error &&
          error.message.includes("cancelled at inspection")
      );
    } finally {
      clearTimeout(cancel);
    }
    assert.ok(
      (await readFile(path.join(directory, "cancelled.log"), "utf8")).includes(
        "process cancelled"
      )
    );
  }));

test("public failures name the owned stage and target without writing existing outputs", async () =>
  workspace(async (directory) => {
    const evidence = await complete(directory);
    const unknown = path.join(directory, "unknown");
    await mkdir(unknown);
    const statusFile = path.join(unknown, "keep.txt");
    await writeFile(statusFile, "do not replace");
    const frames = await runProcess(
      "node",
      [
        cli,
        "frames",
        "--input",
        evidence.source.file,
        "--output",
        unknown,
        "--times",
        "1"
      ],
      { reject: false }
    );
    assert.equal(frames.exitCode, 1);
    assert.equal(frames.stdout, "");
    assert.ok(frames.stderr.includes("input at output"));
    assert.ok(frames.stderr.includes(`target=${unknown}`));
    assert.equal(await readFile(statusFile, "utf8"), "do not replace");
    const subtitle = path.join(directory, "directory.srt");
    await mkdir(subtitle);
    const prepare = await runProcess(
      "node",
      [
        cli,
        "prepare",
        "--input",
        evidence.source.file,
        "--output",
        path.join(directory, "new"),
        "--subtitle",
        subtitle
      ],
      { reject: false }
    );
    assert.equal(prepare.exitCode, 1);
    assert.equal(prepare.stdout, "");
    assert.ok(prepare.stderr.includes("environment at input"));
    assert.ok(prepare.stderr.includes(`target=${subtitle}`));
    assert.equal(
      await readFile(evidence.source.file, "utf8"),
      "synthetic source"
    );
  }));

test("read resolves a local output junction and new output parents must exist locally", async () =>
  workspace(async (directory) => {
    const output = path.join(directory, "actual");
    await mkdir(output);
    const evidence = await complete(output);
    const junction = path.join(directory, "linked");
    await symlink(
      output,
      junction,
      process.platform === "win32" ? "junction" : "dir"
    );
    const read = await runProcess("node", [cli, "read", "--output", junction]);
    assert.ok(read.stdout.includes("原始文本"));
    const missing = path.join(directory, "missing", "new");
    const frames = await runProcess(
      "node",
      [
        cli,
        "frames",
        "--input",
        evidence.source.file,
        "--output",
        missing,
        "--times",
        "1"
      ],
      { reject: false }
    );
    assert.equal(frames.exitCode, 1);
    assert.ok(frames.stderr.includes("environment at output"));
    assert.ok(frames.stderr.includes(`target=${missing}`));
    await rm(junction);
    assert.equal(
      await readFile(evidence.source.file, "utf8"),
      "synthetic source"
    );
  }));

test("Unicode raw subtitle filenames remain valid for load/read/reuse without path traversal", async () =>
  workspace(async (directory) => {
    const evidence = await complete(directory);
    const subtitle = path.join(directory, "caption.字幕");
    await writeFile(subtitle, "原始字幕字节");
    await mkdir(path.join(directory, "artifacts", "unicode"));
    await writeFile(
      path.join(directory, "artifacts", "unicode", "source-0.字幕"),
      "原始字幕字节"
    );
    const material = readyText(evidence);
    material.inputs = await readSubtitleReferences([subtitle]);
    material.origin = "external";
    material.parameters = {};
    material.requestKey = requestKey(
      evidence.source,
      material.origin,
      material.parameters,
      material.inputs
    );
    readyText(evidence).files.push(
      await readFileDigest(directory, "artifacts/unicode/source-0.字幕")
    );
    await publishEvidence(directory, evidence);
    assert.ok(
      readyText(await loadEvidence(directory)).files.some((value) =>
        isDeepStrictEqual(value, readyText(evidence).files[0])
      )
    );
    const read = await runProcess("node", [cli, "read", "--output", directory]);
    assert.ok(read.stdout.includes("原始文本"));
    const reused = await runProcess("node", [
      cli,
      "prepare",
      "--input",
      evidence.source.file,
      "--output",
      directory,
      "--subtitle",
      subtitle,
      "--app-root",
      path.join(directory, "missing-runtime")
    ]);
    assert.ok(reused.stdout.includes('"reused": true'));
    for (const file of [
      "../escape",
      "raw/../escape",
      "raw\\escape",
      "D:/escape",
      "/escape",
      "raw/./escape",
      "raw/escape:stream"
    ]) {
      await writeFile(
        path.join(directory, "evidence.json"),
        JSON.stringify({
          ...evidence,
          materials: [
            {
              ...readyText(evidence),
              files: [{ file, sha256: readyText(evidence).files[0]?.sha256 }]
            }
          ]
        })
      );
      await assert.rejects(loadEvidence(directory));
    }
    assert.equal(await readFile(subtitle, "utf8"), "原始字幕字节");
  }));

test("diagnostics filter credentials across chunks; launch, output overflow and stderr overflow stay distinct", async () =>
  workspace(async (directory) => {
    const run = (mode: string) =>
      processOutput({
        command: { program: "node", args: [fixture, mode] },
        env: process.env,
        stage: "inspection",
        diagnostic: path.join(directory, `${mode}.log`),
        timeout: 0
      });
    assert.ok((await run("secrets")).includes('"value"'));
    const log = await readFile(path.join(directory, "secrets.log"), "utf8");
    for (const secret of [
      "first-value",
      "second-value",
      "json-value",
      "chunk-value",
      "key-value"
    ])
      assert.ok(!log.includes(secret));
    assert.ok(log.includes("safe diagnostic"));
    await assert.rejects(
      run("stdout-overflow"),
      (error) =>
        error instanceof Error &&
        error.message.includes("protocol at inspection")
    );
    assert.ok((await run("stderr-overflow")).includes('"value"'));
    assert.ok(
      (
        await readFile(path.join(directory, "stderr-overflow.log"), "utf8")
      ).includes("text withheld")
    );
    await assert.rejects(
      processOutput({
        command: { program: path.join(directory, "missing.exe"), args: [] },
        env: process.env,
        stage: "inspection",
        diagnostic: path.join(directory, "missing.log"),
        timeout: 0
      }),
      (error) =>
        error instanceof Error &&
        error.message.includes("environment at inspection")
    );
  }));
