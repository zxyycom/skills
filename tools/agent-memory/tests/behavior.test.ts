import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { edge, entries, fixture, id, memory } from "./fixtures.ts";

test("project binding rejects wrong roots and never creates a database on recall", async (t) => {
  const { ok, reject, save, dir, root, other, db } = await fixture(t);
  const memoryId = await save(memory("root", "第一项目"));
  const otherDb = join(dir, "other.sqlite");
  await reject("recall", { terms: ["第一项目"] }, other, otherDb);
  assert.equal(existsSync(otherDb), false);
  await ok("init", {}, other, otherDb);
  assert.deepEqual(
    (await ok("recall", { terms: ["第一项目"] }, other, otherDb)).items,
    []
  );
  await ok("save", memory("other", "第二项目"), other, otherDb);
  await reject("recall", { terms: ["第一项目"] }, other, db);
  await reject("recall", { terms: ["第二项目"] }, root, otherDb);
  await reject("show", { id: memoryId }, other, db);
  await reject("save", memory("wrong", "错库写入"), other, db);
  await reject("init", {}, other, db);
  const fileRoot = join(dir, "not-a-workspace.txt");
  const invalidDb = join(dir, "invalid.sqlite");
  writeFileSync(fileRoot, "synthetic fixture");
  await reject("init", {}, fileRoot, invalidDb);
  assert.equal(existsSync(invalidDb), false);
  assert.equal((await ok("show", { id: memoryId })).body, "第一项目正文");
  assert.deepEqual((await ok("recall", { terms: ["错库写入"] })).items, []);
});

test("recall deduplicates literal Chinese and exact tag matches before ranking", async (t) => {
  const { ok, save } = await fixture(t);
  const both = await save(
    memory("both", "中文认识", { tags: ["匹配"], body: "中文认识：新观察" })
  );
  const textOnly = await save(
    memory("text", "仅正文", { tags: ["匹配词"], body: "补充中文认识" })
  );
  const tagOnly = await save(memory("tag", "换个描述", { tags: ["匹配"] }));
  const clues = { terms: ["文认", "文认"], tags: ["匹配", "匹配"] };
  const result = await ok("recall", clues);
  const found = entries(result);
  assert.deepEqual(found.map(id), [both, ...[textOnly, tagOnly].sort()]);
  assert.equal(result.truncated, false);
  assert.equal(found[0]?.conditions, "测试条件");
  assert.deepEqual(
    found.map((item) =>
      Array.isArray(item.reasons) ? item.reasons.length : null
    ),
    [2, 1, 1]
  );
  assert.deepEqual(
    entries(await ok("recall", { tags: ["匹配"] }))
      .map(id)
      .sort(),
    [both, tagOnly].sort()
  );
  assert.deepEqual(
    entries(await ok("recall", { terms: ["文认"] }))
      .map(id)
      .sort(),
    [both, textOnly].sort()
  );
  const limited = await ok("recall", { ...clues, limit: 1 });
  assert.deepEqual(entries(limited).map(id), [both]);
  assert.equal(limited.truncated, true);
});

test("request replay, version conflicts and a failed batch leave no partial writes", async (t) => {
  const { ok, reject } = await fixture(t);
  const input = memory("original", "原前提");
  const original = await ok("save", input);
  assert.deepEqual(await ok("save", input), original);
  await reject("save", { ...input, body: "冲突内容" });
  const premise = id(original);
  assert.deepEqual(entries(await ok("recall", { terms: ["原前提"] })).map(id), [
    premise
  ]);
  const revision = {
    id: premise,
    requestId: "revision",
    expectedVersion: 2,
    reason: "纠正",
    semanticChange: true,
    body: "新前提"
  };
  await reject("revise", revision);
  const first = memory("unused-first", "分支甲", {
    edges: [edge(premise, 1, "splits")]
  });
  const second = memory("unused-second", "分支乙", {
    edges: [edge(premise, 1, "splits")]
  });
  const batch = { requestId: "atomic-split", items: [first, second] };
  await reject("save", { ...batch, items: [first, { ...second, body: "" }] });
  assert.deepEqual((await ok("recall", { terms: ["分支"] })).items, []);
  const after = await ok("show", { id: premise });
  assert.equal(after.status, "current");
  assert.equal(after.version, 1);
  assert.equal(after.body, "原前提正文");
  const split = await ok("save", batch);
  const successors = entries(split).map(id);
  assert.equal(successors.length, 2);
  assert.deepEqual(await ok("save", batch), split);
  assert.deepEqual(
    entries(await ok("recall", { terms: ["分支"] }))
      .map(id)
      .sort(),
    successors.sort()
  );
  assert.equal((await ok("show", { id: premise })).status, "blocked");
});

