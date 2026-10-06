import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import * as v from "valibot";
import { applyTransition } from "../src/apply-transition.ts";
import { currentSource, synchronize } from "../src/index.ts";
import { readSource } from "../src/source.ts";
import { selectCard } from "../src/query.ts";
import {
  cli,
  cliValue,
  failure,
  markdown,
  project,
  put
} from "./test-support.ts";

import {
  stateProject,
  transition,
  batchFile,
  updates,
  firstChange
} from "./history-support.ts";

const historySchema = v.object({
  excluded: v.array(v.string()),
  transitions: v.array(
    v.object({
      id: v.string(),
      version: v.number(),
      mode: v.picklist(["evolution", "revision"]),
      status: v.picklist(["occurred", "expected"]),
      changes: v.array(v.object({ before: v.string(), after: v.string() }))
    })
  )
});
const expansionSchema = v.object({
  complete: v.boolean(),
  cards: v.array(
    v.object({ card: v.object({ id: v.string(), version: v.number() }) })
  ),
  frontier: v.array(
    v.object({
      fromId: v.string(),
      nextIds: v.array(v.string()),
      reason: v.picklist(["depth", "max-cards"])
    })
  )
});

test("one transition applies cross-entity versions and preserves complete snapshots after archive moves", async () => {
  await project(async (root) => {
    await stateProject(root);
    const original = selectCard(
      (await readSource(root)).records,
      "hero",
      false
    ).markdown;
    const input = await batchFile(root, transition(), updates());
    assert.equal(
      (await cli(root, ["apply-transition", "--input", input])).status,
      2
    );
    assert.equal((await readSource(root)).records.length, 3);
    assert.equal(
      (await cli(root, ["apply-transition", "--input", input, "--write"]))
        .status,
      0
    );
    const source = await currentSource(root);
    assert.equal(selectCard(source.records, "hero", false).card.version, 2);
    assert.equal(
      selectCard(source.records, "hero@1", false).markdown,
      original
    );
    assert.equal(selectCard(source.records, "gate@1", false).area, "snapshot");
    const history = await cli(root, ["history", "hero"]);
    assert.equal(history.status, 0);
    assert.match(history.stdout, /hero@1/u);
    assert.match(history.stdout, /gate@2/u);
    const eventHistory = await cli(root, ["history", "event@1"]);
    assert.match(eventHistory.stdout, /handover/u);
    assert.match(
      (await cli(root, ["history", "handover"])).stdout,
      /"mode":"evolution"/u
    );
    await fs.mkdir(path.join(root, "history/snapshots/older"));
    await fs.rename(
      path.join(root, "history/snapshots/hero-v1.md"),
      path.join(root, "history/snapshots/older/renamed.md")
    );
    await assert.rejects(currentSource(root), failure("index-invalid"));
    await synchronize(root);
    assert.equal(
      selectCard((await currentSource(root)).records, "hero@1", false).markdown,
      original
    );
  });
});

test("author revision supersedes whole story edges without presenting corrections as experiences", async () => {
  await project(async (root) => {
    await firstChange(root);
    const corrections = updates(3);
    const record = transition("correction", 1, {
      mode: "revision",
      events: [],
      supersedes: ["handover@1"],
      changes: [
        { before: "hero@2", after: "hero@3" },
        { before: "gate@2", after: "gate@3" }
      ]
    });
    assert.equal(
      (
        await cli(root, [
          "apply-transition",
          "--input",
          await batchFile(root, record, corrections),
          "--write"
        ])
      ).status,
      0
    );
    const result = v.parse(
      historySchema,
      await cliValue(root, ["history", "hero"])
    );
    assert.deepEqual(
      result.transitions.map((entry) => entry.id),
      ["correction"]
    );
    assert.equal(result.transitions[0]?.mode, "revision");
    assert.deepEqual(result.excluded, ["handover@1"]);
    assert.equal(
      selectCard((await currentSource(root)).records, "hero@2", false).area,
      "snapshot"
    );
    assert.equal((await cli(root, ["show", "handover@1"])).status, 0);
    const replacement = transition("handover", 2, {
      changes: [
        { before: "hero@1", after: "hero@3" },
        { before: "gate@1", after: "gate@3" }
      ]
    });
    assert.equal(
      (
        await cli(root, [
          "apply-transition",
          "--input",
          await batchFile(root, replacement),
          "--write"
        ])
      ).status,
      0
    );
    const revised = v.parse(
      historySchema,
      await cliValue(root, ["history", "hero"])
    );
    assert.equal(
      revised.transitions.find((entry) => entry.id === "handover")?.version,
      2
    );
    assert.equal(
      selectCard((await currentSource(root)).records, "handover@1", false).area,
      "snapshot"
    );
  });
});

