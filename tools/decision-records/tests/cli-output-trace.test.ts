import assert from "node:assert/strict";
import test from "node:test";
import { printDecisionTrace } from "../src/cli-output-trace.ts";
import type { DecisionTraceSuccess } from "../src/decision-query-contract.ts";

function traceResult(): Omit<DecisionTraceSuccess, "status"> {
  return {
    anchorId: "split-a" as never,
    contextIds: ["split-b" as never],
    coverage: { complete: false, stoppedBy: ["max-records"] },
    direction: "predecessors",
    entries: {
      original: {
        alignment: "aligned",
        background: "背景",
        createdAt: "2026-09-11T00:00:00Z",
        decision: "决策",
        purpose: "目的",
        relations: [],
        status: "archived",
        tags: [],
        title: "原有方向"
      },
      "split-a": {
        alignment: "aligned",
        background: "背景",
        createdAt: "2026-09-11T00:00:00Z",
        decision: "决策",
        purpose: "目的",
        relations: [
          {
            summary: "承接查询责任",
            target: "original" as never,
            type: "拆分"
          },
          { target: "outside" as never, type: "修订" }
        ],
        status: "active",
        tags: [],
        title: "方向 A"
      },
      "split-b": {
        alignment: "aligned",
        background: "背景",
        createdAt: "2026-09-11T00:00:00Z",
        decision: "决策",
        purpose: "目的",
        relations: [{ target: "original" as never, type: "拆分" }],
        status: "active",
        tags: [],
        title: "方向 B"
      }
    },
    frontier: [
      {
        direction: "predecessors",
        fromId: "original" as never,
        nextIds: ["before-original" as never],
        reason: "max-records"
      }
    ],
    limits: { depth: "all", maxRecords: 3 },
    traceIds: ["original" as never, "split-a" as never],
    blockedEvent: {
      kind: "split",
      recordIds: ["original" as never, "split-a" as never, "split-b" as never],
      requiredMaxRecords: 4
    }
  };
}

function rendered(json: boolean): string {
  let stdout = "";
  printDecisionTrace(traceResult(), json, {
    stderr: () => undefined,
    stdout: (text) => {
      stdout += text;
    }
  });
  return stdout;
}

test("Decision trace defaults to a stable text graph with event context and boundaries", () => {
  const output = rendered(false);
  assert.match(
    output,
    /^TRACE anchor=\[split-a\] direction=predecessors depth=all complete=false records=3$/m
  );
  assert.match(output, /^L0\* \[split-a\] active\/aligned 方向 A$/m);
  assert.match(output, /^L1\* \[original\] archived\/aligned 原有方向$/m);
  assert.match(output, /^  split-successors:$/m);
  assert.match(output, /^    \* \[split-a\] trace active\/aligned 方向 A$/m);
  assert.match(output, /^    ~ \[split-b\] context active\/aligned 方向 B$/m);
  assert.match(output, /^      detail: "承接查询责任"$/m);
  assert.doesNotMatch(
    output,
    /\* \[original\] trace archived\/aligned 原有方向\n      detail:/
  );
  assert.match(output, /^coverage: incomplete stoppedBy=max-records$/m);
  assert.match(
    output,
    /^  - \[original\] direction=predecessors reason=max-records next=\[before-original\]$/m
  );
  assert.match(output, /^  requiredMaxRecords: 4$/m);
  assert.doesNotMatch(output, /\[outside\]/u);
});

test("Decision trace --json preserves the stable envelope", () => {
  const output = JSON.parse(rendered(true)) as Record<string, unknown>;
  assert.equal(output.status, "ok");
  assert.deepEqual(output.traceIds, ["original", "split-a"]);
  assert.deepEqual(output.contextIds, ["split-b"]);
  assert.deepEqual(output.limits, { depth: "all", maxRecords: 3 });
});

test("Decision trace keeps event summaries with their relation source", () => {
  const trace = traceResult();
  const output = (() => {
    let stdout = "";
    printDecisionTrace(
      {
        ...trace,
        anchorId: "merge-source" as never,
        contextIds: ["merge-target" as never, "reallocation-target" as never],
        direction: "both",
        entries: {
          "merge-source": entry("归并来源", [
            {
              summary: "归并说明",
              target: "merge-target" as never,
              type: "归并"
            }
          ]),
          "merge-target": entry("归并目标", []),
          "reallocation-source": entry("重划来源", [
            {
              summary: "重划说明一",
              target: "reallocation-target" as never,
              type: "重划"
            },
            {
              summary: "重划说明二",
              target: "merge-source" as never,
              type: "重划"
            }
          ]),
          "reallocation-target": entry("重划目标", [])
        },
        traceIds: ["merge-source" as never, "reallocation-source" as never]
      },
      false,
      {
        stderr: () => undefined,
        stdout: (text) => {
          stdout += text;
        }
      }
    );
    return stdout;
  })();
  assert.match(
    output,
    /\* \[merge-source\] trace active\/aligned 归并来源\n      detail: "归并说明"/
  );
  assert.doesNotMatch(
    output,
    /~ \[merge-target\] context active\/aligned 归并目标\n      detail:/
  );
  assert.match(
    output,
    /\* \[reallocation-source\] trace active\/aligned 重划来源\n      detail: "重划说明一"\n      detail: "重划说明二"/
  );
  assert.doesNotMatch(
    output,
    /~ \[reallocation-target\] context active\/aligned 重划目标\n      detail:/
  );
});

function entry(
  title: string,
  relations: DecisionTraceSuccess["entries"][string]["relations"]
): DecisionTraceSuccess["entries"][string] {
  return {
    alignment: "aligned",
    background: "背景",
    createdAt: "2026-09-11T00:00:00Z",
    decision: "决策",
    purpose: "目的",
    relations,
    status: "active",
    tags: [],
    title
  };
}
