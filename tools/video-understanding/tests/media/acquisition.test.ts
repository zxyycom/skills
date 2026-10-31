/// <reference types="bun" />
import { resources } from "../fixtures/public-cli.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { spyOn } from "bun:test";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as ocrRuntime from "../../src/media/ocr-runtime.ts";
import { prepare } from "../../src/video.ts";
import { loadEvidence } from "../../src/store/store.ts";
import { workspace } from "../fixtures/public-cli.ts";
import {
  provenance,
  prepared,
  fixtureRuntime,
  readResult
} from "../fixtures/acquisition-runtime.ts";

test("ASR tail normalization preserves raw and provenance, publishes auditable warnings and reuses without recognition", async () =>
  workspace(async (directory) => {
    const input = path.join(directory, "source.mp4");
    const output = path.join(directory, "evidence");
    const appRoot = path.join(directory, "runtime");
    await writeFile(input, "fixture source");
    await mkdir(appRoot);
    const duration = 724.88195;
    const segments = [
      { start: 723.5, end: 724.9, text: " exact ASR text " },
      { start: 0, end: 1, text: "opening" }
    ];
    const tools = fixtureRuntime({ duration, segments });
    try {
      const options = prepared(input, output, appRoot, [
        "--source",
        "asr",
        "--language",
        "en"
      ]);
      const result = JSON.parse(await prepare(options, resources));
      assert.partialDeepStrictEqual(result, {
        material: "M0001",
        status: "complete",
        origin: "asr",
        language: "en",
        reused: false
      });
      assert.equal(result.warnings.length, 1);
      const warning = result.warnings[0];
      for (const detail of [
        "cue=T0002",
        "start=723.5",
        "end=724.9",
        "duration=724.88195",
        `delta=${724.9 - duration}`,
        `normalizedEnd=${duration}`,
        `adjustment=${duration - 724.9}`,
        "tolerance=0.025",
        "raw=raw/audio.json",
        "payload=segments-M0001.json"
      ])
        assert.ok(warning.includes(detail));
      const material = (await loadEvidence(output)).materials[0]!;
      if (material.status !== "complete") throw new Error("expected complete");
      assert.partialDeepStrictEqual(material, {
        origin: "asr",
        parameters: { language: "en" },
        provenance: { tool: "fixture", models: [{ path: "fixture-model" }] },
        cues: [
          { id: "T0001", start: 0, end: 1 },
          { id: "T0002", start: 723.5, end: duration }
        ],
        warnings: [warning]
      });
      const raw = material.files.find((file) =>
        file.file.endsWith("/raw/audio.json")
      )!;
      const rawBytes = JSON.stringify({ segments, language: "en" });
      assert.equal(
        await readFile(path.join(output, raw.file), "utf8"),
        rawBytes
      );
      assert.equal(
        raw.sha256,
        createHash("sha256").update(rawBytes).digest("hex")
      );
      assert.equal(
        path.dirname(path.dirname(raw.file)),
        path.dirname(material.payload.file)
      );
      assert.deepEqual(
        JSON.parse(
          await readFile(path.join(output, material.payload.file), "utf8")
        ),
        [
          { id: "T0001", ...segments[1] },
          { id: "T0002", ...segments[0], end: duration }
        ]
      );
      for (const args of [
        ["--view", "raw"],
        ["--view", "effective"],
        ["--id", "T0002"],
        ["--id", "M0001"],
        ["--view", "materials"]
      ]) {
        const read = JSON.parse(
          await readResult(output, [...args, "--format", "json"])
        );
        assert.ok(read.warnings.includes(`M0001: ${warning}`));
      }
      assert.ok(
        (await readResult(output, ["--view", "raw"])).includes(
          `M0001: ${warning}`
        )
      );
      assert.partialDeepStrictEqual(
        JSON.parse(await prepare(options, resources)),
        { material: "M0001", reused: true, warnings: [warning] }
      );
      assert.equal(tools.asrCalls(), 1);
      tools.transcribe([{ start: 0, end: 1, text: "new result" }]);
      await prepare({ ...options, fresh: true }, resources);
      for (const view of ["raw", "materials"]) {
        const page = JSON.parse(
          await readResult(output, [
            "--view",
            view,
            "--offset",
            "1",
            "--limit",
            "1",
            "--format",
            "json"
          ])
        );
        assert.equal(page.items.length, 1);
        assert.partialDeepStrictEqual(
          page.items[0],
          view === "raw" ? { material: "M0002" } : { id: "M0002" }
        );
        assert.deepEqual(page.warnings, []);
      }
    } finally {
      tools.runtime.mockRestore();
    }
  }));

