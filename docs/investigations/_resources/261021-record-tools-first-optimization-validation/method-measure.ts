import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { InvestigationIndexState } from "./baseline/tools/investigation-report/src/types.ts";
const [variant, operation, count] = process.argv.slice(2);
assert.ok(variant === "before" || variant === "after");
const n = Number(count);
assert.ok(Number.isSafeInteger(n) && n >= 10 && n <= 100000);
const root = path.resolve(import.meta.dirname, "datasets", String(n));
const before = variant === "before";
const decision = before
  ? await import("./baseline/tools/decision-records/src/decision-query-service.ts")
  : await import("/workspace/skills/tools/decision-records/src/decision-query-service.ts");
const validation = before
  ? await import("./baseline/tools/decision-records/src/index.ts")
  : await import("/workspace/skills/tools/decision-records/src/index.ts");
const investigation = before
  ? await import("./baseline/tools/investigation-report/src/query.ts")
  : await import("/workspace/skills/tools/investigation-report/src/query.ts");
const selection = before
  ? await import("./baseline/tools/investigation-report/src/query-search-selection.ts")
  : await import("/workspace/skills/tools/investigation-report/src/query-search-selection.ts");
const relations = before
  ? await import("./baseline/tools/investigation-report/src/relation-context.ts")
  : await import("/workspace/skills/tools/investigation-report/src/relation-context.ts");
const prepare = before
  ? await import("./baseline/tools/investigation-report/src/query-index.ts")
  : await import("/workspace/skills/tools/investigation-report/src/query-index.ts");
const id = (i: number) => `261021-record-${String(i).padStart(6, "0")}`;
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const location = { workspaceRoot: root, decisionsDir: "docs/decisions" };
const common = {
  location,
  status: "active" as const,
  alignment: "all" as const,
  tags: []
};
let readCount = 0;
const readFile = fs.readFile;
Object.defineProperty(fs, "readFile", {
  configurable: true,
  value: (...args: Parameters<typeof fs.readFile>) => {
    if (typeof args[0] === "string" && args[0].endsWith(".md")) readCount += 1;
    return readFile(...args);
  }
});
let run: () => Promise<unknown> | unknown;
if (operation === "ir-evidence") {
  const states: [string, InvestigationIndexState][] = Array.from(
    { length: n },
    (_, i) => [
      id(i),
      {
        name: id(i).slice(7),
        sourcePath: `${id(i)}.md`,
        title: "common title",
        question: "common question",
        formedAt: "2026-10-21T00:00:00Z",
        tags: ["group"],
        resourceIds: [],
        relations:
          i === n - 1
            ? Array.from({ length: n - 1 }, (_, target) => ({
                type: "归并" as const,
                target: id(target),
                summary: "common summary"
              }))
            : []
      }
    ]
  );
  const context = relations.createInvestigationRelationContext(states);
  const options = prepare.prepareQuery({
    workspaceRoot: root,
    relationType: "归并"
  });
  assert.ok(options.isOk());
  run = () => {
    const result = selection.filterRelationsByEntry(
      context,
      options.value.validated
    );
    assert.ok(result.isOk());
    return [...(result.value ?? [])];
  };
} else if (operation === "decision-check")
  run = () => validation.validateDecisionRecords({ workspaceRoot: root });
else if (operation === "decision-list")
  run = () =>
    decision.executeDecisionQuery({
      ...common,
      command: "list",
      limit: 50,
      offset: 0
    });
else if (operation === "decision-metadata")
  run = () =>
    decision.executeDecisionQuery({
      ...common,
      command: "search",
      in: "metadata",
      match: "all",
      text: "common"
    });
else if (operation === "ir-list")
  run = () =>
    investigation.queryInvestigationIndex({ workspaceRoot: root, limit: 50 });
else throw new Error("unknown operation");
const startedAt = new Date().toISOString();
const start = performance.now();
const result = await run();
const elapsedMs = performance.now() - start;
fs.readFile = readFile;
const serializeStart = performance.now();
const json = JSON.stringify(result);
const serializationMs = performance.now() - serializeStart;
let records: readonly unknown[] | undefined;
let errors: unknown;
let searchInfo: unknown;
if (typeof result === "object" && result !== null) {
  if ("records" in result && Array.isArray(result.records))
    records = result.records;
  if ("errors" in result) errors = result.errors;
  if ("searchInfo" in result) searchInfo = result.searchInfo;
  if ("status" in result)
    assert.equal(result.status, "ok", json.slice(0, 1000));
  if ("errors" in result) assert.deepEqual(result.errors, []);
}
console.log(
  JSON.stringify({
    startedAt,
    variant,
    operation,
    n,
    elapsedMs,
    serializationMs,
    readCount,
    maxRssKiB: process.resourceUsage().maxRSS,
    bytes: Buffer.byteLength(json),
    sha256: digest(json),
    first100Sha256:
      records === undefined
        ? null
        : digest(JSON.stringify(records.slice(0, 100))),
    returned: records?.length,
    searchInfo,
    errors
  })
);
