import { resources } from "../fixtures/public-cli.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ocrEnvironment,
  ocrPreflight,
  ocrWorkspace,
  parseFrameOcr,
  validateRegion,
  videocrArguments
} from "../../src/media/ocr-runtime.ts";

const result = {
  width: 800,
  height: 600,
  region: { x: 100, y: 200, width: 500, height: 100 },
  transform: { offsetX: 100, offsetY: 200, scaleX: 1, scaleY: 1 },
  boxes: [
    [
      [110, 210],
      [300, 210],
      [300, 260],
      [110, 260]
    ]
  ],
  texts: ["文件 123"],
  scores: [0.96]
};
test("OCR boxes and true empty output preserve the PNG coordinate contract", () => {
  assert.equal(JSON.stringify(parseFrameOcr(result)), JSON.stringify(result));
  assert.deepEqual(
    parseFrameOcr({ ...result, boxes: [], texts: [], scores: [] }).texts,
    []
  );
  assert.throws(
    () => parseFrameOcr({ ...result, scores: [] }),
    (error) =>
      error instanceof Error && error.message.includes("inconsistent arrays")
  );
  assert.throws(
    () =>
      parseFrameOcr({
        ...result,
        transform: { ...result.transform, offsetX: 0 }
      }),
    (error) =>
      error instanceof Error && error.message.includes("coordinate mapping")
  );
  assert.throws(
    () =>
      parseFrameOcr({
        ...result,
        boxes: [
          [
            [99, 210],
            [300, 210],
            [300, 260],
            [99, 260]
          ]
        ]
      }),
    (error) =>
      error instanceof Error && error.message.includes("coordinate mapping")
  );
  assert.throws(() => parseFrameOcr({ ...result, scores: [NaN] }));
});
test("ROI never truncates, rounds or extends past the input", () => {
  assert.deepEqual(validateRegion(result.region, result), result.region);
  assert.throws(() => validateRegion({ ...result.region, x: 0.5 }, result));
  assert.throws(
    () => validateRegion({ ...result.region, width: 900 }, result),
    (error) => error instanceof Error && error.message.includes("wholly inside")
  );
  assert.throws(() => validateRegion({ ...result.region, height: 0 }, result));
});
test("VideOCR pins local single-ROI CPU execution without traditional conversion or debug images", () => {
  const args = videocrArguments({
    source: "D:/中文 space/video.mp4",
    file: "D:/中文 space/out.srt",
    region: result.region
  });
  const options = Object.fromEntries(
    Array.from({ length: args.length / 2 }, (_, index) => [
      args[index * 2],
      args[index * 2 + 1]
    ])
  );
  assert.partialDeepStrictEqual(options, {
    "--video_path": "D:/中文 space/video.mp4",
    "--ocr_engine": "paddleocr",
    "--lang": "ch",
    "--use_gpu": "false",
    "--frames_to_skip": "0",
    "--normalize_to_simplified_chinese": "false",
    "--save_ocr_images": "false",
    "--allow_system_sleep": "true",
    "--crop_x": "100",
    "--crop_width": "500"
  });
  assert.equal(options["--crop_x2"], undefined);
});
test("daily OCR environment excludes credentials, global PATH and shared caches", () => {
  const env = ocrEnvironment({
    work: "D:/证据 operation/.process",
    parent: {
      SystemRoot: "C:/Windows",
      PATH: "unsafe",
      TOKEN: "secret",
      HTTP_PROXY: "http://credential.invalid",
      PYTHONPATH: "unsafe",
      HF_TOKEN: "secret"
    }
  });
  assert.equal(env.TOKEN, undefined);
  assert.equal(env.HTTP_PROXY, undefined);
  assert.equal(env.PYTHONPATH, undefined);
  assert.equal(env.HF_TOKEN, undefined);
  assert.equal(env.HOME, "D:/证据 operation/.process");
  assert.equal(env.PATH, path.join("C:/Windows", "System32"));
  assert.throws(
    () => ocrEnvironment({ work: "any", parent: {} }),
    (error) =>
      error instanceof Error && error.message.includes("SystemRoot missing")
  );
});
test("OCR workspaces coexist with media inspection but reject reused tool workspaces", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "video OCR workspace-"));
  try {
    const media = path.join(output, ".process");
    await mkdir(media);
    await writeFile(path.join(media, "existing.txt"), "media evidence");
    for (const tool of ["videocr", "rapidocr"] as const) {
      const work = await ocrWorkspace(output, tool);
      assert.equal(work, path.join(output, `.${tool}-process`));
      await writeFile(path.join(work, "existing.txt"), "OCR evidence");
      await assert.rejects(ocrWorkspace(output, tool), { code: "EEXIST" });
      assert.equal(
        await readFile(path.join(work, "existing.txt"), "utf8"),
        "OCR evidence"
      );
    }
    assert.equal(
      await readFile(path.join(media, "existing.txt"), "utf8"),
      "media evidence"
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
test("preflight reports missing slots and rejects missing/corrupt models before launching", async () => {
  const app = await mkdtemp(path.join(os.tmpdir(), "video OCR 资格-"));
  try {
    const profiles = JSON.parse(await readFile(resources.ocrProfiles, "utf8"));
    for (const tool of ["rapidocr", "videocr"] as const) {
      await assert.rejects(
        ocrPreflight(app, tool, resources),
        (error) =>
          error instanceof Error &&
          error.message.includes("local dependency/filesystem ENOENT")
      );
      const root = path.join(app, "tools", tool, profiles[tool].version);
      const program = path.join(root, profiles[tool].program);
      await mkdir(path.dirname(program), { recursive: true });
      await writeFile(program, "fixture executable, never launched");
      const manifest = {
        tool,
        version: profiles[tool].version,
        profile: profiles[tool].profile,
        program: profiles[tool].program,
        models: profiles[tool].models
      };
      await writeFile(
        path.join(root, "installation.json"),
        JSON.stringify(manifest)
      );
      await assert.rejects(
        ocrPreflight(app, tool, resources),
        (error) =>
          error instanceof Error &&
          error.message.includes("local dependency/filesystem ENOENT")
      );
      const model = path.join(root, manifest.models[0].path);
      await mkdir(path.dirname(model), { recursive: true });
      await writeFile(model, "corrupt");
      await assert.rejects(
        ocrPreflight(app, tool, resources),
        (error) =>
          error instanceof Error &&
          error.message.includes("local OCR model SHA256 mismatch")
      );
      await writeFile(
        path.join(root, "installation.json"),
        JSON.stringify({ ...manifest, models: [] })
      );
      await assert.rejects(ocrPreflight(app, tool, resources));
      await writeFile(
        path.join(root, "installation.json"),
        JSON.stringify({ ...manifest, program: "../escape.exe" })
      );
      await assert.rejects(
        ocrPreflight(app, tool, resources),
        (error) =>
          error instanceof Error &&
          error.message.includes("relative to the tool slot")
      );
    }
  } finally {
    await rm(app, { recursive: true, force: true });
  }
});
