import assert from "node:assert/strict";
import { test } from "node:test";
import {
  showInvestigationReport,
  traceInvestigationReports
} from "../src/query.ts";
import {
  normalizeInvestigationSelectorInput,
  parseDatedInvestigationId
} from "../src/report-path.ts";
import { withTempRoot, writeCollection } from "./v6-support.ts";

test("show and trace resolve reports by investigation id", async () => {
  await withTempRoot("show-trace", async (root) => {
    await writeCollection(root, [
      { id: "first-report" },
      {
        id: "second-report",
        relations: [
          { type: "补充", target: "first-report", summary: "补充可见依据" }
        ]
      }
    ]);
    const shown = await showInvestigationReport({
      id: "second-report",
      workspaceRoot: root
    });
    assert.equal(shown.status, "ok");
    assert.match(shown.markdown ?? "", /^---/u);
    assert.match(shown.markdown ?? "", /summary: "补充可见依据"/u);
    assert.deepEqual(shown.state?.relations, [
      { type: "补充", target: "first-report", summary: "补充可见依据" }
    ]);
    const trace = await traceInvestigationReports({
      direction: "successors",
      id: "first-report",
      workspaceRoot: root
    });
    assert.equal(trace.status, "ok");
    assert.deepEqual(trace.traceIds, ["first-report", "second-report"]);
    assert.deepEqual(trace.contextIds, []);
    assert.deepEqual(trace.limits, { depth: 5, maxRecords: 50 });
    assert.deepEqual(trace.entries, {
      "first-report": {
        title: "first-report",
        formedAt: "2026-08-28T12:00:00+00:00",
        question: "当前问题是什么？",
        tags: ["investigation-report"],
        relations: []
      },
      "second-report": {
        title: "second-report",
        formedAt: "2026-08-28T12:00:00+00:00",
        question: "当前问题是什么？",
        tags: ["investigation-report"],
        relations: [
          { type: "补充", target: "first-report", summary: "补充可见依据" }
        ]
      }
    });
    assert.equal(
      (
        await showInvestigationReport({
          id: "./second-report.md",
          workspaceRoot: root
        })
      ).status,
      "error"
    );
    assert.equal(
      (
        await traceInvestigationReports({
          id: " second-report.md ",
          workspaceRoot: root
        })
      ).status,
      "error"
    );
  });
});

test("ordinary Investigation selectors use the standard ID parser before name lookup", async () => {
  await withTempRoot("dated-selectors", async (root) => {
    const firstId = "260901-shared-topic";
    const secondId = "260902-shared-topic";
    const uniqueId = "260903-unique-topic";
    await writeCollection(root, [
      {
        formedAt: "2026-09-01T12:00:00+00:00",
        id: firstId,
        sourcePath: "first-semantic-name.md"
      },
      {
        formedAt: "2026-09-02T12:00:00+00:00",
        id: secondId,
        sourcePath: "second-semantic-name.md"
      },
      {
        formedAt: "2026-09-03T12:00:00+00:00",
        id: uniqueId,
        sourcePath: "unique-semantic-name.md"
      },
      { id: "991332-invalid-date", sourcePath: "invalid-date-name.md" }
    ]);

    const unique = await showInvestigationReport({
      id: "unique-topic.MD",
      workspaceRoot: root
    });
    assert.equal(unique.status, "ok");
    assert.equal(unique.id, uniqueId);
    const exact = await showInvestigationReport({
      id: `${firstId}.md`,
      workspaceRoot: root
    });
    assert.equal(exact.status, "ok");
    assert.equal(exact.id, firstId);
    const ambiguous = await showInvestigationReport({
      id: "shared-topic",
      workspaceRoot: root
    });
    assert.equal(ambiguous.status, "error");
    assert.match(
      ambiguous.errors.join("\n"),
      new RegExp(`${firstId}, ${secondId}`)
    );
    const invalidDateName = await showInvestigationReport({
      id: "991332-invalid-date",
      workspaceRoot: root
    });
    assert.equal(invalidDateName.status, "ok");
    const missingExact = await showInvestigationReport({
      id: "260904-shared-topic",
      workspaceRoot: root
    });
    assert.equal(missingExact.status, "error");
    assert.match(missingExact.errors.join("\n"), /does not exist/);
    assert.equal(normalizeInvestigationSelectorInput("topic.MD"), "topic");
    assert.equal(
      normalizeInvestigationSelectorInput("topic.md.md"),
      "topic.md"
    );
    assert.equal(parseDatedInvestigationId("991332-topic"), null);
    assert.equal(parseDatedInvestigationId("nested/topic"), null);
  });
});

test("trace API diagnoses each invalid trace limit before loading its index", async () => {
  for (const [request, expected] of [
    [{ maxDepth: -1 }, "maxDepth must be a non-negative safe integer or null"],
    [{ maxRecords: 0 }, "maxRecords must be a positive safe integer"],
    [
      { maxDepth: Number.MAX_SAFE_INTEGER + 1, maxRecords: 0 },
      "maxDepth must be a non-negative safe integer or null"
    ]
  ] as const) {
    const result = await traceInvestigationReports({
      id: "missing",
      workspaceRoot: "missing-investigation-trace-root",
      ...request
    });
    assert.equal(result.status, "error", JSON.stringify(request));
    assert.ok(result.errors.includes(expected), JSON.stringify(result.errors));
    if ("maxRecords" in request)
      assert.ok(
        result.errors.includes("maxRecords must be a positive safe integer"),
        JSON.stringify(result.errors)
      );
  }
});
