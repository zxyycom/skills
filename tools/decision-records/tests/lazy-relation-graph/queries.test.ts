import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { executeDecisionQuery } from "../../src/decision-query-service.ts";
import type { DecisionQueryRequest } from "../../src/decision-query-contract.ts";
import { loadDecisionIndex } from "../../src/decision-state-index.ts";
import {
  archivedDecisionId,
  currentDecisionId,
  currentSourcePath,
  readIndex,
  withFixtureWorkspace,
  writeIndex
} from "../support.ts";
import { listRequest, withGraphBuildCount } from "./support.ts";

function searchRequest(
  root: string
): Extract<DecisionQueryRequest, { command: "search" }> {
  return {
    alignment: "all",
    command: "search",
    in: "content",
    match: "all",
    location: { decisionsDir: "docs/decisions", workspaceRoot: root },
    status: "all",
    tags: [],
    text: "CLI"
  };
}

test("Decision published queries reuse strict validation graphs and keep ordinary reads at one build", async () => {
  await withFixtureWorkspace("lazy-graph-published", async (root) => {
    const list = listRequest(root);
    const search = searchRequest(root);
    const queries: DecisionQueryRequest[] = [
      list,
      {
        ...list,
        relatedTo: archivedDecisionId,
        direction: "successors",
        relationType: "修订"
      },
      {
        command: "trace",
        decisionId: currentDecisionId,
        location: list.location
      },
      {
        command: "show",
        decisionId: currentDecisionId,
        location: list.location
      },
      { ...search, in: "metadata" },
      {
        ...search,
        in: "metadata",
        relatedTo: archivedDecisionId,
        relationType: "修订"
      }
    ];
    for (const request of queries) {
      await withGraphBuildCount(async (count) => {
        const result = await executeDecisionQuery(request);
        assert.ok(result.status === "ok", JSON.stringify(result));
        assert.equal(result.command, request.command);
        assert.deepEqual(result.warnings, []);
        assert.equal(
          count(),
          1,
          request.command + (request.command === "search" ? " metadata" : "")
        );
        if (result.command === "list") {
          assert.equal(result.total, "relatedTo" in request ? 1 : 2);
          if ("relatedTo" in request)
            assert.deepEqual(result.records[0]?.filterRelations, [
              {
                sourceId: currentDecisionId,
                type: "修订",
                target: archivedDecisionId
              }
            ]);
        } else if (result.command === "trace") {
          assert.deepEqual(
            new Set(result.traceIds),
            new Set([currentDecisionId, archivedDecisionId])
          );
          assert.deepEqual(result.coverage, { complete: true, stoppedBy: [] });
        } else if (result.command === "show") {
          assert.match(result.body, /CLI/u);
        } else if (result.command === "search") {
          assert.equal(result.records.length, "relatedTo" in request ? 1 : 2);
          assert.equal(result.searchInfo.source.kind, "published-index");
        }
        assert.equal("getRelationGraph" in result, false);
      });
    }
  });
});

test("Decision query graph reuse preserves option and index failure priority and complete relation diagnostics", async () => {
  await withFixtureWorkspace("lazy-graph-failures", async (root) => {
    const decisionsDirectory = path.join(root, "docs/decisions");
    const index = structuredClone(await readIndex(root));
    index.entries[currentDecisionId].relations = [
      { type: "修订", target: currentDecisionId }
    ];
    await writeIndex(
      path.join(decisionsDirectory, "decision-index.json"),
      index
    );
    await withGraphBuildCount(async (count) => {
      const invalidOptions = await executeDecisionQuery({
        command: "trace",
        decisionId: "missing",
        location: listRequest(root).location,
        maxDepth: -1
      });
      assert.ok(invalidOptions.status === "error");
      assert.equal(invalidOptions.exitCode, 2);
      assert.equal(
        invalidOptions.diagnostics[0]?.code,
        "decision-records.trace-options-invalid"
      );
      assert.equal(count(), 0);
      const loaded = await loadDecisionIndex({ decisionsDirectory });
      assert.equal(loaded.status, "error");
      assert.deepEqual(loaded.diagnostics, [
        {
          code: "decision-index.relation-invalid",
          message:
            "use-generated-cli.md relationship 修订 target must be archived: use-generated-cli; use-generated-cli.md must not relate to itself",
          path: "decision-index.json",
          stateId: null
        }
      ]);
      assert.equal(count(), 1);
      const missing = await executeDecisionQuery({
        ...listRequest(root),
        relatedTo: "missing"
      });
      assert.ok(missing.status === "error");
      assert.equal(
        missing.diagnostics[0]?.code,
        "decision-records.index-query-failed"
      );
      assert.match(missing.errors.join("\n"), /must not relate to itself/u);
      assert.doesNotMatch(missing.errors.join("\n"), /does not exist/u);
      assert.equal(count(), 2);
    });
  });
});

test("Decision content search reuses each independently validated snapshot graph without suppressing fresh source validation", async () => {
  await withFixtureWorkspace("lazy-graph-content", async (root) => {
    const base = searchRequest(root);
    for (const request of [
      base,
      {
        ...base,
        relatedTo: archivedDecisionId,
        direction: "successors" as const,
        relationType: "修订" as const
      }
    ]) {
      await withGraphBuildCount(async (count) => {
        const result = await executeDecisionQuery(request);
        assert.ok(result.status === "ok" && result.command === "search");
        assert.equal(result.searchInfo.source.fallback, false);
        assert.equal(result.records.length, "relatedTo" in request ? 1 : 2);
        assert.equal(
          count(),
          3,
          "published, current and independently reread sync-source snapshots each build once"
        );
      });
    }
    const sourceFile = path.join(root, "docs/decisions", currentSourcePath);
    await fs.writeFile(
      sourceFile,
      (await fs.readFile(sourceFile, "utf8")).replace(
        "type: 修订",
        "type: 替代"
      )
    );
    await withGraphBuildCount(async (count) => {
      const result = await executeDecisionQuery({
        ...base,
        relatedTo: archivedDecisionId,
        relationType: "替代"
      });
      assert.ok(result.status === "ok" && result.command === "search");
      assert.equal(result.searchInfo.source.fallback, true);
      assert.deepEqual(
        result.records.map(({ decisionId }) => decisionId),
        [currentDecisionId]
      );
      assert.deepEqual(result.records[0]?.filterRelations, [
        {
          sourceId: currentDecisionId,
          type: "替代",
          target: archivedDecisionId
        }
      ]);
      assert.equal(
        count(),
        3,
        "initial published, scanner published and current source snapshots remain independent"
      );
    });
    await fs.rm(path.join(root, "docs/decisions/decision-index.json"));
    await withGraphBuildCount(async (count) => {
      const result = await executeDecisionQuery({
        ...base,
        relatedTo: archivedDecisionId,
        relationType: "替代"
      });
      assert.ok(result.status === "ok" && result.command === "search");
      assert.equal(result.searchInfo.source.fallback, true);
      assert.deepEqual(
        result.records.map(({ decisionId }) => decisionId),
        [currentDecisionId]
      );
      assert.equal(
        count(),
        1,
        "only the validated current source graph exists when no index can load"
      );
    });
  });
});
