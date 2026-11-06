import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Domain = "decisions" | "investigations";
export type Scenario = {
  name: string;
  domain: Domain;
  args: string[];
  expectedIds: string[];
  expectedTotal?: number;
  trace?: TraceExpected;
  mutable?: boolean;
};
type Traversal = [string, string];
type TraceExpected = {
  trace: number[];
  context: number[];
  complete: boolean;
  stopped: string[];
  frontier?: unknown[];
  blocked?: unknown;
};
const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
export const oldCli: Record<Domain, string> = {
  decisions: path.join(
    repository,
    "skills/decision-records/scripts/decision-records.ts"
  ),
  investigations: path.join(
    repository,
    "skills/investigation-report/scripts/check-investigations.ts"
  )
};
export const executable: Record<Domain, string> = {
  decisions: "decision-records",
  investigations: "investigation-report"
};
const id = (n: number): string => `260101-record-${String(n).padStart(5, "0")}`;

export function scenarios(
  count: number,
  width: number,
  depth: number
): Scenario[] {
  const all = Array.from({ length: count }, (_, index) => id(index));
  const ordinaryRoot = 10 + width + depth;
  const longGraph = Array.from(
    { length: width + depth + 1 },
    (_, index) => 9 + index
  );
  const split = {
    kind: "split",
    recordIds: [id(0), id(1), id(2)],
    requiredMaxRecords: 3
  };
  const splitFrontier = [
    {
      fromId: id(0),
      direction: "successors",
      reason: "max-records",
      nextIds: [id(1), id(2)]
    }
  ];
  return (["decisions", "investigations"] as const).flatMap(
    (domain): Scenario[] => {
      const selectAll = domain === "decisions" ? ["--status", "all"] : [];
      const merge =
        domain === "decisions"
          ? {
              kind: "reallocation",
              recordIds: [5, 6, 7, 8].map(id),
              requiredMaxRecords: 4
            }
          : {
              kind: "merge",
              recordIds: [5, 6, 7].map(id),
              requiredMaxRecords: 3
            };
      const makeTrace = (
        name: string,
        anchor: number,
        traversal: Traversal,
        budget: number,
        expected: TraceExpected
      ): Scenario => ({
        name,
        domain,
        args: [
          "trace",
          id(anchor),
          "--direction",
          traversal[0],
          "--depth",
          traversal[1],
          "--max-records",
          String(budget),
          "--json"
        ],
        expectedIds: expected.trace.map(id),
        trace: expected
      });
      return [
        {
          name: "list",
          domain,
          args: ["list", "--limit", "10", ...selectAll],
          expectedIds: all.slice(0, 10),
          expectedTotal: count
        },
        ...(["metadata", "content"] as const).map((scope) => ({
          name: `search-${scope}`,
          domain,
          args: ["search", "record-00007", "--in", scope, ...selectAll],
          expectedIds: [id(7)]
        })),
        makeTrace("split-budget", 0, ["successors", "2"], 2, {
          trace: [0],
          context: [],
          complete: false,
          stopped: ["max-records"],
          frontier: splitFrontier,
          blocked: split
        }),
        makeTrace("depth-frontier", 1, ["successors", "1"], 20, {
          trace: [1, 3],
          context: [],
          complete: false,
          stopped: ["depth"],
          frontier: [
            {
              fromId: id(3),
              direction: "successors",
              reason: "depth",
              nextIds: [id(4)]
            }
          ]
        }),
        makeTrace("event-budget", 5, ["successors", "all"], 2, {
          trace: [5],
          context: [],
          complete: false,
          stopped: ["max-records"],
          frontier: [
            {
              fromId: id(5),
              direction: "successors",
              reason: "max-records",
              nextIds: [id(7)]
            }
          ],
          blocked: merge
        }),
        makeTrace("event-context", 5, ["successors", "1"], 4, {
          trace: [5, 7],
          context: domain === "decisions" ? [6, 8] : [6],
          complete: true,
          stopped: [],
          frontier: []
        }),
        makeTrace(
          "width-depth",
          9 + width + depth,
          ["predecessors", "all"],
          width + depth + 2,
          {
            trace: longGraph,
            context: [],
            complete: true,
            stopped: [],
            frontier: []
          }
        ),
        ...(domain === "investigations" && count >= ordinaryRoot + width + 1
          ? [
              makeTrace(
                "ordinary-width-budget",
                ordinaryRoot,
                ["successors", "all"],
                2,
                {
                  trace: [ordinaryRoot, ordinaryRoot + 1],
                  context: [],
                  complete: false,
                  stopped: ["max-records"],
                  frontier: [
                    {
                      fromId: id(ordinaryRoot),
                      direction: "successors",
                      reason: "max-records",
                      nextIds: Array.from({ length: width - 1 }, (_, offset) =>
                        id(ordinaryRoot + offset + 2)
                      )
                    }
                  ]
                }
              )
            ]
          : []),
        {
          name: "sync",
          domain,
          args: ["sync-index"],
          expectedIds: [],
          mutable: true
        }
      ];
    }
  );
}

