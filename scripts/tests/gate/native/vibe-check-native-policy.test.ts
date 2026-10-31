import assert from "node:assert/strict";
import test from "node:test";
import { createVibeNativeChecks } from "../../../lib/vibe-gate.ts";

test("project automation and test function limits stay independently configured", () => {
  const check = createVibeNativeChecks().find(
    ({ checkId }) => checkId === "function-metrics"
  );
  assert.ok(check?.options && typeof check.options === "object");
  const codeAreas: unknown = Reflect.get(check.options, "codeAreas");
  assert.ok(codeAreas !== null && typeof codeAreas === "object");
  for (const [areaId, expectedLimits] of [
    [
      "automation",
      {
        codeLines: {
          maximum: 80,
          lowComplexityAllowance: { cyclomaticComplexityBelow: 7, maximum: 220 }
        },
        cyclomaticComplexity: { maximum: 16 },
        nestingDepth: { maximum: 8 },
        parameters: { maximum: 7 }
      }
    ],
    [
      "tests",
      {
        codeLines: {
          maximum: 100,
          lowComplexityAllowance: { cyclomaticComplexityBelow: 8, maximum: 250 }
        },
        cyclomaticComplexity: { maximum: 20 },
        nestingDepth: { maximum: 10 },
        parameters: { maximum: 8 }
      }
    ]
  ] as const) {
    const area: unknown = Reflect.get(codeAreas, areaId);
    assert.ok(area !== null && typeof area === "object");
    assert.deepEqual(Reflect.get(area, "limits"), expectedLimits);
  }
});

test("project schema validation binds the two owned indexes to authoritative schemas", () => {
  const check = createVibeNativeChecks().find(
    ({ checkId }) => checkId === "json-schema-validation"
  );
  assert.ok(check?.options && typeof check.options === "object");
  const schemaOptions = check.options;
  assert.deepEqual(
    structuredClone(Reflect.get(schemaOptions, "schemaIdentity")),
    {
      mode: "configuration-authoritative"
    }
  );
  assert.deepEqual(structuredClone(Reflect.get(schemaOptions, "schemas")), [
    {
      id: "urn:skills:task-graph-index",
      path: "skills/task-graph/references/task-graph-index.schema.json"
    },
    {
      id: "urn:skills:test-evidence-index",
      path: "skills/test-evidence-review/references/schemas/test-evidence-state-index.schema.json"
    }
  ]);
  assert.deepEqual(structuredClone(Reflect.get(schemaOptions, "bindings")), [
    {
      id: "task-graph-index",
      instancePath: "docs/task-graph/task-graph-index.json",
      schemaId: "urn:skills:task-graph-index"
    },
    {
      id: "test-evidence-index",
      instancePath: "docs/test-evidence/test-evidence-index.json",
      schemaId: "urn:skills:test-evidence-index"
    }
  ]);
});
