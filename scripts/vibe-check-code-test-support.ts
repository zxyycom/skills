import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  collectProjectFiles,
  defineCheck,
  defineConfig
} from "@zxyycom/vibe-check";
import type { Check, ProjectDefinition } from "@zxyycom/vibe-check";
import * as v from "valibot";
import { createGateDefinition } from "./lib/vibe-gate.ts";
import type { GateToolId } from "./lib/vibe-gate/impact-tools.ts";

export const metricIds = ["file-metrics", "function-metrics"];
const codeAreasSchema = v.looseObject({
  codeAreas: v.record(
    v.string(),
    v.looseObject({
      files: v.object({
        patterns: v.array(v.string()),
        useDefaultExcludes: v.optional(v.boolean())
      })
    })
  )
});
export const findingSchema = v.object({
  functionName: v.string(),
  limit: v.number(),
  metric: v.string(),
  path: v.string(),
  value: v.number()
});
const healthyFunction = "export function healthy() { return 1; }\n";
export const sixParameterFunction =
  "export function tooMany(a: number, b: number, c: number, d: number, e: number, f: number) { return a; }\n";

export async function writeFiles(
  directory: string,
  files: readonly string[],
  content: string = healthyFunction
): Promise<void> {
  for (const file of files) {
    const target = path.join(directory, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }
}

export function selectedDefinition(
  scopes: readonly GateToolId[]
): ProjectDefinition {
  return createGateDefinition([], {
    scope: "selected",
    selectionScopes: scopes
  });
}

export function checkFor(
  definition: ProjectDefinition,
  checkId: string
): Check {
  const check = definition.checks.find((entry) => entry.checkId === checkId);
  assert.ok(check, `missing ${checkId}`);
  return check;
}

export function assertMetricFiles(
  definition: ProjectDefinition,
  directory: string,
  expected: readonly string[]
): void {
  for (const checkId of metricIds) {
    const { codeAreas } = v.parse(
      codeAreasSchema,
      checkFor(definition, checkId).options
    );
    const actual = new Set(
      Object.values(codeAreas).flatMap(({ files }) =>
        collectProjectFiles({ projectRoot: directory, selection: files })
      )
    );
    assert.deepEqual([...actual].sort(), [...expected].sort(), checkId);
  }
}

export function isolatedFunctionDefinition(
  definition: ProjectDefinition
): ProjectDefinition {
  return isolatedChecks(definition, ["function-metrics"]);
}

export function isolatedChecks(
  definition: ProjectDefinition,
  checkIds: readonly string[]
): ProjectDefinition {
  return defineConfig({
    checks: [
      defineCheck({
        checkId: "gate-environment",
        displayName: "Isolated passing environment",
        execute: () => ({ status: "passed", data: {} })
      }),
      ...checkIds.map((id) => checkFor(definition, id))
    ],
    scheduler: { resourceCapacities: { "cpu-work": 4 } }
  });
}
