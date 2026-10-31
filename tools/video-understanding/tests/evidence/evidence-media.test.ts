/// <reference types="bun" />
import { resources } from "../fixtures/public-cli.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { spyOn } from "bun:test";
import * as childProcess from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";
import { parseSegments } from "../../src/evidence/evidence.ts";
import {
  parseMediaInfo,
  runtime,
  type AsrRequest
} from "../../src/media/media-runtime.ts";
import { workspace } from "../fixtures/public-cli.ts";

test("preserves full timing and raw text while sorting cues; rejects invented ends", () => {
  assert.deepEqual(
    parseSegments([
      { start: 2, end: 3.125, text: " raw\ntext " },
      { start: 0, end: 4, text: "overlap" }
    ]),
    [
      { start: 0, end: 4, text: "overlap" },
      { start: 2, end: 3.125, text: " raw\ntext " }
    ]
  );
  for (const value of [
    null,
    [{ start: 0, text: "missing end" }],
    [{ start: 2, end: 1, text: "bad" }],
    [{ start: NaN, end: 1, text: "bad" }],
    [{ start: -0.01, end: 1, text: "bad" }],
    [{ start: 0, end: -0.01, text: "bad" }],
    [{ start: 0, end: NaN, text: "bad" }],
    [{ start: 0, end: Infinity, text: "bad" }]
  ]) {
    assert.throws(() => parseSegments(value));
  }
});

test("unknown/nonzero media clocks are explicit unsupported states", () => {
  const value = {
    duration: 10,
    start: 0,
    streams: [{ index: 0, type: "audio", codec: "aac", start: 0 }]
  };
  assert.equal(parseMediaInfo(value).duration, 10);
  assert.throws(
    () => parseMediaInfo({ ...value, start: 0.02 }),
    (error) =>
      error instanceof Error &&
      error.message.includes("container.start=0.02; required 0 seconds")
  );
  assert.throws(
    () => parseMediaInfo({ ...value, duration: null }),
    (error) =>
      error instanceof Error &&
      error.message.includes(
        "duration=null; required known duration > 0 seconds"
      )
  );
  for (const duration of [0, -1]) {
    assert.throws(
      () => parseMediaInfo({ ...value, duration }),
      (error) =>
        error instanceof Error &&
        error.message.includes(
          `input at inspection: unsupported media timeline: duration=${duration}`
        )
    );
  }
  assert.throws(
    () => parseMediaInfo({ ...value, duration: "10" }),
    (error) =>
      error instanceof Error &&
      error.message.includes("protocol at inspection: invalid duration")
  );
  assert.throws(
    () =>
      parseMediaInfo({
        ...value,
        streams: [{ ...value.streams[0], index: 3, start: 0.25 }]
      }),
    (error) =>
      error instanceof Error &&
      error.message.includes(
        "streams[index=3,type=audio].start=0.25; required 0 seconds"
      )
  );
  assert.throws(
    () =>
      parseMediaInfo({
        ...value,
        start: null,
        streams: [{ ...value.streams[0], start: null }]
      }),
    (error) =>
      error instanceof Error &&
      error.message.includes(
        "container.start=null; required 0 seconds; streams[index=0,type=audio].start=null; required 0 seconds"
      )
  );
  assert.equal(
    parseMediaInfo({
      ...value,
      streams: [{ index: 0, type: "video", codec: "h264", start: 0 }]
    }).streams.length,
    1
  );
});

test("ASR runtime owns native arguments and validates actual result language/segments before returning success", async () =>
  workspace(async (directory) => {
    const appRoot = path.join(directory, "runtime");
    const output = path.join(directory, "operation");
    const analyzer = path.join(appRoot, "node_modules", "mcp-video-analyzer");
    const ffmpeg = path.join(appRoot, "node_modules", "ffmpeg-static");
    await mkdir(analyzer, { recursive: true });
    await mkdir(ffmpeg, { recursive: true });
    await mkdir(path.join(output, "raw"), { recursive: true });
    await writeFile(path.join(analyzer, "package.json"), "{}");
    await writeFile(
      path.join(ffmpeg, "package.json"),
      JSON.stringify({ main: "program.json" })
    );
    await writeFile(
      path.join(ffmpeg, "program.json"),
      JSON.stringify("fixture-ffmpeg")
    );
    // Only the native process endpoint is substituted; the production runtime still loads and validates audio.json.
    const spawn = spyOn(childProcess, "spawn");
    const environment = process.env;
    try {
      process.env = {
        ...environment,
        SystemRoot: path.join(directory, "Windows")
      };
      const tools = await runtime({ appRoot, output, timeout: 0, resources });
      const transcribe = (request: AsrRequest) => {
        const child = new childProcess.ChildProcess();
        Object.defineProperties(child, {
          stdout: { value: new PassThrough() },
          stderr: { value: new PassThrough() }
        });
        spawn.mockReturnValueOnce(child);
        queueMicrotask(() => child.emit("close", 0, null));
        return tools.asr(request);
      };
      const audio = path.join(output, ".process", "audio.wav");
      const target = path.join(output, "raw", "audio.json");
      const segments = [
        { start: 2, end: 3, text: "second" },
        { start: 0, end: 1, text: " first " }
      ];
      await writeFile(target, JSON.stringify({ language: "en", segments }));
      assert.deepEqual(await transcribe({ audio, model: "small" }), {
        language: "en",
        segments: segments.toReversed()
      });
      const nativeArguments = [
        "-I",
        resources.mediaHelper,
        "asr",
        audio,
        "--model",
        "small",
        "--model_dir",
        path.join(appRoot, "cache", "huggingface", "hub"),
        "--local_files_only",
        "True",
        "--device",
        "cpu",
        "--compute_type",
        "int8",
        "--vad_filter",
        "True",
        "--output_dir",
        path.join(output, "raw"),
        "--output_format",
        "all",
        "--verbose",
        "False"
      ];
      assert.equal(
        spawn.mock.calls[0]?.[0],
        path.join(appRoot, "venv", "Scripts", "python.exe")
      );
      assert.deepEqual(spawn.mock.calls[0]?.[1], nativeArguments);
      assert.equal(
        await readFile(target, "utf8"),
        JSON.stringify({ language: "en", segments })
      );
      await writeFile(target, JSON.stringify({ language: "zh", segments: [] }));
      assert.deepEqual(
        await transcribe({
          audio,
          model: "small",
          language: "zh",
          initialPrompt: "known terminology"
        }),
        { language: "zh", segments: [] }
      );
      assert.deepEqual(spawn.mock.calls[1]?.[1], [
        ...nativeArguments,
        "--language",
        "zh",
        "--initial_prompt",
        "known terminology"
      ]);
      for (const [value, field] of [
        [{ segments: [] }, "language"],
        [{ language: "", segments: [] }, "language"],
        [
          {
            language: "en",
            segments: [{ start: 2, end: 1, text: "invalid timing" }]
          },
          "segments.0"
        ]
      ] as const) {
        const raw = JSON.stringify(value);
        await writeFile(target, raw);
        await assert.rejects(
          transcribe({ audio, model: "small" }),
          (error) =>
            error instanceof Error &&
            error.message.includes(`protocol at asr: invalid ${field}`)
        );
        assert.equal(await readFile(target, "utf8"), raw);
      }
      await rm(target);
      await assert.rejects(
        transcribe({ audio, model: "small" }),
        (error) =>
          error instanceof Error &&
          error.message.includes(
            `environment at asr: local dependency/filesystem ENOENT; target=${target}`
          )
      );
    } finally {
      spawn.mockRestore();
      process.env = environment;
    }
  }));
