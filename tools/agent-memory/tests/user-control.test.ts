import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { edge, entries, fixture, id, memory } from "./fixtures.ts";

test("disable and hide preserve explicit history while blocking adoption", async (t) => {
  const { ok, save } = await fixture(t);
  const a = await save(memory("disable", "停用前提"));
  const b = await save(memory("dependent", "依赖解释", { edges: [edge(a)] }));
  const hidden = await save(memory("hide", "隐藏单元"));
  const dependent = await save(
    memory("hidden-dependent", "隐藏依赖", { edges: [edge(hidden)] })
  );
  for (const [target, action, state, title] of [
    [a, "disable", "disabled", "停用前提"],
    [hidden, "hide", "hidden", "隐藏单元"]
  ]) {
    let preview = await ok("forget", { id: target, action });
    assert.equal((await ok("show", { id: target })).body, `${title}正文`);
    let expectedVersion = 1;
    if (action === "hide") {
      await ok("review", {
        id: target,
        expectedVersion,
        requestId: "hidden-pending",
        outcome: "pending",
        reason: "暂候新证据"
      });
      preview = await ok("forget", { id: target, action });
      expectedVersion = 2;
    }
    await ok("forget", {
      id: target,
      requestId: `apply-${action}`,
      expectedVersion,
      action,
      confirm: preview.token
    });
    const hiddenHead = await ok("show", { id: target });
    assert.equal(hiddenHead.status, "blocked");
    assert.equal(hiddenHead.reason, state);
    assert.equal(hiddenHead.body, undefined);
    const history = await ok("show", { id: target, version: 1 });
    assert.equal(history.body, `${title}正文`);
    assert.equal(history.status, "historical");
    assert.equal(history.usable, false);
  }
  for (const target of [b, dependent]) {
    const shown = await ok("show", { id: target });
    assert.equal(shown.body, undefined);
  }
  assert.deepEqual(
    (await ok("recall", { terms: ["停用前提", "依赖解释", "隐藏"] })).items,
    []
  );
});

test("intent cancellation does not rewrite evidence and works after pending review", async (t) => {
  const { ok, reject, save } = await fixture(t);
  const evidence = await save(memory("evidence", "原证据"));
  const intent = await save(
    memory("intent", "回访意图", {
      kind: "intent",
      edges: [edge(evidence, 1, "supports")]
    })
  );
  assert.deepEqual(
    entries(await ok("recall", { terms: ["回访意图"] })).map(id),
    [intent]
  );
  const close = {
    id: intent,
    requestId: "cancel",
    outcome: "cancelled",
    reason: "不再需要"
  };
  await reject("close", { ...close, expectedVersion: 1, body: "覆盖证据" });
  await ok("review", {
    id: intent,
    expectedVersion: 1,
    requestId: "pending",
    outcome: "pending",
    reason: "待复核"
  });
  const closed = await ok("close", { ...close, expectedVersion: 2 });
  assert.equal((await ok("show", { id: intent })).reason, "cancelled");
  assert.deepEqual((await ok("recall", { terms: ["回访意图"] })).items, []);
  const history = await ok("show", { id: intent, version: closed.version });
  assert.equal(history.body, "回访意图正文");
  assert.equal(history.reason, "不再需要");
  assert.equal(entries(history, "edges")[0]?.target, evidence);
  assert.equal((await ok("show", { id: evidence })).body, "原证据正文");
});

function assertNoStoredText(
  dbPath: string,
  forbidden: readonly string[]
): void {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    // Cover all controlled data tables, including future indexes with stored text, without requiring a storage layout.
    const tables = db
      .prepare(
        "SELECT name FROM pragma_table_list WHERE schema = 'main' AND name NOT GLOB 'sqlite_*' AND type != 'view'"
      )
      .all();
    for (const { name } of tables) {
      assert.ok(typeof name === "string");
      const quotedName = name.replaceAll('"', '""');
      const contents = JSON.stringify(
        db.prepare(`SELECT * FROM "${quotedName}"`).all()
      );
      for (const text of forbidden)
        assert.ok(!contents.includes(text), `retained ${text} in ${name}`);
    }
  } finally {
    db.close();
  }
}

test("purge preview includes historical dependants and rejects stale confirmation", async (t) => {
  const { ok, reject, save, db } = await fixture(t);
  // A caller-supplied request ID can itself contain a fragment of the deleted content.
  const original = memory("清除请求痕迹", "敏感样本", {
    body: "敏感样本正文：清除请求痕迹",
    source: "清除出处",
    tags: ["清除标签"]
  });
  const a = await save(original);
  const batch = {
    requestId: "partly-purged-batch",
    items: [
      memory("unused-history", "历史组合", { edges: [edge(a)] }),
      memory("unused-kept", "独立记录")
    ]
  };
  const [b, keep] = entries(await ok("save", batch)).map(id);
  assert.ok(b && keep);
  const c = await save(memory("purge-c", "间接组合", { edges: [edge(b)] }));
  await ok("revise", {
    id: b,
    expectedVersion: 1,
    requestId: "detach",
    reason: "清除说明",
    semanticChange: true,
    edges: []
  });
  const purge = { id: a, action: "purge" };
  const preview = await ok("forget", purge);
  assert.deepEqual(entries(preview, "units").map(id).sort(), [a, b, c].sort());
  assert.equal((await ok("show", { id: a })).body, original.body);
  const related = await save(
    memory("late-reference", "保留关联", {
      edges: [{ ...edge(a, 1, "supports"), role: "清除关联说明" }]
    })
  );
  await reject("forget", {
    ...purge,
    requestId: "stale-reference",
    confirm: preview.token
  });
  const withReference = await ok("forget", purge);
  assert.ok(
    entries(withReference, "removedReferences").some(
      (reference) => reference.id === related && reference.target === a
    )
  );
  await ok("revise", {
    id: b,
    expectedVersion: 2,
    requestId: "change-after-preview",
    reason: "更新历史组合",
    semanticChange: false,
    body: "预览后变更"
  });
  await reject("forget", {
    ...purge,
    requestId: "stale-version",
    confirm: withReference.token
  });
  const fresh = await ok("forget", purge);
  await ok("forget", {
    ...purge,
    requestId: "confirmed-purge",
    confirm: fresh.token
  });
  for (const target of [a, b, c]) {
    await reject("show", { id: target });
    await reject("show", { id: target, version: 1 });
  }
  assert.deepEqual((await ok("show", { id: related })).edges, []);
  assert.equal((await ok("show", { id: related })).body, "保留关联正文");
  await reject("save", original);
  await reject("save", batch);
  assert.deepEqual(
    (
      await ok("recall", {
        terms: ["敏感样本", "历史组合", "间接组合", "预览后变更"],
        tags: ["清除标签"]
      })
    ).items,
    []
  );
  assert.deepEqual(
    entries(await ok("recall", { terms: ["独立记录"] })).map(id),
    [keep]
  );
  assertNoStoredText(db, [
    "敏感样本",
    "历史组合",
    "间接组合",
    "清除出处",
    "清除标签",
    "清除说明",
    "清除关联说明",
    "清除请求痕迹",
    "预览后变更"
  ]);
});
