import { resources } from "../fixtures/public-cli.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { complete, readyText } from "../fixtures/evidence-state.ts";
import { loadEvidence } from "../../src/store/store.ts";
import { parseOptions } from "../../src/cli/arguments.ts";
import { readEvidence } from "../../src/video.ts";
import { workspace } from "../fixtures/public-cli.ts";
import {
  verification,
  submit,
  query,
  textQuery,
  correction,
  frames,
  observationMaterial
} from "../fixtures/refinement-state.ts";

test("frame OCR is raw point evidence, not a description; frame-only authored selection works without subtitle material", async () =>
  workspace(async (directory) => {
    const prepared = await complete(directory);
    await frames(directory);
    const index = await loadEvidence(directory);
    index.materials = [];
    await observationMaterial(
      directory,
      index,
      "Shop 123",
      readyText(prepared).provenance
    );
    assert.deepEqual(
      (await query(directory)).items.map((i) => i.id),
      ["F0001"]
    );
    const raw = await query(directory, ["--view", "raw"]);
    assert.deepEqual(raw.items.find((i) => i.id === "O0001")?.ranges, [
      { start: 1, end: 1 }
    ]);
    const rawText = await textQuery(directory, ["--view", "raw"]);
    assert.ok(rawText.includes("adoption=raw"));
    for (const item of raw.items)
      assert.ok(rawText.includes(JSON.stringify(item, null, 2)));
    assert.ok(
      rawText.includes(
        path
          .join(directory, "artifacts/fixture/frame.png")
          .replaceAll("\\", "\\\\")
      )
    );
    assert.ok(rawText.includes('"actual": 1'));
    assert.ok((await textQuery(directory)).includes("adoption=no-subtitle"));
    await submit(directory, {
      scopeId: index.scopeId,
      action: "create",
      kind: "description",
      refs: ["F0001"],
      support: ["O0001"],
      text: "observed shop sign",
      ...verification
    });
    await submit(directory, {
      scopeId: index.scopeId,
      action: "create",
      kind: "selection",
      mode: "authored",
      purpose: "narrative",
      refs: ["O0001", "F0001"],
      text: "visual narrative",
      ...verification
    });
    assert.deepEqual(
      (await query(directory)).items
        .map((i) => i.kind)
        .sort((left, right) => (left ?? "").localeCompare(right ?? "")),
      ["description", "selection"]
    );
    const effectiveText = await textQuery(directory);
    for (const item of (await query(directory)).items)
      assert.ok(effectiveText.includes(JSON.stringify(item, null, 2)));
    await writeFile(
      path.join(directory, index.frames.entries[0]!.image.file),
      "damaged"
    );
    assert.equal(
      (await query(directory, ["--id", "O0001"])).items[0]?.text,
      null
    );
    assert.equal((await query(directory)).adoption, "unavailable");
  }));

test("unavailable raw OCR and S/C/D omit stale bodies from entire public JSON and text projections", async () =>
  workspace(async (directory) => {
    await complete(directory);
    await frames(directory);
    const index = await loadEvidence(directory);
    await observationMaterial(
      directory,
      index,
      "STALE_OCR_BODY",
      readyText(index).provenance
    );
    await submit(directory, {
      ...correction(
        index.scopeId,
        ["T0001"],
        [{ start: 0, end: 1, text: "STALE_CORRECTION_BODY" }]
      ),
      support: ["F0001"]
    });
    await submit(directory, {
      scopeId: index.scopeId,
      action: "create",
      kind: "description",
      refs: ["F0001"],
      support: ["O0001"],
      text: "STALE_DESCRIPTION_BODY",
      ...verification
    });
    await submit(directory, {
      scopeId: index.scopeId,
      action: "create",
      kind: "selection",
      mode: "authored",
      purpose: "narrative",
      refs: ["O0001"],
      text: "STALE_SELECTION_BODY",
      ...verification
    });
    for (const id of ["O0001", "C0001", "D0001", "S0001"])
      assert.ok(
        (await query(directory, ["--id", id])).items[0]?.text?.includes(
          "STALE_"
        )
      );
    await writeFile(
      path.join(directory, index.frames.entries[0]!.image.file),
      "damaged frame"
    );
    const selectors = [
      ["--view", "raw"],
      ["--view", "effective"],
      ["--view", "calibrations"],
      ["--view", "materials"],
      ...["O0001", "C0001", "D0001", "S0001"].map((id) => ["--id", id]),
      ...["C0001", "D0001", "S0001"].map((id) => [
        "--id",
        id,
        "--revision",
        "1"
      ])
    ];
    for (const selector of selectors)
      for (const format of ["json", "text"]) {
        const options = parseOptions([
          "read",
          "--output",
          directory,
          ...selector,
          "--format",
          format
        ]);
        if (options?.command !== "read") throw new Error("read expected");
        assert.ok(!(await readEvidence(options, resources)).includes("STALE_"));
      }
    for (const id of ["O0001", "C0001", "D0001", "S0001"]) {
      const item = (await query(directory, ["--id", id])).items[0]!;
      assert.equal(item.availability, "unavailable");
      assert.equal(item.text, null);
      assert.ok(item.ranges.length > 0);
      assert.notEqual(item.reason, null);
    }
    assert.ok(
      !("segments" in (await query(directory, ["--id", "C0001"])).items[0])
    );
    assert.equal(
      (await query(directory, ["--view", "raw", "--material", "M0001"]))
        .items[0]?.text,
      "原始文本"
    );
    const material = readyText(index);
    await writeFile(
      path.join(directory, material.payload.file),
      "damaged subtitle payload"
    );
    const unavailableRaw = await query(directory, [
      "--view",
      "raw",
      "--material",
      "M0001"
    ]);
    const unavailableRawText = await textQuery(directory, [
      "--view",
      "raw",
      "--material",
      "M0001"
    ]);
    for (const item of unavailableRaw.items) {
      assert.equal(item.availability, "unavailable");
      assert.ok(unavailableRawText.includes(JSON.stringify(item, null, 2)));
    }
    for (const format of ["json", "text"]) {
      const options = parseOptions([
        "read",
        "--output",
        directory,
        "--id",
        "C0001",
        "--format",
        format
      ]);
      if (options?.command !== "read") throw new Error("read expected");
      assert.ok(!(await readEvidence(options, resources)).includes("STALE_"));
    }
  }));