test("evolution cannot publish a new combination that its own write invalidates", async (t) => {
  const { ok, reject, save } = await fixture(t);
  const a = await save(memory("evolution-a", "演进前提"));
  const b = await save(memory("evolution-b", "中间依据", { edges: [edge(a)] }));
  await reject("save", {
    requestId: "self-invalidating-batch",
    items: [
      memory("unused-combined", "矛盾联合", { edges: [edge(b)] }),
      memory("unused-replacement", "矛盾替代", {
        edges: [edge(a, 1, "replaces")]
      })
    ]
  });
  assert.deepEqual((await ok("recall", { terms: ["矛盾"] })).items, []);
  assert.equal((await ok("show", { id: a })).status, "current");
  assert.equal((await ok("show", { id: b })).status, "current");
});

test("semantic corrections block transitive composition until review", async (t) => {
  const { ok, reject, save } = await fixture(t);
  const a = await save(memory("a", "前提"));
  const b = await save(memory("b", "中间", { edges: [edge(a)] }));
  const c = await save(memory("c", "结论", { edges: [edge(b)] }));
  const d = await save(memory("d", "另一分支", { edges: [edge(a)] }));
  const e = await save(memory("e", "双路结论", { edges: [edge(b), edge(d)] }));
  const related = await save(
    memory("related", "一般关联", { edges: [edge(a, 1, "supports")] })
  );
  const edit = {
    id: a,
    expectedVersion: 1,
    reason: "前提纠正",
    edges: [edge(c)]
  };
  await reject("revise", { ...edit, requestId: "cycle", semanticChange: true });
  await reject("review", {
    ...edit,
    requestId: "pending-cycle",
    outcome: "pending"
  });
  await ok("revise", {
    id: a,
    expectedVersion: 1,
    requestId: "correct",
    reason: "前提纠正",
    semanticChange: true,
    body: "新版前提"
  });
  const blocked = await ok("show", { id: c });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.body, undefined);
  assert.ok(Array.isArray(blocked.blockers) && blocked.blockers.includes(a));
  assert.deepEqual((await ok("recall", { terms: ["结论"] })).items, []);
  await reject(
    "save",
    memory("stale-combination", "不能组合", { edges: [edge(a)] })
  );
  await reject(
    "save",
    memory("indirect-combination", "不能间接组合", { edges: [edge(c)] })
  );
  assert.equal((await ok("show", { id: related })).status, "current");
  const history = await ok("show", { id: c, version: 1 });
  assert.equal(history.status, "historical");
  assert.equal(history.body, "结论正文");
  assert.equal(history.usable, false);
  assert.equal(entries(history, "edges")[0]?.target, b);
  const review = {
    id: b,
    expectedVersion: 1,
    reason: "含义不变",
    outcome: "unchanged",
    edges: [edge(a, 2)]
  };
  await ok("review", { ...review, requestId: "review-b" });
  await reject("review", { ...review, requestId: "outdated-review" });
  assert.equal((await ok("show", { id: c })).body, "结论正文");
  assert.equal((await ok("show", { id: e })).status, "blocked");
  await ok("review", {
    id: d,
    expectedVersion: 1,
    requestId: "review-d",
    reason: "含义改变",
    outcome: "changed",
    edges: [edge(a, 2)]
  });
  assert.equal((await ok("show", { id: d })).status, "current");
  const changed = await ok("show", { id: e });
  assert.equal(changed.status, "blocked");
  assert.deepEqual(changed.blockers, [d]);
  assert.deepEqual(entries(await ok("recall", { terms: ["结论"] })).map(id), [
    c
  ]);
});
