import assert from "node:assert/strict";
import test from "node:test";
import { renderInvestigationTrace } from "../src/trace-output.ts";
import type {
  InvestigationRelation,
  InvestigationReportTraceSuccess
} from "../src/types.ts";

function entry(title: string, relations: InvestigationRelation[] = []) {
  return {
    title,
    formedAt: "2026-08-28T12:00:00Z",
    question: "Q",
    tags: ["test"],
    relations
  };
}

test("trace renderer preserves source ordering summaries and context-only reverse edges", () => {
  const trace: InvestigationReportTraceSuccess = {
    status: "ok",
    anchorId: "center",
    direction: "successors",
    limits: { depth: "all", maxRecords: 4 },
    coverage: { complete: true, stoppedBy: [] },
    frontier: [],
    warnings: [],
    traceIds: ["z", "center", "A"],
    contextIds: ["context"],
    entries: {
      z: entry("Z", [{ type: "修正", target: "center", summary: 'a "quote"' }]),
      A: entry("A", [
        { type: "补充", target: "center" },
        { type: "复查", target: "center", summary: "second" }
      ]),
      center: entry("Center", [{ type: "补充", target: "outside" }]),
      context: entry("Context", [{ type: "补充", target: "z" }])
    }
  };
  assert.equal(
    renderInvestigationTrace(trace),
    [
      "TRACE anchor=[center] direction=successors depth=all complete=true records=4",
      "  Note: only relations within this trace slice are expanded; read source reports or use --json for complete direct relations.",
      "",
      "L0* [center] 2026-08-28T12:00:00Z Center",
      "  successors:",
      "    A --补充--> center [无摘要]",
      '    A --复查--> center "second"',
      '    z --修正--> center "a \\"quote\\""',
      "L1* [A] 2026-08-28T12:00:00Z A",
      "  predecessors:",
      "    A --补充--> center [无摘要]",
      '    A --复查--> center "second"',
      "L1* [z] 2026-08-28T12:00:00Z Z",
      "  predecessors:",
      '    z --修正--> center "a \\"quote\\""',
      "  successors:",
      "    context --补充--> z [无摘要]"
    ].join("\n")
  );
});

test("trace renderer preserves split context membership and complete blocked event text", () => {
  const trace: InvestigationReportTraceSuccess = {
    status: "ok",
    anchorId: "a",
    direction: "predecessors",
    limits: { depth: "all", maxRecords: 3 },
    warnings: [],
    coverage: { complete: false, stoppedBy: ["max-records"] },
    frontier: [
      {
        fromId: "base",
        direction: "predecessors",
        reason: "max-records",
        nextIds: ["outside"]
      }
    ],
    blockedEvent: {
      kind: "merge",
      recordIds: ["base", "outside", "other"],
      requiredMaxRecords: 5
    },
    traceIds: ["a", "base"],
    contextIds: ["b"],
    entries: {
      b: entry("B", [{ type: "拆分", target: "base", summary: "second" }]),
      a: entry("A", [{ type: "拆分", target: "base" }]),
      base: entry("Base")
    }
  };
  assert.equal(
    renderInvestigationTrace(trace),
    [
      "TRACE anchor=[a] direction=predecessors depth=all complete=false records=3",
      "  Note: only relations within this trace slice are expanded; read source reports or use --json for complete direct relations.",
      "",
      "L0* [a] 2026-08-28T12:00:00Z A",
      "L1* [base] 2026-08-28T12:00:00Z Base",
      "  split-successors:",
      "    * trace   [a] 2026-08-28T12:00:00Z A",
      "        a --拆分--> base [无摘要]",
      "    ~ context [b] 2026-08-28T12:00:00Z B",
      '        b --拆分--> base "second"',
      "",
      "BOUNDARY: coverage=incomplete stoppedBy=max-records",
      "  frontier from=[base] direction=predecessors reason=max-records next=[outside]",
      "  blocked-event kind=merge records=[base, outside, other] required-max-records=5"
    ].join("\n")
  );
});
