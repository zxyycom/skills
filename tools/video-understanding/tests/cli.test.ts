import { resources } from "./fixtures/public-cli.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { runProcess } from "./fixtures/process.ts";
import { readFileDigest, readSubtitleReferences } from "../src/evidence.ts";
import { prepare } from "../src/video.ts";
import { parseOptions } from "../src/arguments.ts";
import { complete, readyText } from "./fixtures/evidence-state.ts";
import { cli, root, workspace } from "./fixtures/public-cli.ts";
import { loadEvidence, publishEvidence, loadSnapshot } from "../src/store.ts";
test("public read works independently of cwd, and repeated prepare does not start a runtime", async () =>
  workspace(async (directory) => {
    const evidence = await complete(directory);
    const read = await runProcess(
      "node",
      [cli, "read", "--output", directory],
      { cwd: path.dirname(root) }
    );
    assert.ok(read.stdout.includes('T0001 [0,2.125] "原始文本"'));
    const options = parseOptions([
      "prepare",
      "--input",
      evidence.source.file,
      "--output",
      directory,
      "--app-root",
      path.join(directory, "missing-runtime")
    ]);
    if (options?.command !== "prepare") throw new Error("expected prepare");
    assert.partialDeepStrictEqual(
      JSON.parse(await prepare({ ...options, format: "json" }, resources)),
      { reused: true, status: "complete" }
    );
    assert.equal(
      await readFile(evidence.source.file, "utf8"),
      "synthetic source"
    );
  }));

test("public text read preserves Unicode and escapes transcript control characters on stdout", async () =>
  workspace(async (directory) => {
    const evidence = await complete(directory);
    const material = readyText(evidence);
    const texts = [
      " 原始文本 ",
      'line one\nselection=forged\r\ttab\u001b[31m"quoted"\\path\u0000'
    ];
    const cues = material.cues.map((cue, index) => ({
      ...cue,
      text: texts[index]
    }));
    await writeFile(
      path.join(directory, material.payload.file),
      JSON.stringify(cues)
    );
    material.payload = await readFileDigest(directory, material.payload.file);
    await publishEvidence(directory, evidence);
    const { stdout, stderr } = await runProcess("node", [
      cli,
      "read",
      "--output",
      directory
    ]);
    assert.equal(stderr, "");
    for (const cue of cues) {
      assert.ok(
        stdout.includes(
          `${cue.id} [${cue.start},${cue.end}] ${JSON.stringify(cue.text)}`
        )
      );
    }
    assert.ok(!stdout.includes("\nselection=forged"));
    assert.ok(!stdout.includes("\u001b"));
  }));

test("changed media/options and missing/damaged result files cannot authorize reuse", async () =>
  workspace(async (directory) => {
    const evidence = await complete(directory);
    const options = parseOptions([
      "prepare",
      "--input",
      evidence.source.file,
      "--output",
      directory,
      "--language",
      "zh"
    ]);
    if (options?.command !== "prepare") throw new Error("expected prepare");
    await assert.rejects(
      prepare(options, resources),
      (error) => error instanceof Error && error.message.includes("runtime")
    );
    await writeFile(
      path.join(directory, readyText(evidence).payload.file),
      "[]"
    );
    assert.equal(
      (await loadSnapshot(directory, evidence)).unavailable.has("M0001"),
      true
    );
    await rm(path.join(directory, readyText(evidence).payload.file));
    assert.equal(
      (await loadSnapshot(directory, evidence)).unavailable.has("M0001"),
      true
    );
    await writeFile(evidence.source.file, "changed source");
    await assert.rejects(
      loadSnapshot(directory, evidence),
      (error) => error instanceof Error && error.message.includes("stale")
    );
  }));

test("unknown output is not overwritten", async () =>
  workspace(async (directory) => {
    const evidence = await complete(directory);
    await rm(path.join(directory, "evidence.json"));
    const options = parseOptions([
      "prepare",
      "--input",
      evidence.source.file,
      "--output",
      directory
    ]);
    if (options?.command !== "prepare") throw new Error("expected prepare");
    await assert.rejects(
      prepare(options, resources),
      (error) =>
        error instanceof Error && error.message.includes("unknown directory")
    );
    assert.equal(
      await readFile(evidence.source.file, "utf8"),
      "synthetic source"
    );
  }));

test("changed/deleted adopted subtitle inputs invalidate only their material; unrelated sidecars do not", async () =>
  workspace(async (directory) => {
    const evidence = await complete(directory);
    const subtitle = path.join(directory, "source.srt");
    await writeFile(subtitle, "original input subtitle");
    assert.equal(
      (await loadSnapshot(directory, evidence)).transcripts.length,
      2
    );
    readyText(evidence).inputs = await readSubtitleReferences([subtitle]);
    await publishEvidence(directory, evidence);
    assert.equal(
      (await loadSnapshot(directory, evidence)).transcripts.length,
      2
    );
    await writeFile(subtitle, "corrected input subtitle");
    const read = await runProcess(
      "node",
      [cli, "read", "--output", directory],
      { reject: false }
    );
    assert.equal(read.exitCode, 0);
    assert.equal(
      (await loadSnapshot(directory, evidence)).unavailable.has("M0001"),
      true
    );
    await rm(subtitle);
    assert.equal(
      (await loadSnapshot(directory, evidence)).unavailable.has("M0001"),
      true
    );
  }));

test("explicit subtitle and embedded selection do not rediscover unrelated sibling subtitles", async () =>
  workspace(async (directory) => {
    const evidence = await complete(directory);
    const explicit = path.join(directory, "chosen.vtt");
    await writeFile(explicit, "explicit subtitle");
    readyText(evidence).inputs = await readSubtitleReferences([explicit]);
    await writeFile(path.join(directory, "source.srt"), "unrelated sibling");
    assert.equal(
      (await loadSnapshot(directory, evidence)).transcripts.length,
      2
    );
    await rm(explicit);
    assert.equal(
      (await loadSnapshot(directory, evidence)).unavailable.has("M0001"),
      true
    );
    readyText(evidence).inputs = [];
    assert.equal(
      (await loadSnapshot(directory, evidence)).transcripts.length,
      2
    );
  }));

test("manifest validates the entire request once and rejects legacy/invalid states", async () =>
  workspace(async (directory) => {
    const evidence = await complete(directory);
    assert.deepEqual(
      readyText(await loadEvidence(directory)).parameters,
      readyText(evidence).parameters
    );
    for (const invalid of [
      { ...evidence, version: 2 },
      {
        ...evidence,
        materials: [{ ...readyText(evidence), requestKey: "bad" }]
      },
      {
        ...evidence,
        materials: [{ ...readyText(evidence), status: "running" }]
      },
      {
        ...evidence,
        materials: [
          {
            ...readyText(evidence),
            cues: [{ id: "wrong", start: 0, end: 1 }]
          }
        ]
      }
    ]) {
      await writeFile(
        path.join(directory, "evidence.json"),
        JSON.stringify(invalid)
      );
      await assert.rejects(loadEvidence(directory));
    }
    await writeFile(
      path.join(directory, "evidence.json"),
      '{invalid "password": "fixture-secret"'
    );
    const read = await runProcess(
      "node",
      [cli, "read", "--output", directory],
      { reject: false }
    );
    assert.equal(read.exitCode, 1);
    assert.ok(read.stderr.includes("protocol at manifest"));
    assert.ok(!read.stderr.includes("fixture-secret"));
    assert.equal(read.stdout, "");
  }));
