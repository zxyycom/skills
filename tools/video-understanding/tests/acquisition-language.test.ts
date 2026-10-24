import { resources } from "./fixtures/public-cli.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseOptions } from "../src/arguments.ts";
import { execute, prepare } from "../src/video.ts";
import { loadEvidence, loadSnapshot, publishEvidence } from "../src/store.ts";
import { workspace } from "./fixtures/public-cli.ts";
import { prepared, fixtureRuntime } from "./fixtures/acquisition-runtime.ts";

test("ordinary and empty ASR retain exact timing without normalization warnings", async () =>
  workspace(async (directory) => {
    const input = path.join(directory, "source.mp4");
    const output = path.join(directory, "evidence");
    const appRoot = path.join(directory, "runtime");
    await writeFile(input, "fixture source");
    await mkdir(appRoot);
    const segments = [
      { start: 0, end: 1, text: "first" },
      { start: 3, end: 4, text: "at boundary" }
    ];
    const tools = fixtureRuntime({ segments });
    try {
      const options = prepared(input, output, appRoot, ["--source", "asr"]);
      assert.partialDeepStrictEqual(
        JSON.parse(await prepare(options, resources)),
        { status: "complete", warnings: [] }
      );
      assert.deepEqual(
        (await loadSnapshot(output)).transcripts,
        segments.map((cue, index) => ({ id: `T000${index + 1}`, ...cue }))
      );
      tools.transcribe([]);
      assert.partialDeepStrictEqual(
        JSON.parse(await prepare({ ...options, fresh: true }, resources)),
        { status: "empty", warnings: [] }
      );
    } finally {
      tools.runtime.mockRestore();
    }
  }));

test("missing audio fails explicit and auto ASR without coverage or recognizer invocation; saved source stays intact", async () =>
  workspace(async (directory) => {
    const input = path.join(directory, "silent-video.mp4");
    const output = path.join(directory, "evidence");
    const appRoot = path.join(directory, "runtime");
    await writeFile(input, "video-only fixture");
    await mkdir(appRoot);
    const tools = fixtureRuntime();
    tools.noAudio();
    try {
      for (const source of ["asr", "auto"]) {
        await assert.rejects(
          prepare(
            prepared(input, output, appRoot, [
              "--source",
              source,
              "--language",
              "zh"
            ]),
            resources
          ),
          (error) =>
            error instanceof Error &&
            error.message.includes("ASR requires an audio stream; found none")
        );
      }
      assert.equal(tools.asrCalls(), 0);
      const index = await loadEvidence(output);
      assert.equal(index.materials.length, 2);
      for (const material of index.materials)
        assert.partialDeepStrictEqual(material, {
          origin: "asr",
          status: "failed",
          language: "unknown",
          processedCoverage: [],
          failure: { kind: "input", stage: "audio-extraction" }
        });
      assert.equal(await readFile(input, "utf8"), "video-only fixture");
    } finally {
      tools.runtime.mockRestore();
    }
  }));

test("ASR exposes actual language and request mode without forcing unknown audio or reusing false legacy empty", async () =>
  workspace(async (directory) => {
    const input = path.join(directory, "dubbed.mp4");
    const output = path.join(directory, "evidence");
    const appRoot = path.join(directory, "runtime");
    await writeFile(input, "fixture source");
    await mkdir(appRoot);
    const tools = fixtureRuntime();
    tools.empty();
    try {
      const options = prepared(input, output, appRoot, ["--source", "asr"]);
      assert.partialDeepStrictEqual(
        JSON.parse(await prepare(options, resources)),
        { status: "empty", language: "en", languageMode: "detected" }
      );
      assert.equal(tools.asrRequests[0]?.language, undefined);
      const index = await loadEvidence(output);
      const first = index.materials[0]!;
      assert.partialDeepStrictEqual(first, {
        language: "en",
        parameters: { language: "unknown" },
        processedCoverage: [{ start: 0, end: 4 }]
      });
      // Model-free ASR empty mirrors the known historical false success; do not mutate or migrate it on reuse.
      if (first.status !== "empty") throw new Error("expected empty");
      first.provenance = {
        tool: "PyAV",
        version: "fixture",
        profile: "subtitle-conversion",
        models: []
      };
      await publishEvidence(output, index);
      const original = JSON.stringify(first);
      assert.partialDeepStrictEqual(
        JSON.parse(await prepare(options, resources)),
        { material: "M0002", reused: false }
      );
      assert.equal(
        JSON.stringify((await loadEvidence(output)).materials[0]),
        original
      );
      assert.partialDeepStrictEqual(
        JSON.parse(await prepare(options, resources)),
        { material: "M0002", reused: true }
      );
      const forced = prepared(input, output, appRoot, [
        "--source",
        "asr",
        "--language",
        "zh"
      ]);
      assert.partialDeepStrictEqual(
        JSON.parse(await prepare(forced, resources)),
        { language: "en", languageMode: "forced" }
      );
      assert.equal(tools.asrRequests.at(-1)?.language, "zh");
      const read = parseOptions([
        "read",
        "--output",
        output,
        "--id",
        "M0003",
        "--format",
        "json"
      ]);
      if (read?.command !== "read") throw new Error("expected read");
      assert.partialDeepStrictEqual(
        JSON.parse(await execute(read, resources)).items[0].detail,
        {
          language: "en",
          languageMode: "forced",
          parameters: { language: "zh" }
        }
      );
    } finally {
      tools.runtime.mockRestore();
    }
  }));

test("public read does not promote a model-free historical empty language request into a recognizer result", async () =>
  workspace(async (directory) => {
    const input = path.join(directory, "video.mp4");
    const output = path.join(directory, "evidence");
    const appRoot = path.join(directory, "runtime");
    await writeFile(input, "fixture source");
    await mkdir(appRoot);
    const tools = fixtureRuntime();
    tools.empty();
    try {
      await prepare(
        prepared(input, output, appRoot, [
          "--source",
          "asr",
          "--language",
          "zh"
        ]),
        resources
      );
      const index = await loadEvidence(output);
      const material = index.materials[0]!;
      if (material.status !== "empty") throw new Error("expected empty");
      material.language = "zh";
      material.provenance = {
        tool: "PyAV",
        version: "fixture",
        profile: "subtitle-conversion",
        models: []
      };
      await publishEvidence(output, index);
      const manifest = path.join(output, "evidence.json");
      const before = await readFile(manifest);
      const options = parseOptions([
        "read",
        "--output",
        output,
        "--id",
        "M0001",
        "--format",
        "json"
      ]);
      if (options?.command !== "read") throw new Error("expected read");
      assert.partialDeepStrictEqual(
        JSON.parse(await execute(options, resources)).items[0].detail,
        {
          language: "zh",
          languageMode: "unknown",
          parameters: { language: "zh" }
        }
      );
      assert.deepEqual(await readFile(manifest), before);
    } finally {
      tools.runtime.mockRestore();
    }
  }));