export function invoke(
  command: string,
  args: string[],
  cwd: string
): { stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.error || result.status !== 0 || result.signal)
    throw new Error(
      `${command} ${args.join(" ")} failed: status=${result.status} signal=${result.signal} ${result.error?.message ?? result.stderr}`
    );
  return { stdout: result.stdout, stderr: result.stderr };
}
function object(value: unknown): Record<string, unknown> {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    "expected JSON object"
  );
  return Object.fromEntries(Object.entries(value));
}
function array(value: unknown): unknown[] {
  assert.ok(Array.isArray(value), "expected JSON array");
  return value;
}
function idsFromText(text: string): string[] {
  return [...new Set(text.match(/260101-record-\d{5}/g) ?? [])].sort();
}
function traceCheck(value: unknown, expected: TraceExpected): void {
  const trace = object(value);
  assert.deepEqual(trace.traceIds, expected.trace.map(id));
  assert.deepEqual(trace.contextIds, expected.context.map(id));
  assert.deepEqual(trace.coverage, {
    complete: expected.complete,
    stoppedBy: expected.stopped
  });
  assert.deepEqual(trace.frontier, expected.frontier ?? []);
  if (expected.blocked) assert.deepEqual(trace.blockedEvent, expected.blocked);
  else assert.equal(trace.blockedEvent, undefined);
}

export function verifyQuery(
  scenario: Scenario,
  root: string,
  binaryDir: string
): { old: string; native: string } {
  assert.equal(scenario.mutable, undefined);
  const old = invoke(
    process.execPath,
    [oldCli[scenario.domain], "--root", root, ...scenario.args],
    repository
  );
  const nativeArgs = scenario.trace
    ? scenario.args
    : [...scenario.args, "--json"];
  const native = invoke(
    path.join(binaryDir, executable[scenario.domain]),
    [...nativeArgs, "--root", root],
    repository
  );
  if (scenario.trace) {
    const left: unknown = JSON.parse(old.stdout);
    const right: unknown = JSON.parse(native.stdout);
    traceCheck(left, scenario.trace);
    traceCheck(right, scenario.trace);
    assert.deepEqual(
      right,
      left,
      `${scenario.domain} ${scenario.name} trace mismatch`
    );
    return { old: old.stdout, native: native.stdout };
  }
  verifyListOrSearch(scenario, old.stdout, native.stdout);
  return { old: old.stdout, native: native.stdout };
}

function verifyListOrSearch(
  scenario: Scenario,
  old: string,
  native: string
): void {
  assert.deepEqual(
    idsFromText(old),
    [...scenario.expectedIds].sort(),
    `${scenario.domain} ${scenario.name} old CLI IDs`
  );
  const envelope = object(JSON.parse(native));
  assert.equal(envelope.ok, true);
  const result = object(envelope.result);
  const entries = array(
    scenario.domain === "decisions" ? result.records : result.entries
  );
  const actual = entries.map(
    (entry) =>
      object(entry)[scenario.domain === "decisions" ? "decisionId" : "id"]
  );
  assert.deepEqual(
    actual,
    scenario.expectedIds,
    `${scenario.domain} ${scenario.name} native IDs`
  );
  if (scenario.name === "list") {
    assert.equal(result.limit, 10);
    assert.equal(result.offset, 0);
    assert.equal(result.total, scenario.expectedTotal);
    assert.equal(object(result.facets).recordCount, scenario.expectedTotal);
    assert.ok(old.includes(`Showing 10 of ${scenario.expectedTotal} matches`));
  }
  if (scenario.name.startsWith("search"))
    verifySearchCoverage(scenario, result, old);
}

function verifySearchCoverage(
  scenario: Scenario,
  result: Record<string, unknown>,
  old: string
): void {
  const info = object(result.searchInfo);
  const coverage = object(info.coverage);
  assert.equal(coverage.scanComplete, true);
  assert.equal(coverage.resultsComplete, true);
  assert.equal(
    coverage.previewsComplete,
    scenario.name === "search-metadata" ? null : true
  );
  assert.match(
    old,
    scenario.name === "search-metadata"
      ? /Coverage: scan=complete results=complete previews=n\/a reasons=none/
      : /Coverage: scan=complete results=complete previews=complete reasons=none/
  );
  assert.deepEqual(object(info.counts).matched, {
    value: 1,
    precision: "exact"
  });
}
