import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  edge,
  entries,
  fixture,
  id,
  memory,
  memoryContent
} from "./fixtures.ts";

test("disable and hide preserve explicit history while blocking adoption", async (t) => {
  const { ok, reject, save } = await fixture(t);
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
    assert.match(
      await reject("forget", { id: target, action }),
      /unit is not active or pending/u
    );
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

test("visibility preview shows newly blocked current dependants, not historical ones", async (t) => {
  const { ok, reject, save } = await fixture(t);
  const base = await save(memory("base", "目标前提"));
  const live = await save(memory("live", "直接依赖", { edges: [edge(base)] }));
  const transitive = await save(
    memory("transitive", "间接依赖", { edges: [edge(live)] })
  );
  const detached = await save(
    memory("detached", "已解耦", { edges: [edge(base)] })
  );
  await ok("revise", {
    id: detached,
    expectedVersion: 1,
    requestId: "detach",
    reason: "已不构成前提",
    semanticChange: true,
    edges: []
  });
  const other = await save(memory("other", "另一前提"));
  const blocked = await save(
    memory("blocked", "还有别的前提", { edges: [edge(base), edge(other)] })
  );
  await ok("review", {
    id: other,
    expectedVersion: 1,
    requestId: "other-pending",
    outcome: "pending",
    reason: "等待复核"
  });
  for (const target of [base, live, transitive, detached]) {
    assert.equal((await ok("show", { id: target })).status, "current");
  }
  assert.equal((await ok("show", { id: blocked })).status, "blocked");
  for (const action of ["disable", "hide"]) {
    const preview = await ok("forget", { id: base, action });
    assert.deepEqual(
      entries(preview, "units").map(id),
      [base, live, transitive].sort()
    );
    assert.deepEqual(preview.removedReferences, []);
  }
  const hide = { id: base, action: "hide" };
  const stale = await ok("forget", hide);
  await ok("revise", {
    id: live,
    expectedVersion: 1,
    requestId: "live-revision",
    reason: "更新文字",
    semanticChange: false
  });
  const apply = { ...hide, requestId: "visibility", expectedVersion: 1 };
  assert.match(
    await reject("forget", { ...apply, confirm: stale.token }),
    /forget preview conflict/u
  );
  const fresh = await ok("forget", hide);
  await ok("forget", { ...apply, confirm: fresh.token });
  assert.match(
    await reject("forget", {
      ...apply,
      requestId: "new-attempt-with-old-token",
      confirm: fresh.token
    }),
    /forget preview conflict/u
  );
  for (const target of [base, live, transitive]) {
    assert.equal((await ok("show", { id: target })).status, "blocked");
  }
  assert.equal((await ok("show", { id: detached })).status, "current");
  assert.equal(
    (await ok("show", { id: detached, version: 1 })).status,
    "historical"
  );
  const stop = { id: blocked, action: "disable" };
  const preblocked = await ok("forget", stop);
  assert.deepEqual(entries(preblocked, "units").map(id), [blocked]);
  await ok("forget", {
    ...stop,
    requestId: "stop-already-blocked",
    expectedVersion: 1,
    confirm: preblocked.token
  });
  assert.equal((await ok("show", { id: blocked })).reason, "disabled");
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
      memoryContent("历史组合", { edges: [edge(a)] }),
      memoryContent("独立记录")
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

test("forget confirmation is bound to the target and action even for equal scopes", async (t) => {
  const { ok, reject, save } = await fixture(t);
  const a = await save(memory("target-a", "目标甲"));
  const b = await save(memory("target-b", "目标乙", { edges: [edge(a)] }));
  await ok("revise", {
    id: b,
    expectedVersion: 1,
    requestId: "detach-b",
    reason: "已不构成前提",
    semanticChange: true,
    edges: []
  });
  await ok("revise", {
    id: a,
    expectedVersion: 1,
    requestId: "attach-a",
    reason: "核对新前提",
    semanticChange: true,
    edges: [edge(b, 2)]
  });
  const first = await ok("forget", { id: a, action: "purge" });
  const request = { id: b, action: "purge", requestId: "confirmed" };
  assert.match(
    await reject("forget", { id: b, action: "purge", extra: true }),
    /unknown field/u
  );
  const second = await ok("forget", { id: b, action: "purge" });
  const hidden = await ok("forget", { id: b, action: "hide" });
  assert.deepEqual(first.units, second.units);
  assert.deepEqual(second.units, hidden.units);
  for (const preview of [first, hidden]) {
    assert.match(
      await reject("forget", { ...request, confirm: preview.token }),
      /forget preview conflict/u
    );
  }
  const valid = { ...request, expectedVersion: 2, confirm: second.token };
  assert.match(
    await reject("forget", { ...valid, confirmAction: "hide" }),
    /unknown field/u
  );
  assert.match(
    await reject("forget", { ...valid, expectedVersion: 1 }),
    /version conflict/u
  );
  for (const target of [a, b]) {
    assert.equal((await ok("show", { id: target })).status, "current");
  }
  assert.deepEqual((await ok("forget", valid)).purged, [a, b].sort());
  assert.deepEqual((await ok("forget", valid)).purged, [a, b].sort());
});
