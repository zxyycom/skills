import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  edge,
  entries,
  fixture,
  id,
  memory,
  memoryContent
} from "./fixtures.ts";

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
  await reject("recall", { terms: ["第一项目"] }, other, db);
  await reject("save", memory("wrong", "错库写入"), other, db);
  await reject("init", {}, other, db);
  const inProject = join(root, "internal.sqlite");
  assert.match(
    await reject("init", {}, root, inProject),
    /outside the project/u
  );
  assert.equal(existsSync(inProject), false);
  const fileRoot = join(dir, "not-a-workspace.txt");
  const invalidDb = join(dir, "invalid.sqlite");
  writeFileSync(fileRoot, "synthetic fixture");
  await reject("init", {}, fileRoot, invalidDb);
  assert.match(
    await reject("init", { extra: true }, root, invalidDb),
    /unknown field/u
  );
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

test("request replay and version conflicts protect single and batch writes", async (t) => {
  const { ok, reject } = await fixture(t);
  const input = memory("original", "原前提");
  const original = await ok("save", input);
  assert.deepEqual(await ok("save", input), original);
  assert.match(
    await reject("save", { ...input, body: "冲突内容" }),
    /request ID conflict/u
  );
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
  assert.match(await reject("revise", revision), /version conflict/u);
  const first = memoryContent("分支甲", {
    edges: [edge(premise, 1, "splits")]
  });
  const second = memoryContent("分支乙", {
    edges: [edge(premise, 1, "splits")]
  });
  const batch = { requestId: "atomic-split", items: [first, second] };
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

test("unknown fields cannot create or revise memories", async (t) => {
  const { ok, reject } = await fixture(t);
  const input = memory("typo-save", "待保存");
  assert.match(await reject("save", { ...input, edegs: [] }), /unknown field/u);
  assert.deepEqual((await ok("recall", { terms: ["待保存"] })).items, []);
  const saved = await ok("save", input);
  const update = { id: id(saved), expectedVersion: 1, reason: "修正" };
  const revision = {
    ...update,
    requestId: "typo-revise",
    semanticChange: true
  };
  assert.match(
    await reject("revise", { ...revision, boby: "修订正文" }),
    /unknown field/u
  );
  const review = { ...update, requestId: "typo-review", outcome: "changed" };
  assert.match(
    await reject("review", { ...review, boby: "复核正文" }),
    /unknown field/u
  );
  const current = await ok("show", { id: update.id });
  assert.equal(current.version, 1);
  assert.equal(current.body, "待保存正文");
  const edited = await ok("revise", { ...revision, body: "修订正文" });
  assert.equal(edited.version, 2);
  const reviewed = await ok("review", {
    ...review,
    expectedVersion: 2,
    body: "复核正文"
  });
  assert.equal(reviewed.version, 3);
  assert.match(
    await reject("save", { ...input, edegs: [] }),
    /request ID conflict/u
  );
});

test("unknown batch or edge fields cannot partially commit a split", async (t) => {
  const { ok, reject, save } = await fixture(t);
  const original = await save(memory("original", "原认识"));
  const link = edge(original, 1, "splits");
  const first = memoryContent("分支甲", { edges: [link] });
  const second = memoryContent("分支乙", { edges: [link] });
  const batch = { requestId: "typo-batch", items: [first, second] };
  for (const invalid of [
    { ...batch, tags: ["不能添加到批次外层"] },
    { ...batch, items: [first, { ...second, requestId: "misplaced" }] },
    {
      ...batch,
      items: [first, { ...second, edges: [{ ...link, roel: "拆分" }] }]
    },
    { ...batch, items: [first, { ...second, constructor: "未知" }] }
  ]) {
    assert.match(await reject("save", invalid), /unknown field/u);
  }
  assert.equal((await ok("show", { id: original })).status, "current");
  assert.deepEqual((await ok("recall", { terms: ["分支"] })).items, []);
  assert.equal(entries(await ok("save", batch)).length, 2);
  assert.equal((await ok("show", { id: original })).reason, "superseded");
});

test("evolution cannot publish a new combination that its own write invalidates", async (t) => {
  const { ok, reject, save } = await fixture(t);
  const a = await save(memory("evolution-a", "演进前提"));
  const b = await save(memory("evolution-b", "中间依据", { edges: [edge(a)] }));
  const replacement = memoryContent("矛盾替代", {
    edges: [edge(a, 1, "replaces")]
  });
  const batch = {
    requestId: "self-invalidating-batch",
    items: [memoryContent("矛盾联合", { edges: [edge(b)] }), replacement]
  };
  assert.match(
    await reject("save", batch),
    /save would create an unusable unit/u
  );
  assert.deepEqual((await ok("recall", { terms: ["矛盾"] })).items, []);
  assert.equal((await ok("show", { id: a })).status, "current");
  assert.equal((await ok("show", { id: b })).status, "current");
  assert.equal(
    entries(await ok("save", { ...batch, items: [replacement] })).length,
    1
  );
  assert.equal((await ok("show", { id: a })).reason, "superseded");
});

test("input validation rejects lossy text and mis-typed fields before saving", async (t) => {
  const { ok, reject } = await fixture(t);
  const item = memoryContent("测试编解码");
  const batch = { requestId: "invalid-content", items: [item] };
  assert.match(
    await reject("save", { ...batch, items: [{ ...item, reason: {} }] }),
    /items\[0\]\.reason.*string/u
  );
  assert.match(
    await reject("save", {
      ...batch,
      items: [{ ...item, body: "甲\uD800乙" }]
    }),
    /items\[0\]\.body.*Unicode/u
  );
  assert.deepEqual((await ok("recall", { terms: ["测试编解码"] })).items, []);
  const [saved] = entries(await ok("save", batch));
  assert.ok(saved);
  assert.equal((await ok("show", { id: id(saved) })).reason, "");

  const nullable = memory("overflow", "可空标签", { tags: null });
  await ok("save", nullable);
  assert.match(
    await reject(
      "save",
      JSON.stringify(nullable).replace('"tags":null', '"tags":1e400')
    ),
    /request ID conflict/u
  );
});

test("query input rejects misspelled controls without echoing unknown keys", async (t) => {
  const { reject, save } = await fixture(t);
  const unit = await save(memory("query", "待查询"));
  const diagnostic = await reject("show", { id: unit, verison: 1 });
  assert.match(diagnostic, /unknown field/u);
  assert.doesNotMatch(diagnostic, /verison/u);
  assert.match(
    await reject("recall", { terms: ["待查询"], limti: 1 }),
    /unknown field/u
  );
  assert.match(await reject("recall", "{"), /not valid JSON/u);
});

test("text-only revision retains a still-usable exact premise version", async (t) => {
  const { ok, reject, save } = await fixture(t);
  const premise = await save(memory("premise-version", "原前提"));
  const dependent = await save(
    memory("retaining", "组合", { edges: [edge(premise)] })
  );
  const update = { id: premise, expectedVersion: 1, reason: "更正文字" };
  await ok("revise", {
    ...update,
    requestId: "same-meaning",
    semanticChange: false
  });
  const edit = {
    id: dependent,
    expectedVersion: 1,
    reason: "补充表述",
    semanticChange: false
  };
  await ok("revise", { ...edit, requestId: "retain-current" });
  const current = await ok("show", { id: dependent });
  assert.equal(current.version, 2);
  assert.equal(entries(current, "edges")[0]?.target_version, 1);
  await ok("revise", {
    ...update,
    expectedVersion: 2,
    requestId: "changed-premise",
    semanticChange: true
  });
  assert.match(
    await reject("revise", {
      ...edit,
      expectedVersion: 2,
      requestId: "stale-retained"
    }),
    /revision would create an unusable unit/u
  );
  await reject("show", { id: dependent, version: 3 });
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
  assert.match(
    await reject("revise", {
      ...edit,
      requestId: "cycle",
      semanticChange: true
    }),
    /composition cycle/u
  );
  assert.match(
    await reject("review", {
      ...edit,
      requestId: "pending-cycle",
      outcome: "pending"
    }),
    /composition cycle/u
  );
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
