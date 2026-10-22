import assert from "node:assert/strict";
import { test } from "node:test";
import {
  prepareQuery,
  queryLoadedInvestigationIndex
} from "../src/query-index.ts";
import { prepareSearch } from "../src/query-options.ts";
import { searchSnapshot } from "../src/query-search-content.ts";
import { searchLoadedInvestigationMetadata } from "../src/query-search-metadata.ts";
import { filterRelationsByEntry } from "../src/query-search-selection.ts";
import { traceLoadedInvestigation } from "../src/query-trace.ts";
import { createInvestigationRelationContext } from "../src/relation-context.ts";
import {
  traceInvestigationRelations,
  validateInvestigationRelationGraph
} from "../src/relation-validation.ts";
import { collectValidatedInvestigationCollection } from "../src/validation-collection.ts";
import { writeCollection } from "./collection-support.ts";
import { investigationRoot, withTempRoot } from "./fixture-support.ts";
import { investigationIndexFixture } from "./index-fixture.ts";
import { observeGraphBuilds } from "./relation-context-support.ts";

function relationFixture() {
  return structuredClone(
    investigationIndexFixture([
      { id: "base", title: "needle base" },
      {
        id: "center",
        title: "needle center",
        relations: [{ target: "base", type: "补充", summary: "中心证据" }]
      },
      {
        id: "next",
        title: "needle next",
        relations: [{ target: "center", type: "修正", summary: "后继证据" }]
      }
    ])
  );
}

test("investigation plain list and metadata search build no relation graph", (t) => {
  const index = relationFixture();
  const builds = observeGraphBuilds(t, Object.values(index.entries));
  const query = prepareQuery({ workspaceRoot: "/tmp", limit: 2 });
  assert.ok(query.isOk());
  const listed = queryLoadedInvestigationIndex(
    { status: "ok", diagnostics: [], value: index },
    query.value.validated,
    query.value.indexPath
  );
  assert.ok(listed.isOk());
  assert.equal(listed.value.total, 3);
  assert.equal(listed.value.facets?.recordCount, 3);
  assert.deepEqual(
    listed.value.entries.map(({ id }) => id),
    ["base", "center"]
  );
  assert.ok(
    listed.value.entries.every((entry) => !("filterRelations" in entry))
  );
  builds(0);

  const search = prepareSearch({
    workspaceRoot: "/tmp",
    query: "needle",
    in: "metadata"
  });
  assert.ok(search.isOk());
  const searched = searchLoadedInvestigationMetadata(
    createInvestigationRelationContext(Object.entries(index.entries)),
    search.value.indexPath,
    search.value
  );
  assert.equal(searched.status, "ok");
  assert.equal(searched.searchInfo?.counts.matched.value, 3);
  assert.ok(searched.entries.every((entry) => !("filterRelations" in entry)));
  builds(0);
});

test("investigation validation filtering and trace share one graph per snapshot", (t) => {
  const index = relationFixture();
  const before = JSON.stringify(index.entries);
  const builds = observeGraphBuilds(t, Object.values(index.entries));
  const context = createInvestigationRelationContext(
    Object.entries(index.entries)
  );
  builds(0);
  assert.deepEqual(validateInvestigationRelationGraph(context), []);
  builds(1);
  const graph = context.graph();
  const typeOnly = filterRelationsByEntry(context, { relationType: "修正" });
  assert.ok(typeOnly.isOk());
  assert.deepEqual(
    [...(typeOnly.value ?? [])],
    [
      [
        "next",
        [
          {
            sourceId: "next",
            type: "修正",
            target: "center",
            summary: "后继证据"
          }
        ]
      ]
    ]
  );
  const selected = filterRelationsByEntry(context, {
    relatedTo: "center",
    direction: "both"
  });
  assert.ok(selected.isOk());
  assert.deepEqual(
    [...(selected.value ?? [])],
    [
      [
        "base",
        [
          {
            sourceId: "center",
            type: "补充",
            target: "base",
            summary: "中心证据"
          }
        ]
      ],
      [
        "next",
        [
          {
            sourceId: "next",
            type: "修正",
            target: "center",
            summary: "后继证据"
          }
        ]
      ]
    ]
  );
  assert.deepEqual(
    traceInvestigationRelations(context, "center", {
      direction: "both",
      maxDepth: null,
      maxRecords: 50
    }).traceIds,
    ["base", "center", "next"]
  );
  assert.deepEqual(validateInvestigationRelationGraph(context), []);
  assert.strictEqual(context.graph(), graph);
  builds(1);
  assert.equal(JSON.stringify(index.entries), before);
});

