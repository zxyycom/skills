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
      const result: unknown = JSON.parse(await prepare(options, resources));
      const material = (await loadEvidence(output)).materials[0];
      assert.ok(material?.status === "complete");
      const [warning] = material.warnings;
      assert.equal(material.warnings.length, 1);
      assert.ok(warning);
      assert.partialDeepStrictEqual(result, {
        material: "M0001",
        status: "complete",
        origin: "asr",
        language: "en",
        reused: false,
        warnings: [warning]
      });
      for (const detail of [
        "cue=T0002",
        "start=723.5",
        "end=724.9",
        "duration=724.88195",
        `delta=${724.9 - duration}`,
        `normalizedEnd=${duration}`,
        `adjustment=${duration - 724.9}`,
        "raw=raw/audio.json",
        "payload=segments-M0001.json"
      ])
        assert.ok(warning.includes(detail));
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
      );
      assert.ok(raw);
      const rawBytes = JSON.stringify({ segments, language: "en" });
      assert.equal(
        await readFile(path.join(output, raw.file), "utf8"),
        rawBytes
      );
      const srt = material.files.find((file) =>
        file.file.endsWith("/raw/audio.srt")
      );
      assert.ok(srt);
      assert.deepEqual(
        await readFile(path.join(output, srt.file)),
        Buffer.from("fixture SRT\r\n")
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
        const read: unknown = JSON.parse(
          await readResult(output, [...args, "--format", "json"])
        );
        assert.partialDeepStrictEqual(read, {
          warnings: [`M0001: ${warning}`]
        });
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
        const page: unknown = JSON.parse(
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
        assert.ok(typeof page === "object" && page !== null && "items" in page);
        assert.ok(Array.isArray(page.items));
        assert.equal(page.items.length, 1);
        assert.partialDeepStrictEqual(page, {
          items: [view === "raw" ? { material: "M0002" } : { id: "M0002" }]
        });
        assert.ok("warnings" in page);
        assert.deepEqual(page.warnings, []);
      }
    } finally {
      tools.runtime.mockRestore();
    }
  }));

test("ASR registers a sole final overrun without a numeric cap", async () => {
  for (const end of [4.028, 4.064667, 4.849932, 40]) {
    await workspace(async (directory) => {
      const input = path.join(directory, "source.mp4");
      const output = path.join(directory, "evidence");
      const appRoot = path.join(directory, "runtime");
      await writeFile(input, "fixture source");
      await mkdir(appRoot);
      const segments = [{ start: 3, end, text: "tail" }];
      const tools = fixtureRuntime({ duration: 4, segments });
      try {
        const options = prepared(input, output, appRoot, ["--source", "asr"]);
        const accepted: unknown = JSON.parse(await prepare(options, resources));
        assert.partialDeepStrictEqual(accepted, { status: "complete" });
        const material = (await loadEvidence(output)).materials[0];
        assert.ok(material?.status === "complete", `ASR end ${end}`);
        assert.partialDeepStrictEqual(material, {
          cues: [{ start: 3, end: 4 }],
          processedCoverage: [{ start: 0, end: 4 }]
        });
        assert.ok(
          material.warnings.some((warning) => warning.includes(`end=${end} `))
        );
      } finally {
        tools.runtime.mockRestore();
      }
    });
  }
});

test("ASR rejects other overruns without displacing reusable evidence", async () =>
  workspace(async (directory) => {
    const input = path.join(directory, "source.mp4");
    const output = path.join(directory, "evidence");
    const appRoot = path.join(directory, "runtime");
    await writeFile(input, "fixture source");
    await mkdir(appRoot);
    const tools = fixtureRuntime({ duration: 4 });
    try {
      const options = prepared(input, output, appRoot, ["--source", "asr"]);
      await prepare(options, resources);
      const original = (await loadEvidence(output)).materials[0];
      assert.ok(original?.status === "complete");
      const cases = [
        {
          reason: "multiple overruns",
          outsideCount: 2,
          firstOverrun: { start: 3, end: 4.01, text: "first outside" },
          rest: [{ start: 3.5, end: 4.02, text: "second outside" }]
        },
        {
          reason: "non-final overrun",
          outsideCount: 1,
          firstOverrun: { start: 2, end: 4.01, text: "non-final outside" },
          rest: [{ start: 3, end: 3.5, text: "final inside" }]
        },
        {
          reason: "starts at media end",
          outsideCount: 1,
          firstOverrun: { start: 4, end: 4.01, text: "starts at end" },
          rest: []
        },
        {
          reason: "starts after media end",
          outsideCount: 1,
          firstOverrun: { start: 4.005, end: 4.01, text: "wholly outside" },
          rest: []
        }
      ];
      for (const { reason, firstOverrun, rest, outsideCount } of cases) {
        tools.transcribe([firstOverrun, ...rest]);
        await assert.rejects(
          prepare({ ...options, fresh: true }, resources),
          (error) =>
            error instanceof Error &&
            error.message.includes("subtitle interval exceeds media duration"),
          reason
        );
        const index = await loadEvidence(output);
        const failed = index.materials.at(-1);
        assert.ok(failed?.status === "failed", reason);
        assert.partialDeepStrictEqual(failed, {
          status: "failed",
          origin: "asr",
          processedCoverage: [],
          failure: { kind: "protocol", stage: "verification" }
        });
        assert.ok(
          failed.failure.action.includes("preserve the failed material")
        );
        for (const detail of [
          `start=${firstOverrun.start}`,
          `end=${firstOverrun.end}`,
          "duration=4",
          `delta=${firstOverrun.end - 4}`,
          `outsideCount=${outsideCount}`
        ])
          assert.ok(failed.failure.reason.includes(detail), reason);
        assert.match(failed.failure.reason, /\bcue=T\d+\b/u);
        assert.deepEqual(index.materials[0], original);
        assert.partialDeepStrictEqual(
          JSON.parse(await prepare(options, resources)),
          { material: original.id, reused: true }
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
      for (const { firstOverrun, rest } of cases) {
        const segments = [firstOverrun, ...rest];
        assert.ok(raws.includes(JSON.stringify({ segments, language: "en" })));
      }
      assert.equal(tools.asrCalls(), cases.length + 1);
    } finally {
      tools.runtime.mockRestore();
    }
  }));

test("subtitle tail normalization does not apply to external, embedded or hard OCR", async () =>
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
