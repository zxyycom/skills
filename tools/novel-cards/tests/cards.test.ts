import assert from "node:assert/strict";
import test from "node:test";
import {
  CardFailure,
  parseCard,
  validateCards,
  type CardRecord
} from "../src/card.ts";
import { currentSource, synchronize } from "../src/index.ts";
import { readSource } from "../src/source.ts";
import { selectCard, expandCards } from "../src/query.ts";
import { cli, failure, markdown, project, put } from "./test-support.ts";

test("valid recursive cards preserve future planning, sources-only summaries, relationships and time", async () => {
  await project(async (root) => {
    await put(
      root,
      "story",
      markdown("story", {
        kind: "summary",
        status: "mixed",
        children: ["chapter", "future"]
      })
    );
    await put(
      root,
      "chapter",
      markdown("chapter", { kind: "summary", children: ["scene"] })
    );
    await put(
      root,
      "scene",
      markdown("scene", {
        status: "occurred",
        story_time: "第二日",
        narrative_position: "倒叙开场",
        sources: ["story"]
      })
    );
    await put(
      root,
      "future",
      markdown("future", { kind: "summary", completeness: "planned" })
    );
    await put(
      root,
      "history",
      markdown("history", {
        domain: "history",
        kind: "summary",
        status: "mixed",
        sources: ["scene", "future"]
      })
    );
    await put(
      root,
      "alice",
      markdown("alice", {
        domain: "character",
        state_at: "scene",
        relations: [
          {
            target: "bob",
            relation: "盟友",
            attitude: "信任",
            knowledge: "不知道隐瞒"
          }
        ]
      })
    );
    await put(
      root,
      "bob",
      markdown("bob", {
        domain: "character",
        state_at: "scene",
        relations: [
          {
            target: "alice",
            relation: "盟友",
            attitude: "警惕",
            knowledge: "知道隐瞒"
          }
        ]
      })
    );
    await put(
      root,
      "setting",
      markdown("setting", {
        domain: "setting",
        state_at: "scene",
        sources: ["history"]
      })
    );
    assert.equal((await synchronize(root)).status, "ok");
    const source = await currentSource(root);
    assert.equal(source.records.length, 8);
    assert.deepEqual(
      selectCard(source.records, "alice", false).card.relations,
      [
        {
          target: "bob",
          relation: "盟友",
          attitude: "信任",
          knowledge: "不知道隐瞒"
        }
      ]
    );
    assert.deepEqual(selectCard(source.records, "bob", false).card.relations, [
      {
        target: "alice",
        relation: "盟友",
        attitude: "警惕",
        knowledge: "知道隐瞒"
      }
    ]);
    assert.equal(
      selectCard(source.records, "history", false).card.children.length,
      0
    );
    assert.deepEqual(
      selectCard(source.records, "history", false).card.sources,
      ["scene", "future"]
    );
    assert.equal(
      selectCard(source.records, "scene", false).card.story_time,
      "第二日"
    );
    assert.equal(
      expandCards(source.records, "history", {
        includeReference: false,
        depth: 1,
        maxCards: 10
      }).cards.length,
      1
    );
    const result = await cli(root, ["check"]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /"semanticReview":"not-proven"/u);
  });
});

test("all managed reference forms require real IDs and typed anchors", async () => {
  await project(async (root) => {
    for (const fields of [
      { sources: ["missing"] },
      { refs: ["missing"] },
      { kind: "summary", children: ["missing"] },
      { domain: "character", state_at: "missing" },
      {
        domain: "character",
        state_at: "anchor",
        relations: [
          {
            target: "missing",
            relation: "盟友",
            attitude: "信任",
            knowledge: "未知"
          }
        ]
      }
    ]) {
      await put(root, "anchor", markdown("anchor"));
      await put(root, "card", markdown("card", fields));
      await assert.rejects(readSource(root), failure("missing-reference"));
    }
    await put(
      root,
      "card",
      markdown("card", {}, "正文 [不存在](card:missing)")
    );
    await assert.rejects(readSource(root), failure("missing-reference"));
    for (const target of ["", " ", "bad id", "BAD", "../anchor.md"]) {
      await put(
        root,
        "card",
        markdown("card", {}, `正文 [错误](card:${target})`)
      );
      await assert.rejects(readSource(root), failure("card-format"));
    }
    await put(
      root,
      "card",
      markdown(
        "card",
        {},
        "正文 [实际](card:anchor)\n`[实际](card:anchor)`\n[外部](https://example.invalid) [[missing]] 自然语言 card:missing"
      )
    );
    const valid = await readSource(root);
    assert.deepEqual(selectCard(valid.records, "card", false).explicitRefs, [
      "anchor",
      "anchor"
    ]);
    await put(
      root,
      "anchor",
      markdown("anchor", { domain: "character", state_at: "plot" })
    );
    await put(root, "plot", markdown("plot"));
    await put(
      root,
      "card",
      markdown("card", { domain: "setting", state_at: "anchor" })
    );
    await assert.rejects(readSource(root), failure("state-anchor"));
    await put(
      root,
      "card",
      markdown("card", {
        domain: "character",
        state_at: "plot",
        relations: [
          {
            target: "plot",
            relation: "同伴",
            attitude: "好感",
            knowledge: "不知"
          }
        ]
      })
    );
    await assert.rejects(readSource(root), failure("relation-target"));
  });
});

test("children cycles are rejected while deep acyclic card hierarchies remain valid", () => {
  const records: CardRecord[] = Array.from({ length: 120 }, (_, index) => {
    const id = `node-${index}`;
    return {
      card: parseCard(
        markdown(id, {
          kind: "summary",
          children: index < 119 ? [`node-${index + 1}`] : []
        }),
        id
      ),
      area: "current",
      sourcePath: `${id}.md`,
      markdown: "",
      explicitRefs: []
    };
  });
  assert.doesNotThrow(() => validateCards(records));
  const first = records[0];
  const last = records.at(-1);
  assert.ok(first && last);
  const cyclic = records.map((record) =>
    record === last
      ? {
          ...last,
          card: parseCard(
            markdown(last.card.id, {
              kind: "summary",
              children: [first.card.id]
            }),
            last.sourcePath
          )
        }
      : record
  );
  assert.throws(() => validateCards(cyclic), failure("children-cycle"));
});

test("card schema rejects malformed metadata and keeps occurrence distinct from completeness", () => {
  for (const fields of [
    { extra: true },
    { status: "future" },
    { kind: "detail", status: "mixed" },
    { domain: "history" },
    { domain: "setting" },
    { children: ["child"] },
    { sources: ["a", "a"] },
    { relations: [] }
  ]) {
    assert.throws(
      () => parseCard(markdown("card", fields), "card.md"),
      CardFailure
    );
  }
  assert.equal(
    parseCard(
      markdown("future", { kind: "summary", completeness: "expanded" }),
      "future.md"
    ).status,
    "expected"
  );
  assert.equal(
    parseCard(
      markdown("past", { status: "occurred", completeness: "planned" }),
      "past.md"
    ).completeness,
    "planned"
  );
  assert.throws(
    () => parseCard("plain text", "card.md"),
    failure("card-format")
  );
  assert.throws(
    () => parseCard(markdown("empty", {}, ""), "empty.md"),
    failure("card-format")
  );
});