test("investigation relation scopes isolate replacement and rollback snapshots", (t) => {
  const index = relationFixture();
  const states = new Map(Object.entries(index.entries));
  const original = states.get("next");
  assert.ok(original !== undefined);
  const unchangedBuilds = observeGraphBuilds(t, [
    index.entries.base!,
    index.entries.center!
  ]);
  const originalBuilds = observeGraphBuilds(t, [original]);
  const first = createInvestigationRelationContext(states);
  const before = first.graph();
  originalBuilds(1);
  unchangedBuilds(1);

  const replacement = {
    ...original,
    relations: [{ type: "复查" as const, target: "base" }]
  };
  const replacementBuilds = observeGraphBuilds(t, [replacement]);
  states.set("next", replacement);
  const changed = createInvestigationRelationContext(states);
  assert.deepEqual(validateInvestigationRelationGraph(changed), []);
  assert.notStrictEqual(changed.graph(), before);
  replacementBuilds(1);
  originalBuilds(1);
  unchangedBuilds(2);
  assert.deepEqual(
    traceInvestigationRelations(first, "center", {
      direction: "successors",
      maxDepth: null,
      maxRecords: 50
    }).traceIds,
    ["center", "next"]
  );
  assert.deepEqual(
    traceInvestigationRelations(changed, "center", {
      direction: "successors",
      maxDepth: null,
      maxRecords: 50
    }).traceIds,
    ["center"]
  );
  assert.deepEqual(original.relations, [
    { type: "修正", target: "center", summary: "后继证据" }
  ]);

  states.set("next", original);
  const restored = createInvestigationRelationContext(states);
  assert.deepEqual(validateInvestigationRelationGraph(restored), []);
  assert.notStrictEqual(restored.graph(), before);
  assert.notStrictEqual(restored.graph(), changed.graph());
  assert.deepEqual(restored.graph().edges, before.edges);
  assert.strictEqual(first.graph(), before);
  assert.equal(changed.graph().states.get("next"), replacement);
  replacementBuilds(1);
  originalBuilds(2);
  unchangedBuilds(3);
});

test("investigation unknown and ambiguous selectors fail before graph construction", (t) => {
  const index = structuredClone(
    investigationIndexFixture([{ id: "261020-same" }, { id: "261021-same" }])
  );
  const builds = observeGraphBuilds(t, Object.values(index.entries));
  const context = createInvestigationRelationContext(
    Object.entries(index.entries)
  );
  for (const selector of ["missing", "same"]) {
    const filtered = filterRelationsByEntry(context, { relatedTo: selector });
    assert.ok(filtered.isErr());
    assert.match(
      filtered.error.join("\n"),
      selector === "missing" ? /does not exist/u : /ambiguous/u
    );
    const traced = traceLoadedInvestigation(context, "/index.json", selector, {
      direction: "both",
      maxDepth: null,
      maxRecords: 50
    });
    assert.equal(traced.status, "error");
    assert.deepEqual(traced.errors, filtered.error);
  }
  builds(0);
});

test("investigation content search reuses its supplied projection graph", async (t) => {
  await withTempRoot("lazy-fallback", async (root) => {
    await writeCollection(
      root,
      [
        { id: "base", title: "needle base" },
        {
          id: "next",
          title: "needle next",
          relations: [{ type: "补充", target: "base", summary: "当前证据" }]
        }
      ],
      false
    );
    const collection = await collectValidatedInvestigationCollection(
      investigationRoot(root)
    );
    assert.deepEqual(collection.errors, []);
    const builds = observeGraphBuilds(t, collection.states.values());
    const graph = collection.relations.graph();
    const prepared = prepareSearch({
      workspaceRoot: root,
      query: "needle",
      relatedTo: "base"
    });
    assert.ok(prepared.isOk());
    const result = await searchSnapshot({
      relations: collection.relations,
      indexPath: collection.indexPath,
      investigationsDirectory: investigationRoot(root),
      prepared: prepared.value,
      source: {
        kind: "published-index+current-text",
        currentness: "unchecked",
        fallback: false
      },
      warnings: []
    });
    assert.equal(result.status, "ok");
    assert.equal(result.searchInfo?.source.fallback, false);
    assert.deepEqual(
      result.entries.map(({ id }) => id),
      ["next"]
    );
    assert.deepEqual(result.entries[0]?.filterRelations, [
      { sourceId: "next", type: "补充", target: "base", summary: "当前证据" }
    ]);
    assert.strictEqual(collection.relations.graph(), graph);
    builds(0);
  });
});
