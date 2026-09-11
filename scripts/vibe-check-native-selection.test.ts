import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  automationCodeFiles,
  createVibeNativeChecks,
  historicalContentExclusions,
  investigationAuthoringDocumentExclusions,
  maintainedSecretFiles,
  productCodeFiles,
  testCodeFiles,
  vibeNativeCheckIds
} from "./lib/vibe-gate.ts";

function nativeCheckExclusions(
  optionsById: ReadonlyMap<string, unknown>,
  checkId: string
): readonly string[] {
  const options = optionsRecord(
    optionsById.get(checkId),
    `missing options for ${checkId}`
  );
  const directExclusions = stringArray(
    optionsRecordOrNull(options.files)?.exclude
  );
  if (directExclusions !== null) return directExclusions;
  const codeAreas = optionsRecord(
    options.codeAreas,
    `missing file selection for ${checkId}`
  );
  const maintained = optionsRecord(
    codeAreas.maintained,
    `missing maintained code area for ${checkId}`
  );
  const maintainedFiles = optionsRecord(
    maintained.files,
    `missing maintained file selection for ${checkId}`
  );
  return stringArray(maintainedFiles.exclude) ?? [];
}

function codeAreaOptions(
  optionsById: ReadonlyMap<string, unknown>,
  checkId: string,
  areaId: string
): Record<string, unknown> {
  const options = optionsRecord(
    optionsById.get(checkId),
    `missing options for ${checkId}`
  );
  const codeAreas = optionsRecord(
    options.codeAreas,
    `missing code areas for ${checkId}`
  );
  return optionsRecord(
    codeAreas[areaId],
    `missing ${areaId} area for ${checkId}`
  );
}

function optionsRecord(value: unknown, error: string): Record<string, unknown> {
  const record = optionsRecordOrNull(value);
  if (record === null) throw new Error(error);
  return record;
}

function optionsRecordOrNull(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : null;
}

test("native file selections exclude historical content and authoring candidates", () => {
  const checks = createVibeNativeChecks();
  const optionsById = new Map(
    checks.map((check) => [check.checkId, check.options])
  );
  for (const checkId of vibeNativeCheckIds.filter(
    (candidate) => candidate !== "function-metrics"
  )) {
    const exclusions = nativeCheckExclusions(optionsById, checkId);
    for (const historicalExclusion of historicalContentExclusions) {
      assert.ok(
        exclusions.includes(historicalExclusion),
        `${checkId} must exclude ${historicalExclusion}`
      );
    }
  }
  for (const [areaId, expectedFiles] of [
    ["product", productCodeFiles],
    ["automation", automationCodeFiles],
    ["tests", testCodeFiles]
  ] as const) {
    const area = codeAreaOptions(optionsById, "function-metrics", areaId);
    assert.deepEqual(area.files, expectedFiles);
    const exclusions = stringArray(
      optionsRecord(area.files, `missing files for ${areaId}`).exclude
    );
    for (const historicalExclusion of historicalContentExclusions) {
      assert.ok(exclusions?.includes(historicalExclusion));
    }
  }
  assert.deepEqual(
    codeAreaOptions(optionsById, "function-metrics", "product").limits,
    {
      codeLines: {
        lowComplexityAllowance: {
          cyclomaticComplexityBelow: 5,
          maximum: 120
        },
        maximum: 45
      },
      cyclomaticComplexity: { maximum: 10 },
      nestingDepth: { maximum: 5 },
      parameters: { maximum: 5 }
    }
  );
  for (const checkId of ["json-validation", "markdown-link-validation"]) {
    const exclusions = nativeCheckExclusions(optionsById, checkId);
    for (const candidateExclusion of investigationAuthoringDocumentExclusions) {
      assert.ok(
        exclusions.includes(candidateExclusion),
        `${checkId} must exclude ${candidateExclusion}`
      );
    }
  }
  assert.deepEqual(
    optionsRecord(optionsById.get("secret-detection"), "missing secret Check")
      .files,
    maintainedSecretFiles
  );
  const markdownOptions = optionsRecord(
    optionsById.get("markdown-link-validation"),
    "missing Markdown Check"
  );
  const markdownCache = optionsRecord(
    markdownOptions.cache,
    "missing Markdown cache"
  );
  assert.equal(markdownCache.enabled, true);
  assert.equal(path.isAbsolute(String(markdownCache.directory)), true);
  assert.deepEqual(
    checks.map(({ checkId, resourceClaims }) => [checkId, resourceClaims]),
    [
      ["duplicate-detection", { "repository-scan": 1 }],
      ["secret-detection", { "repository-scan": 1 }],
      ["json-validation", { "repository-scan": 1 }],
      ["json-schema-validation", { "repository-scan": 1 }],
      ["markdown-link-validation", { "repository-scan": 1 }],
      ["file-metrics", { "external-process": 1, "repository-scan": 1 }],
      ["function-metrics", { "repository-scan": 1 }]
    ]
  );
});
