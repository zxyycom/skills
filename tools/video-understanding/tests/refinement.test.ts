import { resources } from "./fixtures/public-cli.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { complete, readyText } from "./fixtures/evidence-state.ts";
import { readFileDigest } from "../src/evidence.ts";
import { loadEvidence, publishEvidence } from "../src/store.ts";
import { formatQuery } from "../src/query.ts";
import { parseOptions } from "../src/arguments.ts";
import { readEvidence } from "../src/video.ts";
import { workspace } from "./fixtures/public-cli.ts";
import {
  verification,
  submit,
  query,
  textQuery,
  correction,
  second,
  select
} from "./fixtures/refinement-state.ts";

test("compact reading preserves provenance, paging and full JSON or ID detail", async () =>
  workspace(async (directory) => {
    const evidence = await complete(directory);
    const before = await query(directory);
    const text = await textQuery(directory);
    assert.ok(
      text.includes(`scopeId=${evidence.scopeId} version=5 output=${directory}`)
    );
    assert.ok(text.includes("adoption=unadopted-single-source"));
    assert.ok(
      text.includes(
        "transcripts material=M0001 origin=asr status=complete timeMeaning=estimated-speech availability=unadopted"
      )
    );
    assert.ok(
      text.includes(
        'reason="single available subtitle; not selected or individually verified"'
      )
    );
    assert.equal(text.match(/transcripts material=/g)?.length, 1);
    for (const item of before.items) {
      assert.ok(
        text.includes(
          `${item.id} [${item.start},${item.end}] ${JSON.stringify(item.text)}`
        )
      );
    }
    assert.ok(!text.includes('"refs":'));
    assert.ok(!text.includes('"ranges":'));
    assert.ok(!text.includes("selection=null"));
    assert.deepEqual(await query(directory), before);

    const jsonOptions = parseOptions([
      "read",
      "--output",
      directory,
      "--format",
      "json"
    ]);
    if (jsonOptions?.command !== "read") throw new Error("expected read");
    assert.partialDeepStrictEqual(
      JSON.parse(await readEvidence(jsonOptions, resources)),
      before
    );
    assert.deepEqual(before.items[0], {
      id: "T0001",
      kind: "transcript",
      availability: "unadopted",
      text: "原始文本",
      refs: ["T0001"],
      support: [],
      ranges: [{ start: 0, end: 2.125 }],
      frames: [],
      suppressed: false,
      reason:
        "single available subtitle; not selected or individually verified",
      start: 0,
      end: 2.125,
      material: "M0001"
    });
    const page = await textQuery(directory, [
      "--view",
      "raw",
      "--start",
      "0",
      "--end",
      "4",
      "--limit",
      "1"
    ]);
    assert.ok(page.includes("window=[0,4) offset=0 items=1/2 remaining=1"));
    assert.ok(page.includes("availability=raw"));
    assert.ok(
      page.includes("next: repeat same scope/view/window with --offset 1")
    );
    assert.ok(!page.includes("T0002"));
    const next = await textQuery(directory, [
      "--view",
      "raw",
      "--start",
      "0",
      "--end",
      "4",
      "--limit",
      "1",
      "--offset",
      "1"
    ]);
    assert.ok(next.includes('T0002 [2.5,3.5] "第二段"'));
    assert.ok(next.includes("remaining=0"));
    const own = await query(directory, ["--id", "T0001"]);
    assert.ok(
      (await textQuery(directory, ["--id", "T0001"])).includes(
        JSON.stringify(own.items[0], null, 2)
      )
    );
    assert.throws(
      () => formatQuery(before, []),
      (error) =>
        error instanceof Error &&
        error.message.includes(
          "transcript material is absent from query sources"
        )
    );
  }));

