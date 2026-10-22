import assert from "node:assert/strict";
import test from "node:test";
import { printDecisionTrace } from "../src/cli-output-trace.ts";
import { decisionPublishedSnapshotSource } from "../src/decision-query-contract.ts";
import type { DecisionTraceSuccess } from "../src/decision-query-contract.ts";

function traceResult(): Omit<DecisionTraceSuccess, "status"> {
  return {
    source: decisionPublishedSnapshotSource,
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
  assert.match(output, /only describe edges inside this trace slice/);
  assert.match(
    output,
    /^    \[split-a\] --拆分--> \[original\]: "承接查询责任"$/m
  );
  assert.match(output, /^  split-successors:$/m);
  assert.match(output, /^    \* \[split-a\] trace active\/aligned 方向 A$/m);
  assert.match(output, /^    ~ \[split-b\] context active\/aligned 方向 B$/m);
  assert.match(
    output,
    /^      \[split-b\] --拆分--> \[original\]: \[无摘要\]$/m
  );
  assert.doesNotMatch(
    output,
    /\* \[original\] trace archived\/aligned 原有方向\n      \[original\] --/
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
  assert.deepEqual(output, { status: "ok", ...traceResult() });
});

test("Decision trace keeps context event edges with their source and leaves trace edges in node blocks", () => {
  const trace = traceResult();
  const output = (() => {
    let stdout = "";
    printDecisionTrace(
      {
        ...trace,
        source: decisionPublishedSnapshotSource,
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
    /\[merge-source\] --归并--> \[merge-target\]: "归并说明"/
  );
  assert.doesNotMatch(
    output,
    /~ \[merge-target\] context active\/aligned 归并目标\n      \[merge-target\] --/
  );
  assert.match(
    output,
    /\[reallocation-source\] --重划--> \[reallocation-target\]: "重划说明一"/
  );
  assert.doesNotMatch(
    output,
    /~ \[reallocation-target\] context active\/aligned 重划目标\n      \[reallocation-target\] --/
  );
});

test("Decision trace retains every reallocation edge from a context source", () => {
  let output = "";
  printDecisionTrace(
    {
      source: decisionPublishedSnapshotSource,
      anchorId: "x" as never,
      contextIds: ["a" as never, "b" as never, "y" as never],
      coverage: { complete: true, stoppedBy: [] },
      direction: "both",
      entries: {
        a: entry("前序 A", []),
        b: entry("前序 B", []),
        x: entry("主体 X", [{ target: "a" as never, type: "重划" }]),
        y: entry("上下文 Y", [
          {
            summary: 'Y "承接" A',
            target: "a" as never,
            type: "重划"
          },
          { summary: "Y 承接 B", target: "b" as never, type: "重划" }
        ])
      },
      frontier: [],
      limits: { depth: 1, maxRecords: 4 },
      traceIds: ["x" as never]
    },
    false,
    {
      stderr: () => undefined,
      stdout: (text) => {
        output += text;
      }
    }
  );
  assert.match(
    output,
    /\[y\] --重划--> \[a\]: "Y \\"承接\\" A"\n      \[y\] --重划--> \[b\]: "Y 承接 B"/
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

test("Decision trace preserves unlayered nodes and historical outside and overlapping event ownership", async () => {
  const { readFile } = await import("node:fs/promises");
  const fixture = JSON.parse(
    await readFile(
      new URL("./fixtures/trace-render-goldens.json", import.meta.url),
      "utf8"
    )
  ) as {
    cases: {
      name: string;
      trace: Omit<DecisionTraceSuccess, "status" | "source">;
    }[];
  };
  for (const { name, trace } of fixture.cases) {
    let output = "";
    printDecisionTrace(
      { ...trace, source: decisionPublishedSnapshotSource },
      false,
      {
        stdout: (text) => {
          output += text;
        },
        stderr: () => undefined
      }
    );
    if (name === "chain-and-unlayered") {
      assert.match(output, /L0\* \[c\].*C/u);
      assert.match(output, /L1\* \[b\].*B/u);
      assert.match(output, /L2\* \[a\].*A/u);
      assert.match(output, /L3\* \[orphan\].*unlayered/u);
    } else if (name === "split-historical-owner") {
      const aBlock = output.match(
        /^L\d+\* \[a\][\s\S]*?(?=^L\d+\* |^coverage:)/mu
      )?.[0];
      const zBlock = output.match(
        /^L\d+\* \[z\][\s\S]*?(?=^L\d+\* |^coverage:)/mu
      )?.[0];
      assert.ok(aBlock);
      assert.ok(zBlock);
      assert.deepEqual(
        aBlock
          .split("  split-successors:\n")
          .slice(1)
          .map((group) =>
            Array.from(
              group.matchAll(/^    \* \[([^\]]+)\] trace\b/gmu),
              (match) => match[1]
            )
          ),
        [
          ["a", "b", "z"],
          ["a", "x"]
        ]
      );
      assert.doesNotMatch(zBlock, /split-successors:/u);
      assert.equal((output.match(/split-successors:/gu) ?? []).length, 2);
      assert.match(output, /\[a\] --拆分--> \[z\]/u);
      assert.match(output, /\[b\] --拆分--> \[z\]/u);
      assert.match(output, /\[x\] --拆分--> \[a\]/u);
      assert.equal((output.match(/L\d+\* \[a\]/gu) ?? []).length, 1);
    } else if (name === "merge-outside-owner") {
      const aBlock = output.match(
        /^L\d+\* \[a\][\s\S]*?(?=^L\d+\* |^coverage:)/mu
      )?.[0];
      const zBlock = output.match(
        /^L\d+\* \[z\][\s\S]*?(?=^L\d+\* |^coverage:)/mu
      )?.[0];
      assert.ok(aBlock);
      assert.ok(zBlock);
      assert.match(aBlock, /merge-predecessors:/u);
      assert.deepEqual(
        Array.from(
          aBlock.matchAll(/^    \* \[([^\]]+)\] trace\b/gmu),
          (match) => match[1]
        ),
        ["a", "b", "z"]
      );
      assert.doesNotMatch(zBlock, /merge-predecessors:/u);
      assert.equal((output.match(/merge-predecessors:/gu) ?? []).length, 1);
      assert.match(output, /\* \[a\] trace/u);
      assert.match(output, /\* \[b\] trace/u);
      assert.match(output, /\* \[z\] trace/u);
    } else {
      assert.equal((output.match(/merge-predecessors:/gu) ?? []).length, 1);
      assert.match(output, /~ \[a\] context/u);
      assert.match(output, /\[a\] --归并--> \[b\]: "context history"/u);
      assert.doesNotMatch(output, /L\d+\* \[(?:a|b)\]/u);
    }
  }
});

test("Decision trace rendering visits relation lists linearly for chains stars and many events", () => {
  for (const size of [10, 100, 1000]) {
    for (const shape of ["chain", "star", "events"]) {
      let reads = 0;
      const entries: Record<string, DecisionTraceSuccess["entries"][string]> =
        {};
      for (let index = 0; index < size; index += 1) {
        const id = `record-${String(index).padStart(4, "0")}`;
        const relations =
          index === 0
            ? []
            : [
                {
                  target: (shape === "star"
                    ? "record-0000"
                    : `record-${String(index - 1).padStart(4, "0")}`) as never,
                  type:
                    shape === "events" ? ("拆分" as const) : ("修订" as const)
                }
              ];
        entries[id] = {
          ...entry(id, relations),
          get relations() {
            reads += 1;
            return relations;
          }
        };
      }
      const ids = Object.keys(entries);
      const trace: Omit<DecisionTraceSuccess, "status"> = {
        source: decisionPublishedSnapshotSource,
        anchorId: ids[0] as never,
        direction: "successors",
        contextIds: [],
        traceIds: ids as never[],
        entries,
        frontier: [],
        coverage: { complete: true, stoppedBy: [] },
        limits: { depth: "all", maxRecords: size }
      };
      let output = "";
      printDecisionTrace(trace, false, {
        stdout: (text) => {
          output += text;
        },
        stderr: () => undefined
      });
      assert.equal((output.match(/^L\d+\*/gm) ?? []).length, size);
      assert.ok(
        reads <= size * 3,
        `${shape} V=${size}: ${reads} relation list accesses`
      );
    }
  }
});
