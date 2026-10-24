import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { complete, readyText } from "./fixtures/evidence-state.ts";
import { digest } from "../src/evidence.ts";
import { loadEvidence } from "../src/store.ts";
import { workspace } from "./fixtures/public-cli.ts";
import {
  verification,
  submit,
  query,
  textQuery,
  correction,
  second,
  frames,
  select
} from "./fixtures/refinement-state.ts";

test("N to M retiming, suppression and revoke leave raw bytes unchanged and return whole groups by replacement windows", async () =>
  workspace(async (directory) => {
    const index = await complete(directory);
    const rawPath = path.join(directory, readyText(index).payload.file);
    const before = digest(await readFile(rawPath));
    await submit(directory, correction(index.scopeId));
    assert.equal((await query(directory)).adoption, "unadopted-single-source");
    assert.equal((await query(directory)).items[0]?.kind, "transcript");
    await select(directory, index.scopeId);
    const narrow = await query(directory, [
      "--start",
      "3.7",
      "--end",
      "3.8",
      "--limit",
      "1"
    ]);
    assert.equal(narrow.items.length, 1);
    assert.equal(narrow.items[0]?.segments?.length, 3);
    assert.equal(narrow.items[0]?.text, "one\ntwo\nthree");
    assert.equal(narrow.items[0]?.originalRanges?.length, 2);
    const narrowText = await textQuery(directory, [
      "--start",
      "3.7",
      "--end",
      "3.8",
      "--limit",
      "1"
    ]);
    assert.ok(narrowText.includes(JSON.stringify(narrow.items[0], null, 2)));
    assert.ok(narrowText.includes("adoption=selected-source"));
    assert.ok(narrowText.includes('selection={"id":"S0001","revision":1'));
    assert.ok(narrowText.includes("fixture rationale"));
    assert.deepEqual(
      (
        await query(directory, ["--view", "raw", "--material", "M0001"])
      ).items.map((i) => i.text),
      ["原始文本", "第二段"]
    );
    await submit(directory, {
      ...correction(index.scopeId, ["T0001", "T0002"], []),
      action: "update",
      id: "C0001",
      expectedRevision: 1
    });
    assert.equal((await query(directory)).items[0]?.suppressed, true);
    assert.ok((await textQuery(directory)).includes('"suppressed": true'));
    await submit(directory, {
      scopeId: index.scopeId,
      action: "revoke",
      id: "C0001",
      expectedRevision: 2
    });
    assert.equal((await query(directory)).items[0]?.text, "原始文本");
    assert.equal(
      (await query(directory, ["--id", "C0001", "--revision", "1"])).items[0]
        ?.segments?.length,
      3
    );
    assert.equal(digest(await readFile(rawPath)), before);
  }));

test("scope, raw references, material-local consecutive groups, time and active overlap are validated before publication", async () =>
  workspace(async (directory) => {
    const index = await complete(directory);
    await second(directory);
    await frames(directory);
    const draft = correction(index.scopeId);
    for (const invalid of [
      { ...draft, scopeId: randomUUID() },
      { ...draft, targets: ["T0002", "T0001"] },
      { ...draft, targets: ["T0002", "T0003"] },
      { ...draft, targets: ["T0001", "T0001"] },
      { ...draft, support: ["C0001"] },
      { ...draft, verified: { refs: ["T0999"], note: "bad" } },
      correction(
        index.scopeId,
        ["T0001"],
        [{ start: 2, end: 5, text: "outside" }]
      ),
      correction(
        index.scopeId,
        ["T0001"],
        [
          { start: 2, end: 3, text: "later" },
          { start: 1, end: 2, text: "earlier" }
        ]
      )
    ]) {
      const before = await readFile(path.join(directory, "evidence.json"));
      await assert.rejects(submit(directory, invalid));
      assert.deepEqual(
        await readFile(path.join(directory, "evidence.json")),
        before
      );
    }
    await submit(directory, { ...draft, support: ["T0003", "F0001"] });
    await assert.rejects(
      submit(directory, correction(index.scopeId, ["T0001"])),
      (error) => error instanceof Error && error.message.includes("overlaps")
    );
    await select(directory, index.scopeId);
    await assert.rejects(
      select(directory, index.scopeId, "M0002"),
      (error) => error instanceof Error && error.message.includes("overlaps")
    );
    await assert.rejects(
      submit(directory, {
        ...draft,
        action: "update",
        id: "C0001",
        expectedRevision: 2
      }),
      (error) =>
        error instanceof Error && error.message.includes("expectedRevision")
    );
    await assert.rejects(
      submit(directory, {
        scopeId: index.scopeId,
        action: "create",
        kind: "description",
        refs: ["F0001"],
        support: ["F0001"],
        text: "not valid support",
        ...verification
      })
    );
  }));

test("local frame, support and payload failures fall back; an unavailable selection never silently chooses another material", async () =>
  workspace(async (directory) => {
    const index = await complete(directory);
    await second(directory);
    await frames(directory);
    await submit(directory, {
      ...correction(index.scopeId),
      support: ["F0001"]
    });
    await select(directory, index.scopeId);
    const current = await loadEvidence(directory);
    await writeFile(
      path.join(directory, current.frames.entries[0]!.image.file),
      "damaged frame"
    );
    const fallback = await query(directory);
    assert.equal(
      fallback.items.find((i) => i.id === "T0001")?.text,
      "原始文本"
    );
    assert.ok(fallback.warnings[0].includes("C0001"));
    assert.equal(
      fallback.items.find((i) => i.id === "F0001")?.availability,
      "unavailable"
    );
    const fallbackText = await textQuery(directory);
    assert.ok(
      fallbackText.includes("C0001 unavailable; original fallback where valid")
    );
    assert.ok(fallbackText.includes('T0001 [0,2.125] "原始文本"'));
    assert.ok(
      fallbackText.includes(
        JSON.stringify(
          fallback.items.find((i) => i.id === "F0001"),
          null,
          2
        )
      )
    );
    assert.equal(
      (await query(directory, ["--id", "C0001"])).items[0]?.text,
      null
    );
    await writeFile(
      path.join(
        directory,
        current.refinements.find((p) => p.id === "S0001")!.payload.file
      ),
      "damaged selection"
    );
    assert.equal((await query(directory)).adoption, "unavailable");
    assert.equal(
      (await query(directory)).items.some((i) => i.text === "second source"),
      false
    );
    const unavailable = await query(directory);
    const unavailableText = await textQuery(directory);
    assert.ok(unavailableText.includes("adoption=unavailable"));
    assert.ok(unavailableText.includes("no automatic adoption fallback"));
    assert.ok(
      unavailableText.includes(
        JSON.stringify(
          unavailable.items.find((i) => i.id === "S0001"),
          null,
          2
        )
      )
    );
    assert.ok(!unavailableText.includes("second source"));
    assert.equal(
      (await query(directory, ["--view", "raw", "--material", "M0002"]))
        .items[0]?.text,
      "second source"
    );
    await submit(directory, {
      scopeId: index.scopeId,
      action: "update",
      id: "S0001",
      expectedRevision: 1,
      kind: "selection",
      mode: "source",
      material: "M0002",
      purpose: "transcript",
      ...verification
    });
    assert.equal((await query(directory)).items[0]?.text, "second source");
  }));