test("multiple sources are candidates until selected; switching, authored narrative and historical revisions are explicit", async () =>
  workspace(async (directory) => {
    const index = await complete(directory);
    await second(directory);
    const candidates = await query(directory, ["--limit", "1"]);
    assert.equal(candidates.adoption, "selection-required");
    assert.equal(candidates.items[0]?.id, "M0001");
    assert.equal(candidates.remaining, 1);
    assert.ok(!JSON.stringify(candidates).includes("原始文本"));
    const candidatesText = await textQuery(directory, ["--limit", "1"]);
    assert.ok(candidatesText.includes("adoption=selection-required"));
    assert.ok(
      candidatesText.includes(JSON.stringify(candidates.items[0], null, 2))
    );
    assert.ok(candidatesText.includes("remaining=1"));
    const mixedText = await textQuery(directory, ["--view", "raw"]);
    const mixedLines = mixedText.split("\n");
    for (const [id, material, origin] of [
      ["T0001", "M0001", "asr"],
      ["T0003", "M0002", "external"],
      ["T0002", "M0001", "asr"]
    ]) {
      const row = mixedLines.findIndex((line) => line.startsWith(`${id} [`));
      assert.ok(row > 0);
      assert.ok(
        mixedLines[row - 1].includes(`material=${material} origin=${origin}`)
      );
    }
    await select(directory, index.scopeId, "M0002");
    assert.equal((await query(directory)).items[0]?.text, "second source");
    assert.ok(
      (await textQuery(directory)).includes("material=M0002 origin=external")
    );
    await submit(directory, {
      scopeId: index.scopeId,
      action: "update",
      id: "S0001",
      expectedRevision: 1,
      kind: "selection",
      mode: "source",
      material: "M0001",
      purpose: "translation",
      ...verification
    });
    assert.equal((await query(directory)).items[0]?.text, "原始文本");
    const historical = await query(directory, [
      "--id",
      "S0001",
      "--revision",
      "1"
    ]);
    assert.partialDeepStrictEqual(historical.items[0]?.detail, {
      material: "M0002",
      revision: 1
    });
    await submit(directory, {
      scopeId: index.scopeId,
      action: "update",
      id: "S0001",
      expectedRevision: 2,
      kind: "selection",
      mode: "authored",
      purpose: "narrative",
      refs: ["T0001", "T0003"],
      text: "adopted synthesis",
      ...verification
    });
    const authored = (await query(directory)).items[0]!;
    assert.equal(authored.text, "adopted synthesis");
    assert.equal(authored.ranges.length, 2);
    const authoredText = await textQuery(directory);
    assert.ok(authoredText.includes("adoption=authored"));
    assert.ok(authoredText.includes(JSON.stringify(authored, null, 2)));
    assert.ok(authoredText.includes('"fixture only; no media inspected"'));
    await submit(directory, {
      scopeId: index.scopeId,
      action: "revoke",
      id: "S0001",
      expectedRevision: 3
    });
    assert.equal((await query(directory)).adoption, "selection-required");
    assert.equal(
      (await query(directory, ["--id", "S0001"])).items[0]?.availability,
      "revoked"
    );
    assert.equal(
      (await query(directory, ["--id", "S0001", "--revision", "2"])).items[0]
        ?.revision,
      2
    );
    assert.equal((await query(directory)).adoption, "selection-required");
  }));

test("large multi-source catalogs, windows, raw entries and exact IDs use bounded deterministic projection in text and JSON", async () =>
  workspace(async (directory) => {
    const index = await complete(directory);
    const material = readyText(index);
    const cues = Array.from({ length: 700 }, (_, i) => ({
      id: `T${String(i + 1).padStart(4, "0")}`,
      start: i / 200,
      end: (i + 1) / 200,
      text: `raw-${i}`
    }));
    await writeFile(
      path.join(directory, material.payload.file),
      JSON.stringify(cues)
    );
    material.payload = await readFileDigest(directory, material.payload.file);
    material.cues = cues.map(({ id, start, end }) => ({ id, start, end }));
    await publishEvidence(directory, index);
    await assert.rejects(
      second(directory),
      (error) => error instanceof Error && error.message.includes("duplicate")
    );
    // Reuse the first material only; a deliberately colliding helper publication is rejected atomically.
    assert.equal((await loadEvidence(directory)).materials.length, 1);
    const first = await query(directory, ["--view", "raw", "--limit", "80"]);
    assert.equal(first.items.length, 80);
    assert.equal(first.remaining, 620);
    assert.equal(
      (
        await query(directory, [
          "--view",
          "raw",
          "--limit",
          "80",
          "--offset",
          "80"
        ])
      ).items[0]?.id,
      "T0081"
    );
    await submit(
      directory,
      correction(
        index.scopeId,
        cues.map((c) => c.id),
        [{ start: 1, end: 2, text: "whole replacement" }]
      )
    );
    const own = await query(directory, ["--id", "C0001"]);
    assert.equal(own.items[0]?.refs.length, 700);
    assert.equal(own.related.length, 80);
    assert.equal(own.relatedRemaining, 620);
    assert.ok(!JSON.stringify(own.related).includes("raw-"));
    const text = formatQuery(own, index.materials);
    assert.ok(text.includes(JSON.stringify(own.items[0], null, 2)));
    const page = await query(directory, [
      "--view",
      "materials",
      "--limit",
      "1"
    ]);
    assert.ok(!JSON.stringify(page).includes("T0001"));
  }));