test("ASR accepts exactly 25 ms only on a single final overlapping cue and preserves successful history on fresh rejection", async () =>
  workspace(async (directory) => {
    const input = path.join(directory, "source.mp4");
    const output = path.join(directory, "evidence");
    const appRoot = path.join(directory, "runtime");
    await writeFile(input, "fixture source");
    await mkdir(appRoot);
    const tools = fixtureRuntime({
      segments: [{ start: 3, end: 4.025, text: "boundary" }]
    });
    try {
      const options = prepared(input, output, appRoot, ["--source", "asr"]);
      const result = JSON.parse(await prepare(options, resources));
      assert.equal(result.status, "complete");
      assert.equal(result.warnings.length, 1);
      assert.ok(result.warnings[0].includes("end=4.025"));
      const original = JSON.stringify(
        (await loadEvidence(output)).materials[0]
      );
      const cases = [
        [{ start: 3, end: 4.025000001, text: "just outside" }],
        [{ start: 3, end: 40, text: "far outside" }],
        [
          { start: 3, end: 4.01, text: "first outside" },
          { start: 3.5, end: 4.02, text: "second outside" }
        ],
        [
          { start: 2, end: 4.01, text: "non-final outside" },
          { start: 3, end: 3.5, text: "final inside" }
        ],
        [{ start: 4, end: 4.01, text: "starts at end" }],
        [{ start: 4.005, end: 4.01, text: "wholly outside" }]
      ];
      for (const segments of cases) {
        tools.transcribe(segments);
        await assert.rejects(
          prepare({ ...options, fresh: true }, resources),
          (error) =>
            error instanceof Error &&
            error.message.includes("subtitle interval exceeds media duration")
        );
        const index = await loadEvidence(output);
        const failed = index.materials.at(-1)!;
        assert.partialDeepStrictEqual(failed, {
          status: "failed",
          origin: "asr",
          processedCoverage: [],
          failure: { kind: "protocol", stage: "verification" }
        });
        if (failed.status !== "failed") throw new Error("expected failed");
        assert.ok(
          failed.failure.action.includes("preserve the failed material")
        );
        for (const detail of [
          "cue=T0002",
          `start=${segments[0]!.start}`,
          `end=${segments[0]!.end}`,
          "duration=4",
          `delta=${segments[0]!.end - 4}`
        ])
          assert.ok(failed.failure.reason.includes(detail));
        assert.ok(
          failed.failure.reason.includes(
            `outsideCount=${segments.filter((cue) => cue.end > 4).length}`
          )
        );
        assert.equal(JSON.stringify(index.materials[0]), original);
        assert.partialDeepStrictEqual(
          JSON.parse(await prepare(options, resources)),
          { material: "M0001", reused: true }
        );
      }
      const operations = await readdir(path.join(output, "artifacts"));
      const raws = await Promise.all(
        operations.map((operation) =>
          readFile(
            path.join(output, "artifacts", operation, "raw/audio.json"),
            "utf8"
          )
        )
      );
      assert.equal(raws.length, cases.length + 1);
      for (const segments of cases)
        assert.ok(raws.includes(JSON.stringify({ segments, language: "en" })));
      assert.equal(tools.asrCalls(), cases.length + 1);
    } finally {
      tools.runtime.mockRestore();
    }
  }));

test("subtitle tail tolerance does not apply to external, embedded or hard OCR", async () =>
  workspace(async (directory) => {
    const input = path.join(directory, "source.mp4");
    const output = path.join(directory, "evidence");
    const appRoot = path.join(directory, "runtime");
    const subtitle = path.join(directory, "chosen.srt");
    await writeFile(subtitle, "external fixture");
    await writeFile(input, "fixture source");
    await mkdir(appRoot);
    const tools = fixtureRuntime({
      subtitles: [{ start: 3, end: 4.01, text: "not ASR" }]
    });
    const hard = spyOn(ocrRuntime, "hardOcr").mockImplementation(
      async ({ output: operation }) => {
        const file = path.join(operation, "output.srt");
        await writeFile(file, "OCR fixture");
        return {
          file,
          provenance: { ...provenance, tool: "videocr" as const }
        };
      }
    );
    try {
      for (const args of [
        ["--source", "external", "--subtitle", subtitle],
        ["--source", "embedded", "--subtitle-stream", "2"],
        ["--source", "hard-ocr", "--region", "0,20,100,20"]
      ]) {
        await assert.rejects(
          prepare(prepared(input, output, appRoot, args), resources),
          (error) =>
            error instanceof Error &&
            error.message.includes(
              "cue=T0001 start=3 end=4.01 duration=4 delta="
            )
        );
      }
      assert.deepEqual(
        (await loadEvidence(output)).materials.map((material) => [
          material.origin,
          material.status
        ]),
        [
          ["external", "failed"],
          ["embedded", "failed"],
          ["hard-ocr", "failed"]
        ]
      );
      assert.equal(tools.asrCalls(), 0);
    } finally {
      tools.runtime.mockRestore();
      hard.mockRestore();
    }
  }));