test("withdrawing a transition archives its prior record and removes its current query effect", async () => {
  await project(async (root) => {
    await firstChange(root);
    const input = await batchFile(
      root,
      transition("handover", 2, { lifecycle: "withdrawn" })
    );
    assert.equal(
      (await cli(root, ["apply-transition", "--input", input, "--write"]))
        .status,
      0
    );
    const result = v.parse(
      historySchema,
      await cliValue(root, ["history", "hero"])
    );
    assert.deepEqual(result.transitions, []);
    assert.equal(
      selectCard((await currentSource(root)).records, "handover@1", false).card
        .transition?.lifecycle,
      "active"
    );
    assert.equal(
      selectCard((await currentSource(root)).records, "hero", false).card
        .version,
      2,
      "withdrawal does not secretly restore states"
    );
  });
});

test("future planning cannot overwrite occurred objects or serve as an occurred evolution event", async () => {
  await project(async (root) => {
    await stateProject(root);
    const before = await fs.readFile(path.join(root, "card-index.json"));
    const future = updates().map((update) => ({
      ...update,
      markdown: update.markdown.replace("status: occurred", "status: expected")
    }));
    const result = await cli(root, [
      "apply-transition",
      "--input",
      await batchFile(root, transition(), future),
      "--write"
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /预期不能覆盖/u);
    assert.deepEqual(
      await fs.readFile(path.join(root, "card-index.json")),
      before
    );
    await put(root, "future", markdown("future"));
    await synchronize(root);
    const event = await cli(root, [
      "apply-transition",
      "--input",
      await batchFile(
        root,
        transition("future-change", 1, { events: ["future@1"] }),
        updates()
      ),
      "--write"
    ]);
    assert.equal(event.status, 1);
    assert.match(event.stderr, /预期事件/u);
    assert.equal(
      selectCard((await currentSource(root)).records, "hero", false).card
        .version,
      1
    );
  });
});

test("version identities and historical endpoints reject duplicates mismatches and unlocked refs", async () => {
  await project(async (root) => {
    await firstChange(root);
    await fs.copyFile(
      path.join(root, "history/snapshots/hero-v1.md"),
      path.join(root, "history/snapshots/duplicate.md")
    );
    await assert.rejects(readSource(root), failure("duplicate-id"));
    await fs.unlink(path.join(root, "history/snapshots/duplicate.md"));
    for (const changes of [
      [{ before: "hero", after: "hero@2" }],
      [{ before: "hero@1", after: "gate@2" }],
      [{ before: "hero@2", after: "hero@1" }]
    ]) {
      assert.equal(
        (
          await cli(root, [
            "apply-transition",
            "--input",
            await batchFile(root, transition("invalid", 1, { changes })),
            "--write"
          ])
        ).status,
        1
      );
    }
    await put(
      root,
      "locked",
      markdown("locked", {}, "看 [原始状态](card:hero@1)")
    );
    await synchronize(root);
    assert.deepEqual(
      selectCard((await currentSource(root)).records, "locked", false)
        .explicitRefs,
      ["hero@1"]
    );
    assert.equal((await cli(root, ["show", "hero@1"])).status, 0);
  });
});

test("snapshot output distinguishes unqualified current refs and rejects unproven historical expansion", async () => {
  await project(async (root) => {
    await put(root, "event", markdown("event", { status: "occurred" }));
    await put(
      root,
      "summary",
      markdown("summary", {
        kind: "summary",
        status: "occurred",
        children: ["event"]
      })
    );
    await fs.mkdir(path.join(root, "history/snapshots"), { recursive: true });
    await fs.writeFile(
      path.join(root, "history/snapshots/old-summary.md"),
      markdown("summary", {
        version: 1,
        kind: "summary",
        status: "occurred",
        children: ["event"]
      })
    );
    await put(
      root,
      "summary",
      markdown("summary", {
        version: 2,
        kind: "summary",
        status: "occurred",
        children: ["event"]
      })
    );
    await synchronize(root);
    const shown = await cli(root, ["show", "summary@1"]);
    assert.match(shown.stdout, /snapshot-unqualified-current-not-historical/u);
    const expanded = await cli(root, ["expand", "summary@1"]);
    assert.equal(expanded.status, 1);
    assert.match(expanded.stderr, /历史闭包/u);
  });
});

test("expected author corrections preserve occurred history until explicitly applied", async () => {
  await project(async (root) => {
    await firstChange(root);
    const expected = transition("planned-fix", 1, {
      mode: "revision",
      events: [],
      supersedes: ["handover@1"]
    }).replace("status: occurred", "status: expected");
    assert.equal(
      (
        await cli(root, [
          "apply-transition",
          "--input",
          await batchFile(root, expected),
          "--write"
        ])
      ).status,
      0
    );
    const plannedHistory = v.parse(
      historySchema,
      await cliValue(root, ["history", "hero"])
    );
    assert.deepEqual(plannedHistory.excluded, []);
    assert.deepEqual(
      plannedHistory.transitions.map((entry) => entry.id),
      ["handover", "planned-fix"]
    );
    assert.equal(plannedHistory.transitions[1]?.status, "expected");
    const replacePast = transition("handover", 2).replace(
      "status: occurred",
      "status: expected"
    );
    assert.equal(
      (
        await cli(root, [
          "apply-transition",
          "--input",
          await batchFile(root, replacePast),
          "--write"
        ])
      ).status,
      1
    );
    const applied = transition("planned-fix", 2, {
      mode: "revision",
      events: [],
      supersedes: ["handover@1"]
    });
    assert.equal(
      (
        await cli(root, [
          "apply-transition",
          "--input",
          await batchFile(root, applied),
          "--write"
        ])
      ).status,
      0
    );
    const actualHistory = v.parse(
      historySchema,
      await cliValue(root, ["history", "hero"])
    );
    assert.deepEqual(actualHistory.excluded, ["handover@1"]);
    assert.deepEqual(
      actualHistory.transitions.map((entry) => entry.id),
      ["planned-fix"]
    );
    assert.equal(actualHistory.transitions[0]?.status, "occurred");
    assert.equal(
      selectCard((await currentSource(root)).records, "planned-fix@1", false)
        .card.status,
      "expected"
    );
  });
});

test("expected author revisions cannot publish occurred object replacements", async () => {
  await project(async (root) => {
    await stateProject(root);
    const originalIndex = await fs.readFile(path.join(root, "card-index.json"));
    const plannedRevision = transition("planned-author-change", 1, {
      mode: "revision",
      events: []
    }).replace("status: occurred", "status: expected");
    const result = await cli(root, [
      "apply-transition",
      "--input",
      await batchFile(root, plannedRevision, updates()),
      "--write"
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /不能应用对象状态/u);
    assert.deepEqual(
      await fs.readFile(path.join(root, "card-index.json")),
      originalIndex
    );
    const source = await currentSource(root);
    assert.equal(source.records.length, 3);
    assert.equal(selectCard(source.records, "hero", false).card.version, 1);
    assert.equal(selectCard(source.records, "gate", false).card.version, 1);
  });
});

test("qualified current transition anchors resolve before and after versions without reviving old records", async () => {
  await project(async (root) => {
    await firstChange(root);
    const qualified = v.parse(
      historySchema,
      await cliValue(root, ["history", "handover@1"])
    );
    assert.equal(qualified.transitions.length, 1);
    assert.deepEqual(qualified.transitions[0]?.changes, [
      { before: "hero@1", after: "hero@2" },
      { before: "gate@1", after: "gate@2" }
    ]);
    await applyTransition(
      root,
      await batchFile(root, transition("handover", 2))
    );
    const old = v.parse(
      historySchema,
      await cliValue(root, ["history", "handover@1"])
    );
    assert.deepEqual(old.transitions, []);
    const current = v.parse(
      historySchema,
      await cliValue(root, ["history", "handover@2"])
    );
    assert.equal(current.transitions.length, 1);
    assert.equal(current.transitions[0]?.version, 2);
    assert.equal((await cli(root, ["show", "handover@1"])).status, 0);
  });
});

test("current summaries explicitly compose same-domain historical versions with bounded frontier and cycle checks", async () => {
  await project(async (root) => {
    await firstChange(root);
    await put(
      root,
      "stages",
      markdown("hero-stages", {
        kind: "summary",
        domain: "character",
        status: "mixed",
        children: ["hero@1", "hero@2"]
      })
    );
    await synchronize(root);
    const partial = v.parse(
      expansionSchema,
      await cliValue(root, [
        "expand",
        "hero-stages",
        "--depth",
        "1",
        "--max-cards",
        "2"
      ])
    );
    assert.equal(partial.complete, false);
    assert.deepEqual(
      partial.cards.map((record) => `${record.card.id}@${record.card.version}`),
      ["hero-stages@1", "hero@1"]
    );
    assert.deepEqual(partial.frontier, [
      { fromId: "hero-stages", nextIds: ["hero@2"], reason: "max-cards" }
    ]);
    const full = v.parse(
      expansionSchema,
      await cliValue(root, [
        "expand",
        "hero-stages",
        "--depth",
        "1",
        "--max-cards",
        "3"
      ])
    );
    assert.equal(full.complete, true);
    assert.equal(full.cards.length, 3);
    await put(
      root,
      "stages",
      markdown("hero-stages", {
        kind: "summary",
        domain: "character",
        status: "mixed",
        children: ["gate@1"]
      })
    );
    await assert.rejects(readSource(root), failure("child-domain"));
    await put(
      root,
      "stages",
      markdown("hero-stages", {
        version: 2,
        kind: "summary",
        domain: "character",
        status: "mixed",
        children: ["hero-stages@1"]
      })
    );
    await fs.writeFile(
      path.join(root, "history/snapshots/stages-v1.md"),
      markdown("hero-stages", {
        kind: "summary",
        domain: "character",
        status: "mixed",
        children: ["hero-stages@2"]
      })
    );
    await assert.rejects(readSource(root), failure("children-cycle"));
  });
});
