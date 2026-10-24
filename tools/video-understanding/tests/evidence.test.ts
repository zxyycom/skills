import { resources } from "./fixtures/public-cli.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runProcess } from "./fixtures/process.ts";
import { readFileDigest } from "../src/evidence.ts";
import { parseOptions } from "../src/arguments.ts";
import { cli, publicJson, workspace } from "./fixtures/public-cli.ts";
import { complete, readyText } from "./fixtures/evidence-state.ts";
import { locateEvidence } from "../src/location.ts";
import { queryEvidence } from "../src/query.ts";
import { loadSnapshot, publishEvidence } from "../src/store.ts";
async function query(directory: string, args: string[] = []) {
  const options = parseOptions(["read", "--output", directory, ...args]);
  if (options?.command !== "read") throw new Error("expected read");
  return queryEvidence(
    await loadSnapshot(directory),
    await locateEvidence(options, resources)
  );
}
async function completeReadWindowFixture(directory: string) {
  const index = await complete(directory);
  const duration = 800.746667;
  index.duration = duration;
  const material = readyText(index);
  material.cues[1] = { id: "T0002", start: 800.745, end: index.duration };
  material.requestedCoverage = material.processedCoverage = [
    { start: 0, end: index.duration }
  ];
  await writeFile(
    path.join(directory, material.payload.file),
    JSON.stringify(
      material.cues.map((cue) => ({
        ...cue,
        text: cue.id === "T0001" ? "原始文本" : "尾端文字"
      }))
    )
  );
  material.payload = await readFileDigest(directory, material.payload.file);
  await publishEvidence(directory, index);
  return { ...index, duration };
}
test("read end rounding is bounded, visible and identical to an exact window without changing evidence", async () =>
  workspace(async (directory) => {
    const index = await completeReadWindowFixture(directory);
    const manifest = await readFile(
      path.join(directory, "evidence.json"),
      "utf8"
    );
    const raw = await readFile(
      path.join(directory, readyText(index).payload.file),
      "utf8"
    );
    const files = (await readdir(directory, { recursive: true })).sort();
    for (const view of ["raw", "effective"]) {
      const exact = await query(directory, [
        "--view",
        view,
        "--end",
        String(index.duration)
      ]);
      assert.deepEqual(
        (await query(directory, ["--view", view])).window,
        exact.window
      );
      assert.deepEqual(exact.warnings, []);
      for (const end of [800.75, index.duration + 0.005]) {
        const result = await query(directory, [
          "--view",
          view,
          "--end",
          String(end)
        ]);
        assert.deepEqual(result.window, { start: 0, end: index.duration });
        assert.deepEqual(result.items, exact.items);
        assert.equal(result.warnings.length, 1);
        assert.ok(
          result.warnings[0].includes(
            `requestedEnd=${end} end=${index.duration}`
          )
        );
        assert.ok(
          result.warnings[0].includes(
            "tolerance=0.005 seconds; evidence unchanged"
          )
        );
      }
      const inside = await query(directory, [
        "--view",
        view,
        "--end",
        "800.74"
      ]);
      assert.equal(inside.window?.end, 800.74);
      assert.deepEqual(
        inside.items.map((item) => item.id),
        ["T0001"]
      );
      assert.deepEqual(inside.warnings, []);
    }
    assert.equal(
      await readFile(path.join(directory, "evidence.json"), "utf8"),
      manifest
    );
    assert.equal(
      await readFile(
        path.join(directory, readyText(index).payload.file),
        "utf8"
      ),
      raw
    );
    assert.deepEqual(
      (await readdir(directory, { recursive: true })).sort(),
      files
    );
  }));

test("read rejects true overshoot and windows empty after rounding with numeric recovery context", async () =>
  workspace(async (directory) => {
    await complete(directory);
    for (const [start, end] of [
      [0, 4.005001],
      [0, 5],
      [4, 4.003],
      [4.001, 4.004],
      [2, 2],
      [3, 2]
    ]) {
      await assert.rejects(
        query(directory, ["--start", String(start), "--end", String(end)]),
        (error) =>
          error instanceof Error &&
          error.message.includes(`start=${start} end=${end} duration=4`)
      );
    }
    await assert.rejects(
      query(directory, ["--start", "4"]),
      (error) =>
        error instanceof Error &&
        error.message.includes(
          "omit --end to read to the exact duration (start must remain below 4)"
        )
    );
    for (const value of ["-0.001", "NaN", "Infinity", ""]) {
      for (const option of ["--start", "--end"])
        await assert.rejects(
          query(directory, [`${option}=${value}`]),
          (error) =>
            error instanceof Error && error.message.includes("invalid --")
        );
    }
    assert.deepEqual((await query(directory, ["--end", "4.005"])).window, {
      start: 0,
      end: 4
    });
    assert.deepEqual(
      (await query(directory, ["--start", "3.999", "--end", "4.005"])).window,
      { start: 3.999, end: 4 }
    );
    assert.equal(
      (await query(directory, ["--view", "materials"])).window,
      null
    );
    assert.equal((await query(directory, ["--id", "T0001"])).window, null);
  }));

test("public read reports normalized windows in text and JSON and keeps true failures actionable", async () =>
  workspace(async (directory) => {
    const index = await completeReadWindowFixture(directory);
    const manifest = await readFile(
      path.join(directory, "evidence.json"),
      "utf8"
    );
    const rounded = await publicJson(directory, "read", [
      "--end",
      "800.75",
      "--limit",
      "1"
    ]);
    assert.equal(rounded.exitCode, 0);
    assert.equal(rounded.stderr, "");
    assert.deepEqual(rounded.value.window, { start: 0, end: index.duration });
    assert.equal(rounded.value.warnings.length, 1);
    assert.ok(
      rounded.value.warnings[0].includes("requestedEnd=800.75 end=800.746667")
    );
    assert.equal(rounded.value.nextOffset, 1);
    const next = await publicJson(directory, "read", [
      "--end",
      "800.75",
      "--limit",
      "1",
      "--offset",
      "1"
    ]);
    assert.equal(next.exitCode, 0);
    assert.equal(next.value.items[0].id, "T0002");
    assert.equal(next.value.items[0].text, "尾端文字");
    assert.equal(next.value.remaining, 0);
    assert.deepEqual(next.value.window, rounded.value.window);
    const text = await runProcess("node", [
      cli,
      "read",
      "--output",
      directory,
      "--end",
      "800.75"
    ]);
    assert.ok(text.stdout.includes("window=[0,800.746667)"));
    assert.ok(text.stdout.includes(rounded.value.warnings[0]));
    const failed = await publicJson(directory, "read", ["--end", "800.76"]);
    assert.equal(failed.exitCode, 1);
    assert.equal(failed.stdout, "");
    for (const detail of [
      "input at read",
      `target=${directory}`,
      "start=0 end=800.76 duration=800.746667",
      "omit --end"
    ])
      assert.ok(failed.stderr.includes(detail));
    const recovered = await publicJson(directory, "read");
    assert.equal(recovered.exitCode, 0);
    assert.deepEqual(recovered.value.window, rounded.value.window);
    assert.deepEqual(recovered.value.warnings, []);
    assert.equal(
      await readFile(path.join(directory, "evidence.json"), "utf8"),
      manifest
    );
  }));
