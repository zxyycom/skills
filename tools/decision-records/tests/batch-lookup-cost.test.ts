import assert from "node:assert/strict";
import test from "node:test";
import type { DecisionId } from "../src/types.ts";
import { memoryReallocationRing } from "./reallocation-fixture.ts";

test("candidate relation names share one lookup while preserving ambiguity and summary order", async () => {
  const { resolveCandidateRelationSelectors } =
    await import("../src/decision-candidate-relations.ts");
  for (const count of [10, 100]) {
    let visits = 0;
    const records = Array.from({ length: count }, (_, i) => ({
      get decisionId() {
        visits++;
        return `261001-item${i}`;
      },
      sourcePath: `item${i}.md`
    }));
    const scan = {
      decisionsDirectory: "",
      records,
      collection: {}
    } as unknown as Parameters<typeof resolveCandidateRelationSelectors>[0];
    const request = {
      decisionId: "261002-new" as DecisionId,
      background: "",
      decision: "",
      purpose: "",
      title: "",
      tags: [],
      relations: Array.from({ length: 5 }, (_, i) => ({
        type: "替代" as const,
        target: `item${i}` as DecisionId
      })),
      relationSummaries: [{ target: "item0" as DecisionId, summary: "summary" }]
    };
    assert.equal(resolveCandidateRelationSelectors(scan, request).status, "ok");
    assert.equal(visits, count);
    visits = 0;
    const dated = {
      ...request,
      relations: [
        { type: "替代" as const, target: "261001-item0" as DecisionId }
      ],
      relationSummaries: []
    };
    assert.equal(resolveCandidateRelationSelectors(scan, dated).status, "ok");
    assert.equal(visits, 0);
    const ambiguous = {
      ...scan,
      records: [
        { decisionId: "261002-same", sourcePath: "a.md" },
        { decisionId: "261001-same", sourcePath: "b.md" }
      ]
    };
    const result = resolveCandidateRelationSelectors(ambiguous, {
      ...request,
      relations: [{ type: "替代", target: "same" as DecisionId }],
      relationSummaries: []
    });
    assert.equal(result.status, "error");
    if (result.status === "error")
      assert.match(result.diagnostic.reason, /261001-same, 261002-same/u);
    const badSummaryFirst = resolveCandidateRelationSelectors(scan, {
      ...request,
      relations: [
        {
          type: "替代",
          target: "missing" as DecisionId,
          summary: "line\nbreak"
        }
      ],
      relationSummaries: []
    });
    assert.equal(badSummaryFirst.status, "error");
    if (badSummaryFirst.status === "error")
      assert.equal(
        badSummaryFirst.diagnostic.code,
        "decision-records.new-relation-summary-invalid"
      );
    const missingFirst = resolveCandidateRelationSelectors(scan, {
      ...request,
      relations: [{ type: "替代", target: "missing" as DecisionId }],
      relationSummaries: [
        { target: "also-missing" as DecisionId, summary: "ok" }
      ]
    });
    assert.equal(missingFirst.status, "error");
    if (missingFirst.status === "error")
      assert.equal(missingFirst.diagnostic.target, "missing");
  }
});

test("history path lookup skips records for published paths and indexes candidate fallback once", async () => {
  const { historySourcePaths } =
    await import("../src/decision-history-sources.ts");
  for (const count of [10, 100]) {
    const { scan } = await memoryReallocationRing(count);
    let visits = 0;
    const records = scan.records.map((record) => ({
      ...record,
      source: { ...record.source, kind: "candidate" as const },
      get decisionId() {
        visits++;
        return record.decisionId;
      }
    }));
    const measured = { ...scan, records } as typeof scan;
    const wanted = new Set(
      records.map((record) => record.decisionId as DecisionId)
    );
    const entries = Object.fromEntries(
      records.map((record) => [
        record.decisionId,
        { sourcePath: record.sourcePath }
      ])
    );
    const index = { entries } as Parameters<typeof historySourcePaths>[1];
    visits = 0;
    const published = historySourcePaths(measured, index, wanted, "docs/");
    assert.equal(visits, 0);
    assert.deepEqual(
      [...published],
      records.map((record) => [`docs/${record.sourcePath}`, record.decisionId])
    );
    visits = 0;
    const fallback = historySourcePaths(
      measured,
      { ...index, entries: {} },
      wanted,
      "docs/"
    );
    assert.ok(
      visits <= records.length * 3,
      `N=${records.length}, visits=${visits}`
    );
    assert.deepEqual(
      [...fallback],
      records.map((record) => [`docs/${record.sourcePath}`, record.decisionId])
    );
    const first = records[0]!;
    const duplicated = {
      ...measured,
      records: [first, { ...first, sourcePath: "later.md" }]
    } as typeof scan;
    assert.equal(
      historySourcePaths(
        duplicated,
        { ...index, entries: {} },
        new Set([first.decisionId as DecisionId]),
        ""
      ).has(first.sourcePath),
      true
    );
  }
});

test("stage pending basename selection reads selectors linearly across growing member sets", async () => {
  const { selectedPendingPaths } =
    await import("../src/decision-stage-refresh-locators.ts");
  for (const count of [10, 100]) {
    let selectorVisits = 0;
    let memberVisits = 0;
    const rawSelectors = Array.from(
      { length: count },
      (_, i) => `item${i}` as DecisionId
    );
    const selectors = new Proxy(rawSelectors, {
      get(target, property, receiver) {
        if (typeof property === "string" && /^\d+$/u.test(property))
          selectorVisits++;
        return Reflect.get(target, property, receiver);
      }
    });
    const members = Array.from({ length: count }, (_, i) => ({
      kind: "regular" as const,
      get path() {
        memberVisits++;
        return `docs/decisions/261001-item${i}.md`;
      }
    }));
    members.push({
      kind: "regular",
      path: "docs/decisions/261001-unselected.md"
    });
    members.push({ kind: "regular", path: "docs/decisions/unrelated.txt" });
    const options = {
      selectors,
      opened: { decisionScope: "docs/decisions" },
      scope: "domain"
    } as unknown as Parameters<typeof selectedPendingPaths>[0];
    const empty = { entries: {} } as Parameters<
      typeof selectedPendingPaths
    >[1]["workspace"];
    const baseline = {
      indexPath: "docs/decisions/decision-index.json",
      head: null,
      workspace: empty
    };
    const locator = {
      consumeIndex: false,
      index: null,
      snapshot: { members, files: [], pathScope: "docs/decisions" }
    };
    const result = selectedPendingPaths(options, baseline, locator);
    assert.deepEqual(
      result.contentPaths,
      Array.from(
        { length: count },
        (_, i) => `docs/decisions/261001-item${i}.md`
      )
    );
    assert.ok(memberVisits <= count * 2);
    assert.ok(
      selectorVisits <= count * 3,
      `N=${count}, selector visits=${selectorVisits}`
    );
  }
});
