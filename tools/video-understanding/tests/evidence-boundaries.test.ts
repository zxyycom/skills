import { resources } from "./fixtures/public-cli.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import * as v from "valibot";
import { EvidenceSchema } from "../src/evidence.ts";
import { parseOptions } from "../src/arguments.ts";
import { mediaEnvironment, parseFrames } from "../src/media-runtime.ts";
import { safeDiagnostic } from "../src/failure.ts";

test("frame mapping separates requested seconds from actual PTS", () => {
  assert.equal(
    parseFrames([
      {
        file: "frame-01.png",
        requested: 1.03,
        actual: 1.1,
        pts: 11,
        timeBase: "1/10",
        streamIndex: 0
      }
    ])[0]?.actual,
    1.1
  );
  assert.throws(() =>
    parseFrames([
      {
        file: "frame-01.png",
        requested: 2,
        actual: 1,
        pts: 10,
        timeBase: "1/10",
        streamIndex: 0
      }
    ])
  );
  for (const timeBase of ["1/0", "0/10", "2/10"])
    assert.throws(() =>
      parseFrames([
        {
          file: "frame-01.png",
          requested: 1,
          actual: 1.1,
          pts: 11,
          timeBase,
          streamIndex: 0
        }
      ])
    );
});

test("process and persisted frames enforce the same time invariant", () => {
  const frame = {
    id: "F0001",
    requested: 1.03,
    actual: 1.1,
    pts: 11,
    timeBase: "1/10",
    streamIndex: 0,
    width: 960,
    image: { file: "artifacts/fixture/frame.png", sha256: "0".repeat(64) }
  };
  const index = {
    version: 5,
    scopeId: "00000000-0000-4000-8000-000000000000",
    duration: 4,
    source: {
      file: path.resolve("synthetic-source.mp4"),
      size: 0,
      mtimeMs: 0
    },
    materials: [],
    frames: { entries: [frame], attempt: { status: "complete" } },
    refinements: [],
    history: []
  };
  assert.equal(v.safeParse(EvidenceSchema, index).success, true);
  for (const invalid of [
    { ...frame, actual: 1 },
    { ...frame, pts: 12 },
    { ...frame, timeBase: "1/0" }
  ]) {
    assert.equal(
      v.safeParse(EvidenceSchema, {
        ...index,
        frames: { ...index.frames, entries: [invalid] }
      }).success,
      false
    );
    assert.throws(() => parseFrames([{ ...invalid, file: "frame-01.png" }]));
  }
});

test("media process strips ambient credentials and interpreter injection", async () => {
  const defaults = parseEnv(
    await readFile(resources.runtimeEnvironment, "utf8")
  );
  assert.deepEqual(defaults, {
    HF_HUB_OFFLINE: "1",
    HF_HUB_DISABLE_TELEMETRY: "1",
    HF_HUB_DISABLE_IMPLICIT_TOKEN: "true",
    DO_NOT_TRACK: "1"
  });
  const env = mediaEnvironment({
    appRoot: "D:/app/video",
    output: "D:/evidence",
    parent: {
      SystemRoot: "C:/Windows",
      OPENAI_API_KEY: "example",
      HF_TOKEN: "example",
      PYTHONPATH: "injected",
      PYTHONHOME: "injected",
      PATH: "ambient",
      NODE_OPTIONS: "injected"
    },
    defaults
  });
  for (const key of [
    "OPENAI_API_KEY",
    "HF_TOKEN",
    "PYTHONPATH",
    "PYTHONHOME",
    "NODE_OPTIONS"
  ])
    assert.equal(env[key], undefined);
  assert.ok(env.PATH && !env.PATH.includes("ambient"));
  assert.equal(env.HF_HUB_OFFLINE, "1");
  assert.equal(env.HF_HUB_DISABLE_TELEMETRY, "1");
  assert.equal(env.HF_HUB_DISABLE_IMPLICIT_TOKEN, "true");
  assert.equal(env.DO_NOT_TRACK, "1");
  assert.ok(env.TEMP?.includes(".process"));
  for (const invalid of [
    { ...defaults, HF_HUB_OFFLINE: "0" },
    { ...defaults, HF_HUB_DISABLE_IMPLICIT_TOKEN: undefined },
    { ...defaults, HF_HUB_DISABLE_TELEMETRY: "0" },
    { ...defaults, DO_NOT_TRACK: undefined }
  ]) {
    assert.throws(
      () =>
        mediaEnvironment({
          appRoot: "D:/app/video",
          output: "D:/evidence",
          parent: { SystemRoot: "C:/Windows" },
          defaults: invalid
        }),
      (error) =>
        error instanceof Error && error.message.includes("protocol at runtime")
    );
  }
});

test("CLI validates applicable options, budgets, explicit track zero and narrow images", () => {
  const output = path.resolve("evidence-output");
  const input = path.resolve("video.mp4");
  const options = parseOptions([
    "prepare",
    "--input",
    input,
    "--output",
    output,
    "--subtitle-stream",
    "0"
  ]);
  assert.equal(options?.command, "prepare");
  if (options?.command !== "prepare") throw new Error("expected prepare");
  assert.deepEqual(options.subtitle, { mode: "embedded", index: 0 });
  const frames = parseOptions([
    "frames",
    "--input",
    input,
    "--output",
    output,
    "--times",
    "1,2",
    "--width",
    "0"
  ]);
  if (frames?.command !== "frames") throw new Error("expected frames");
  assert.equal(frames.width, 0);
  for (const args of [
    ["read", "--output", output, "--language", "zh"],
    ["read", "--output", "relative"],
    ["read", "--output", output, "--limit", "0"],
    ["frames", "--input", input, "--output", output, "--times", "1,NaN"],
    ["read", "--output", output, "--id", "T0001", "--view", "raw"],
    ["read", "--output", output, "--id", "T0001", "--offset", "0"],
    ["read", "--output", output, "--view", "calibrations", "--start", "0"],
    [
      "logs",
      "--output",
      output,
      "--id",
      "00000000-0000-4000-8000-000000000000",
      "--limit",
      "1"
    ],
    ["logs", "--output", output, "--id", "-".repeat(36)],
    ["prepare", "--input", input, "--output", output, "--subtitle", ""],
    ["prepare", "--input", input, "--output", output, "--language", ""],
    ["prepare", "--input", input, "--output", output, "--language", "   "],
    [
      "prepare",
      "--input",
      input,
      "--output",
      output,
      "--subtitle",
      input,
      "--subtitle-stream",
      "0"
    ]
  ]) {
    assert.throws(() => parseOptions(args));
  }
});

test("diagnostic filtering removes whole credential-bearing lines and private key blocks", () => {
  const keyType = "PRIVATE KEY";
  const result = safeDiagnostic(
    'password=first token=second\n{"api_key": "third"}\nAuthorization: Bearer fourth\n' +
      `https://name:fifth@example.test/?token=sixth\n-----BEGIN ${keyType}-----\nseventh\n-----END ${keyType}-----\nsafe reason`
  );
  for (const secret of [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh"
  ])
    assert.ok(!result.includes(secret));
  assert.ok(result.includes("safe reason"));
});
