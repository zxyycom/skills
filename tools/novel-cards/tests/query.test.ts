import assert from "node:assert/strict";
import test from "node:test";
import { synchronize } from "../src/index.ts";
import { readSource } from "../src/source.ts";
import { expandCards } from "../src/query.ts";
import { cli, failure, markdown, project, put } from "./test-support.ts";

test("reference content requires explicit selection and cannot be a current child", async () => {
  await project(async (root) => {
    await put(root, "plan", markdown("plan", { sources: ["original"] }));
    await put(
      root,
      "original",
      markdown("original", {}, "REFERENCE_SECRET_CONTENT"),
      "reference"
    );
    await synchronize(root);
    const current = await cli(root, ["show", "plan"]);
    assert.equal(current.status, 0);
    assert.equal(current.stdout.includes("REFERENCE_SECRET_CONTENT"), false);
    const blocked = await cli(root, ["show", "original"]);
    assert.equal(blocked.status, 1);
    assert.match(blocked.stderr, /reference-read-required/u);
    const explicit = await cli(root, [
      "show",
      "original",
      "--include-reference"
    ]);
    assert.equal(explicit.status, 0);
    assert.match(explicit.stdout, /REFERENCE_SECRET_CONTENT/u);
    await put(
      root,
      "plan",
      markdown("plan", { kind: "summary", children: ["original"] })
    );
    await assert.rejects(readSource(root), failure("reference-child"));
  });
});

test("bounded expansion reports frontier and never automatically expands sources", async () => {
  await project(async (root) => {
    await put(
      root,
      "root",
      markdown("root", {
        kind: "summary",
        children: ["a", "b"],
        sources: ["source"]
      })
    );
    for (const id of ["a", "b", "source"]) await put(root, id, markdown(id));
    const source = await readSource(root);
    const depth = expandCards(source.records, "root", {
      includeReference: false,
      depth: 0,
      maxCards: 100
    });
    assert.equal(depth.complete, false);
    assert.deepEqual(depth.frontier, [
      { fromId: "root", nextIds: ["a", "b"], reason: "depth" }
    ]);
    const budget = expandCards(source.records, "root", {
      includeReference: false,
      depth: 1,
      maxCards: 2
    });
    assert.deepEqual(
      budget.cards.map((record) => record.card.id),
      ["root", "a"]
    );
    assert.deepEqual(budget.frontier, [
      { fromId: "root", nextIds: ["b"], reason: "max-cards" }
    ]);
    const full = expandCards(source.records, "root", {
      includeReference: false,
      depth: 1,
      maxCards: 3
    });
    assert.equal(full.complete, true);
    assert.equal(full.cards.length, 3);
    assert.deepEqual(full.cards[0]?.card.sources, ["source"]);
  });
});

test("shared children already returned by another path do not create false frontier", async () => {
  await project(async (root) => {
    await put(
      root,
      "root",
      markdown("root", { kind: "summary", children: ["a", "b"] })
    );
    await put(root, "a", markdown("a", { kind: "summary", children: ["b"] }));
    await put(root, "b", markdown("b"));
    const source = await readSource(root);
    const depth = expandCards(source.records, "root", {
      includeReference: false,
      depth: 1,
      maxCards: 100
    });
    assert.equal(depth.complete, true);
    assert.deepEqual(depth.frontier, []);
    assert.deepEqual(
      depth.cards.map((record) => record.card.id),
      ["root", "a", "b"]
    );
    const budget = expandCards(source.records, "root", {
      includeReference: false,
      depth: 2,
      maxCards: 3
    });
    assert.equal(budget.complete, true);
    assert.deepEqual(budget.frontier, []);
    await put(root, "b", markdown("b", { kind: "summary", children: ["c"] }));
    await put(root, "c", markdown("c"));
    const changed = await readSource(root);
    for (const limits of [
      { depth: 1, max: 100, reason: "depth" },
      { depth: 2, max: 3, reason: "max-cards" }
    ]) {
      const partial = expandCards(changed.records, "root", {
        includeReference: false,
        depth: limits.depth,
        maxCards: limits.max
      });
      assert.equal(partial.complete, false);
      assert.deepEqual(partial.frontier, [
        { fromId: "b", nextIds: ["c"], reason: limits.reason }
      ]);
    }
    await put(
      root,
      "root",
      markdown("root", { kind: "summary", children: ["a", "b@1"] })
    );
    const aliases = expandCards((await readSource(root)).records, "root", {
      includeReference: false,
      depth: 2,
      maxCards: 3
    });
    assert.equal(aliases.cards.length, 3);
    assert.deepEqual(aliases.frontier, [
      { fromId: "b@1", nextIds: ["c"], reason: "max-cards" }
    ]);
  });
});
