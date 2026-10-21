import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  buildStateIndexFromSnapshot,
  serializeStateIndex
} from "./baseline/tools/index-runtime/src/index.ts";
import { createDecisionStateIndexDefinition } from "./baseline/tools/decision-records/src/decision-index-definition.ts";
import { decisionSourceRevision } from "./baseline/tools/decision-records/src/decision-source-revision.ts";
import { buildDecisionStateSnapshotFromSources } from "./baseline/tools/decision-records/src/decision-state-snapshot.ts";
import { createInvestigationStateIndexDefinition } from "./baseline/tools/investigation-report/src/investigation-index-definition.ts";
import { investigationSourceRevision } from "./baseline/tools/investigation-report/src/investigation-source-revision.ts";
import { reportMarkdown } from "./baseline/tools/investigation-report/tests/fixture-support.ts";
import type { InvestigationIndexState } from "./baseline/tools/investigation-report/src/types.ts";

const n = Number(process.argv[2]);
assert.ok(Number.isSafeInteger(n) && n >= 10 && n <= 100000 && n % 10 === 0);
const root = path.resolve(import.meta.dirname, "datasets", String(n));
await fs.mkdir(path.join(root, "docs/decisions/archive"), { recursive: true });
await fs.mkdir(path.join(root, "docs/investigations"), { recursive: true });
const id = (i: number) => `261021-record-${String(i).padStart(6, "0")}`;
const decisionSources = Array.from({ length: n }, (_, i) => {
  const archived = i % 10 === 0;
  const decisionId = id(i);
  const sourcePath = `${archived ? "archive/" : ""}${decisionId}.md`;
  const target = id(i - (i % 10));
  const text = [
    "---",
    `title: common ${decisionId}`,
    `id: ${decisionId}`,
    `status: ${archived ? "archived" : "active"}`,
    "alignment: aligned",
    "createdAt: 2026-10-21T00:00:00Z",
    "purpose: common purpose",
    "background: common background",
    "decision: common decision",
    `tags: [group-${i % 10}]`,
    archived
      ? "relations: []"
      : `relations:\n  - type: 修订\n    target: ${target}\n    summary: common summary`,
    "---",
    "",
    "## 目的",
    "common purpose",
    "",
    "## 背景",
    "common background",
    "",
    "## 决策",
    "- 采用: common decision",
    ""
  ].join("\n");
  return { decisionId, sourcePath, text };
});
const snapshot = await buildDecisionStateSnapshotFromSources(decisionSources);
assert.deepEqual(
  snapshot.sourceRevision,
  decisionSourceRevision(decisionSources)
);
const definition = createDecisionStateIndexDefinition();
const built = buildStateIndexFromSnapshot(definition, snapshot);
assert.equal(built.status, "ok");
if (built.status === "error")
  throw new Error(JSON.stringify(built.diagnostics));
await fs.writeFile(
  path.join(root, "docs/decisions/decision-index.json"),
  serializeStateIndex(built.value, definition)
);
for (let offset = 0; offset < n; offset += 32) {
  await Promise.all(
    decisionSources
      .slice(offset, offset + 32)
      .map((source) =>
        fs.writeFile(
          path.join(root, "docs/decisions", source.sourcePath),
          source.text
        )
      )
  );
}
const reports = Array.from({ length: n }, (_, i) => {
  const reportId = id(i);
  const relations: InvestigationIndexState["relations"] =
    i % 10 === 0
      ? []
      : [{ type: "复查", target: id(i - (i % 10)), summary: "common summary" }];
  const input = {
    id: reportId,
    title: `common ${reportId}`,
    formedAt: "2026-10-21T00:00:00Z",
    question: "common question",
    tags: [`group-${i % 10}`],
    relations
  };
  return {
    id: reportId,
    sourcePath: `${reportId}.md`,
    text: reportMarkdown(input),
    state: {
      title: input.title,
      formedAt: input.formedAt,
      question: input.question,
      tags: input.tags,
      relations,
      name: reportId.slice(7),
      sourcePath: `${reportId}.md`,
      resourceIds: []
    }
  };
});
const reportDefinition = createInvestigationStateIndexDefinition();
const reportIndex = buildStateIndexFromSnapshot(reportDefinition, {
  metadata: {},
  sourceRevision: investigationSourceRevision(reports),
  states: Object.fromEntries(reports.map((report) => [report.id, report.state]))
});
assert.equal(
  reportIndex.status,
  "ok",
  JSON.stringify(reportIndex.diagnostics.slice(0, 3))
);
if (reportIndex.status === "error")
  throw new Error(JSON.stringify(reportIndex.diagnostics));
await fs.writeFile(
  path.join(root, "docs/investigations/investigation-index.json"),
  serializeStateIndex(reportIndex.value, reportDefinition)
);
for (let offset = 0; offset < n; offset += 32) {
  await Promise.all(
    reports
      .slice(offset, offset + 32)
      .map((report) =>
        fs.writeFile(
          path.join(root, "docs/investigations", report.sourcePath),
          report.text
        )
      )
  );
}
console.log(
  JSON.stringify({
    n,
    root,
    decisionBytes: (
      await fs.stat(path.join(root, "docs/decisions/decision-index.json"))
    ).size,
    investigationBytes: (
      await fs.stat(
        path.join(root, "docs/investigations/investigation-index.json")
      )
    ).size
  })
);
