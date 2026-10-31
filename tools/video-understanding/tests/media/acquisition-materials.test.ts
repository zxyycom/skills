/// <reference types="bun" />
import { resources } from "../fixtures/public-cli.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { spyOn } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as ocrRuntime from "../../src/media/ocr-runtime.ts";
import { parseOptions } from "../../src/cli/arguments.ts";
import { readFileDigest } from "../../src/evidence/evidence.ts";
import { execute, prepare } from "../../src/video.ts";
import {
  loadEvidence,
  loadSnapshot,
  publishEvidence
} from "../../src/store/store.ts";
import { workspace } from "../fixtures/public-cli.ts";
import {
  provenance,
  prepared,
  fixtureRuntime
} from "../fixtures/acquisition-runtime.ts";

test("external then explicit ASR append independent immutable materials; fresh failures and true empty keep reusable history", async () =>
  workspace(async (directory) => {
    const input = path.join(directory, "source.mp4");
    const subtitle = path.join(directory, "chosen.srt");
    const output = path.join(directory, "evidence");
    const appRoot = path.join(directory, "runtime");
    await writeFile(input, "fixture source");
    await writeFile(subtitle, "external source");
    await mkdir(appRoot);
    const tools = fixtureRuntime();
    try {
      const external = JSON.parse(
        await prepare(
          prepared(input, output, appRoot, [
            "--source",
            "external",
            "--subtitle",
            subtitle
          ]),
          resources
        )
      );
      assert.partialDeepStrictEqual(external, {
        material: "M0001",
        origin: "external",
        cueCount: 1
      });
      assert.equal(tools.asrCalls(), 0);
      const first = await loadEvidence(output);
      const originalMaterial = first.materials[0];
      assert.ok(originalMaterial?.status === "complete");
      const originalPath = path.join(output, originalMaterial.payload.file);
      const original = await readFile(originalPath);
      const asr = prepared(input, output, appRoot, ["--source", "asr"]);
      assert.partialDeepStrictEqual(JSON.parse(await prepare(asr, resources)), {
        material: "M0002",
        origin: "asr",
        reused: false
      });
      assert.equal(tools.asrCalls(), 1);
      assert.deepEqual(
        (await loadSnapshot(output)).transcripts.map((c) => c.id),
        ["T0001", "T0002"]
      );
      assert.partialDeepStrictEqual(JSON.parse(await prepare(asr, resources)), {
        material: "M0002",
        reused: true
      });
      assert.equal(tools.starts(), 2);
      tools.empty();
      assert.partialDeepStrictEqual(
        JSON.parse(await prepare({ ...asr, fresh: true }, resources)),
        { material: "M0003", status: "empty" }
      );
      assert.partialDeepStrictEqual(JSON.parse(await prepare(asr, resources)), {
        material: "M0003",
        status: "empty",
        reused: true
      });
      tools.fail();
      await assert.rejects(
        prepare({ ...asr, fresh: true }, resources),
        (error) => error instanceof Error && error.message.includes("timeout")
      );
      const index = await loadEvidence(output);
      assert.deepEqual(
        index.materials.map((m) => m.status),
        ["complete", "complete", "empty", "interrupted"]
      );
      assert.partialDeepStrictEqual(JSON.parse(await prepare(asr, resources)), {
        material: "M0003",
        reused: true
      });
      assert.deepEqual(await readFile(originalPath), original);
    } finally {
      tools.runtime.mockRestore();
    }
  }));

