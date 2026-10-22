import assert from "node:assert/strict";
import test from "node:test";
import { type DecisionQueryRequest } from "../src/decision-query-contract.ts";
import { isDecisionTag } from "../src/decision-path.ts";
import { projectDecisionMetadata } from "../src/decision-query-search-metadata.ts";
import { executeDecisionSearch } from "../src/decision-query-search.ts";
import { TextSearchMatcherError } from "../../shared/src/file-text-search/index.ts";
import { metadataEntries } from "./search-metadata-window-fixture.ts";
import { archivedDecisionId } from "./support-record-fixture.ts";

type SearchRequest = Extract<DecisionQueryRequest, { command: "search" }>;

function metadataRequest(
  overrides: Partial<SearchRequest> = {}
): SearchRequest {
  return {
    alignment: "all",
    command: "search",
    in: "metadata",
    location: { decisionsDir: "docs/decisions", workspaceRoot: "unused-root" },
    match: "all",
    status: "active",
    tags: [],
    text: "window-needle",
    ...overrides
  };
}

test("Decision metadata window distinguishes zero exact boundary and overflow with exact full counts", async () => {
  for (const count of [0, 100, 103]) {
    const result = projectDecisionMetadata(
      await metadataEntries(count),
      metadataRequest()
    );
    assert.ok(result.status === "ok" && result.command === "search");
    assert.deepEqual(result.searchInfo.query.limits, {
      maxRecords: 100,
      resources: null,
      preview: null
    });
    assert.deepEqual(result.searchInfo.counts, {
      matched: { value: count, precision: "exact" },
      returned: Math.min(count, 100)
    });
    assert.deepEqual(result.searchInfo.coverage, {
      scanComplete: true,
      resultsComplete: count <= 100,
      previewsComplete: null,
      reasons: count > 100 ? ["max-records"] : []
    });
    assert.deepEqual(
      result.warnings,
      count > 100 ? ["search results limited: max-records"] : []
    );
    assert.deepEqual(
      result.records.map(({ decisionId }) => decisionId),
      Array.from(
        { length: Math.min(count, 100) },
        (_, index) => `261021-window-${String(index).padStart(4, "0")}`
      )
    );
  }
});

test("Decision metadata window preserves filter intersections relation evidence and source-path order", async () => {
  const entries = await metadataEntries(4);
  const excluded = entries.find(({ id }) => id === "261021-window-0001");
  assert.ok(excluded);
  excluded.state = { ...excluded.state, tags: [] };
  const tag = "project-tooling";
  assert.ok(isDecisionTag(tag));
  const request = metadataRequest({
    alignment: "aligned",
    direction: "successors",
    limit: 2,
    relatedTo: "use-source-cli.MD",
    relationType: "修订",
    tags: [tag]
  });
  for (const text of ["window-needle", "lineage detail"]) {
    const result = projectDecisionMetadata(entries, { ...request, text });
    assert.ok(
      result.status === "ok" &&
        result.command === "search" &&
        result.in === "metadata"
    );
    assert.deepEqual(result.searchInfo.counts, {
      matched: { value: 3, precision: "exact" },
      returned: 2
    });
    assert.deepEqual(result.searchInfo.query.filters, {
      alignment: "aligned",
      direction: "successors",
      relatedTo: archivedDecisionId,
      relationType: "修订",
      status: "active",
      tags: ["project-tooling"]
    });
    assert.deepEqual(
      result.records.map(({ decisionId }) => decisionId),
      ["261021-window-0000", "261021-window-0002"]
    );
    for (const record of result.records) {
      assert.deepEqual(record.filterRelations, [
        {
          sourceId: record.decisionId,
          type: "修订",
          target: archivedDecisionId,
          summary: "lineage detail"
        }
      ]);
      assert.deepEqual(
        record.matchedFields,
        text === "window-needle" ? ["title"] : []
      );
      assert.deepEqual(
        record.matchedRelations,
        text === "window-needle"
          ? []
          : [
              {
                type: "修订",
                target: archivedDecisionId,
                summary: "lineage detail"
              }
            ]
      );
    }
  }
});

test("Decision metadata window retains late matcher failure priority after hidden matches", async () => {
  const entries = await metadataEntries(4);
  const late = entries.find(({ id }) => id === "261021-window-0003");
  assert.ok(late);
  late.state = { ...late.state, title: "late-matcher-error" };
  const descriptor = Object.getOwnPropertyDescriptor(
    String.prototype,
    "normalize"
  );
  assert.ok(descriptor);
  const normalize: unknown = descriptor.value;
  assert.ok(typeof normalize === "function");
  Object.defineProperty(String.prototype, "normalize", {
    ...descriptor,
    value: function (this: string, form?: string) {
      if (this.valueOf() === "late-matcher-error") {
        throw new TextSearchMatcherError(
          "aborted",
          "late metadata matching aborted"
        );
      }
      const normalized: unknown = Reflect.apply(normalize, this, [form]);
      assert.equal(typeof normalized, "string");
      return normalized;
    }
  });
  try {
    const result = projectDecisionMetadata(
      entries,
      metadataRequest({ limit: 1 })
    );
    assert.equal(result.status, "error");
    assert.equal("searchInfo" in result, false);
    assert.ok(result.status === "error");
    assert.deepEqual(result.errors, ["late metadata matching aborted"]);
    assert.equal(
      result.diagnostics[0]?.code,
      "decision-records.metadata-search-failed"
    );
  } finally {
    Object.defineProperty(String.prototype, "normalize", descriptor);
  }
});

test("Decision metadata query API rejects invalid limits before collection failures", async () => {
  for (const limit of [
    0,
    -1,
    1.5,
    1001,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1
  ]) {
    const result = await executeDecisionSearch(metadataRequest({ limit }));
    assert.ok(result.status === "error");
    assert.equal(
      result.diagnostics[0]?.code,
      "decision-records.invalid-search-options"
    );
    assert.match(result.errors[0]!, /integer from 1 to 1000/);
  }
  const content = await executeDecisionSearch(
    metadataRequest({ in: "content", limit: 1 })
  );
  assert.ok(content.status === "error");
  assert.equal(
    content.diagnostics[0]?.code,
    "decision-records.invalid-search-options"
  );
  assert.match(content.errors[0]!, /only for metadata/);
});
