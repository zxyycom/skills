/* oxlint-disable no-unused-vars -- Split test modules retain shared fixture imports for their focused scenario files. */
import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import * as v from "valibot";
import {
  buildStateIndex,
  defineStateIndexDefinition,
  parseStateIndex,
  queryStateIndex,
  serializeStateIndex
} from "../src/index.ts";
import { resultValue } from "./support.ts";

import {
  createScaleDefinition,
  scaleStateSchema,
  type ScaleState
} from "./performance-definition.ts";

type BenchmarkResult = {
  buildMs: number;
  count: number;
  parseMs: number;
  queryMs: number;
  serializedBytes: number;
};

export async function testPerformance(): Promise<void> {
  const oneThousand = await benchmark(1_000);
  const fiveThousand = await benchmark(5_000);

  assert.ok(oneThousand.buildMs < 3_000, JSON.stringify(oneThousand));
  assert.ok(oneThousand.queryMs < 500, JSON.stringify(oneThousand));
  assert.ok(fiveThousand.buildMs < 15_000, JSON.stringify(fiveThousand));
  assert.ok(fiveThousand.queryMs < 1_500, JSON.stringify(fiveThousand));
  assert.ok(
    fiveThousand.buildMs <= Math.max(oneThousand.buildMs * 8, 1_000),
    `build growth is unexpectedly superlinear: ${JSON.stringify({ oneThousand, fiveThousand })}`
  );

  console.log(
    "Index runtime scale:",
    JSON.stringify({
      fiveThousand,
      oneThousand
    })
  );
}

test("runtime materializes and queries large state collections within bounds", () =>
  testPerformance());

async function benchmark(count: number): Promise<BenchmarkResult> {
  const states = Array.from({ length: count }, (_, index): ScaleState => ({
    body: `State ${index} proves deterministic key filtering at long-lived project scale.`,
    createdAt: 1_700_000_000_000 + index,
    id: `state-${String(index).padStart(5, "0")}`,
    status: index % 4 === 0 ? "archived" : "active",
    tags: [`group-${index % 20}`, `bucket-${index % 7}`],
    title: `Indexed state ${index}`
  }));
  const stateRecord = Object.fromEntries(
    states.map((state) => [state.id, state])
  );
  const sourceRevision = {
    entries: Object.fromEntries(
      states.map((state) => [state.id, `scale-${count}:${state.id}`])
    ),
    metadata: `scale-${count}:metadata`
  };
  const definition = createScaleDefinition({ sourceRevision, stateRecord });

  const buildStart = performance.now();
  const index = resultValue(await buildStateIndex(definition, { root: "." }));
  const buildMs = performance.now() - buildStart;
  const text = serializeStateIndex(index, definition);

  const parseStart = performance.now();
  const parsed = resultValue(
    parseStateIndex({
      definition,
      expectation: { definitionVersion: 1, namespace: "scale" },
      sourcePath: "scale.json",
      text
    })
  );
  const parseMs = performance.now() - parseStart;

  const queryStart = performance.now();
  const queried = resultValue(
    queryStateIndex({
      definition,
      index: parsed,
      query: {
        filters: [
          { key: "status", kind: "exact", operator: "all", values: ["active"] },
          { key: "tag", kind: "exact", operator: "all", values: ["group-3"] },
          { key: "text", kind: "text", operator: "all", text: "project scale" }
        ],
        limit: 50,
        sort: [{ direction: "desc", key: "created-at" }]
      }
    })
  );
  const queryMs = performance.now() - queryStart;
  assert.ok(queried.total > 0);
  assert.ok(queried.entries.length <= 50);

  return {
    buildMs: round(buildMs),
    count,
    parseMs: round(parseMs),
    queryMs: round(queryMs),
    serializedBytes: Buffer.byteLength(text)
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