test("auto records each empty candidate, reuses terminal ASR and stops on actual decoding errors", async () =>
  workspace(async (directory) => {
    const input = path.join(directory, "source.mp4");
    const output = path.join(directory, "evidence");
    const appRoot = path.join(directory, "runtime");
    await writeFile(input, "fixture source");
    await mkdir(appRoot);
    const srt = path.join(directory, "source.srt");
    const vtt = path.join(directory, "source.vtt");
    await writeFile(srt, "");
    await writeFile(vtt, "");
    const tools = fixtureRuntime();
    try {
      const options = prepared(input, output, appRoot);
      assert.partialDeepStrictEqual(
        JSON.parse(await prepare(options, resources)),
        { material: "M0003", origin: "asr" }
      );
      assert.deepEqual(
        (await loadEvidence(output)).materials.map((m) => [m.origin, m.status]),
        [
          ["external", "empty"],
          ["external", "empty"],
          ["asr", "complete"]
        ]
      );
      assert.partialDeepStrictEqual(
        JSON.parse(await prepare(options, resources)),
        { reused: true }
      );
      assert.equal(tools.starts(), 1);
      await writeFile(srt, "corrupt fixture");
      await assert.rejects(
        prepare(options, resources),
        (error) =>
          error instanceof Error && error.message.includes("corrupt fixture")
      );
      assert.equal(tools.asrCalls(), 1);
      assert.partialDeepStrictEqual(
        (await loadEvidence(output)).materials.at(-1),
        { origin: "external", status: "failed" }
      );
      assert.equal(
        (await loadSnapshot(output)).transcripts[0]?.text,
        "ASR source"
      );
    } finally {
      tools.runtime.mockRestore();
    }
  }));

test("public hard-ocr and frame OCR register original pixels/PTS without conflating observations and descriptions", async () =>
  workspace(async (directory) => {
    const input = path.join(directory, "source.mp4");
    const output = path.join(directory, "evidence");
    const appRoot = path.join(directory, "runtime");
    await writeFile(input, "fixture source");
    await mkdir(appRoot);
    const tools = fixtureRuntime();
    const hard = spyOn(ocrRuntime, "hardOcr").mockImplementation(
      async ({ output: operation }) => {
        const file = path.join(operation, "output.srt");
        await writeFile(file, "hard subtitle");
        return {
          file,
          provenance: { ...provenance, tool: "videocr" as const }
        };
      }
    );
    const ocr = spyOn(ocrRuntime, "frameOcr").mockResolvedValue({
      width: 100,
      height: 40,
      region: { x: 0, y: 0, width: 100, height: 40 },
      transform: { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
      boxes: [],
      texts: [],
      scores: [],
      provenance
    });
    try {
      const options = prepared(input, output, appRoot, [
        "--source",
        "hard-ocr",
        "--region",
        "0,20,100,20"
      ]);
      assert.partialDeepStrictEqual(
        JSON.parse(await prepare(options, resources)),
        { material: "M0001", origin: "hard-ocr" }
      );
      assert.equal(hard.mock.calls.length, 1);
      assert.partialDeepStrictEqual(
        JSON.parse(await prepare(options, resources)),
        { reused: true }
      );
      assert.equal(hard.mock.calls.length, 1);
      tools.rotate();
      await assert.rejects(
        prepare({ ...options, fresh: true }, resources),
        (error) =>
          error instanceof Error && error.message.includes("zero rotation")
      );
      assert.equal(hard.mock.calls.length, 1);
      const index = await loadEvidence(output);
      await writeFile(
        path.join(output, "artifacts", "frame.png"),
        "PNG fixture"
      );
      index.frames.entries.push({
        id: "F0001",
        requested: 1.03,
        actual: 1.1,
        pts: 11,
        timeBase: "1/10",
        streamIndex: 0,
        width: 100,
        image: await readFileDigest(output, "artifacts/frame.png")
      });
      await publishEvidence(output, index);
      const frameOptions = parseOptions([
        "ocr",
        "--output",
        output,
        "--app-root",
        appRoot,
        "--frames",
        "F0001",
        "--format",
        "json"
      ]);
      if (frameOptions?.command !== "ocr") throw new Error("expected ocr");
      assert.partialDeepStrictEqual(
        JSON.parse(await execute(frameOptions, resources)),
        { material: "M0003", status: "empty", observationCount: 1 }
      );
      const snapshot = await loadSnapshot(output);
      assert.partialDeepStrictEqual(snapshot.observations[0], {
        id: "O0001",
        text: "",
        frame: "F0001"
      });
      assert.deepEqual(snapshot.index.materials.at(-1)?.processedCoverage, [
        { start: 1.1, end: 1.1 }
      ]);
      assert.deepEqual(snapshot.index.refinements, []);
      assert.partialDeepStrictEqual(
        JSON.parse(await execute(frameOptions, resources)),
        { reused: true }
      );
      assert.equal(ocr.mock.calls.length, 1);
    } finally {
      tools.runtime.mockRestore();
      hard.mockRestore();
      ocr.mockRestore();
    }
  }));
