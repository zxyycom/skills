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
    optionsRecordOrNull(options.files)?.patterns
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
  return stringArray(maintainedFiles.patterns) ?? [];
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
        exclusions.includes(`!${historicalExclusion}`),
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
    assert.deepEqual(area.files, {
      ...expectedFiles,
      useDefaultExcludes: true
    });
    const exclusions = stringArray(
      optionsRecord(area.files, `missing files for ${areaId}`).patterns
    );
    for (const historicalExclusion of historicalContentExclusions) {
      assert.ok(exclusions?.includes(`!${historicalExclusion}`));
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
    assert.deepEqual(
      exclusions.filter((pattern) => !pattern.startsWith("!")),
      checkId === "json-validation"
        ? ["**/*.json"]
        : ["**/*.[mM][dD]", "**/*.[mM][aA][rR][kK][dD][oO][wW][nN]"]
    );
    for (const candidateExclusion of investigationAuthoringDocumentExclusions) {
      assert.ok(
        exclusions.includes(`!${candidateExclusion}`),
        `${checkId} must exclude ${candidateExclusion}`
      );
    }
  }
  assert.deepEqual(
    optionsRecord(optionsById.get("secret-detection"), "missing secret Check")
      .files,
    { ...maintainedSecretFiles, useDefaultExcludes: true }
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
      ["markdown-lint", { "repository-scan": 1 }],
      ["file-metrics", { "external-process": 1, "repository-scan": 1 }],
      ["function-metrics", { "repository-scan": 1 }]
    ]
  );
});

test("project Markdown lint uses exactly the six approved rules and maintained scope", async () => {
  const { defineConfig } = await import("@zxyycom/vibe-check");
  const fs = await import("node:fs/promises");
  const { runDefinition, outcomeFor, withTemporaryDirectory } =
    await import("./vibe-check-test-support.ts");
  await withTemporaryDirectory("gate-project-markdown-", async (directory) => {
    const check = createVibeNativeChecks(directory).find(
      ({ checkId }) => checkId === "markdown-lint"
    );
    assert.ok(check);
    const options = optionsRecord(check.options, "missing lint options");
    assert.equal(options.findingPolicy, "blocking");
    assert.deepEqual(options.rules, [
      "no-reversed-links",
      "no-missing-space-atx",
      "no-empty-links",
      "no-alt-text",
      "reference-links-images",
      "table-column-count"
    ]);
    for (const excluded of [
      "docs/investigations/_resources/a.md",
      "docs/investigations/_candidate.md",
      "skills/alpha/references/upstream/a.md",
      "skills/alpha/reference-original.md"
    ]) {
      await fs.mkdir(path.dirname(path.join(directory, excluded)), {
        recursive: true
      });
      await fs.writeFile(path.join(directory, excluded), "[broken]()\n");
    }
    await fs.writeFile(
      path.join(directory, "maintained.MARKDOWN"),
      "# Valid\n"
    );
    const passed = await runDefinition(
      defineConfig({ checks: [check] }),
      directory
    );
    assert.equal(passed.aggregate, "passed");
    await fs.writeFile(
      path.join(directory, "maintained.MARKDOWN"),
      "[broken]()\n"
    );
    const failed = await runDefinition(
      defineConfig({ checks: [check] }),
      directory
    );
    assert.equal(outcomeFor(failed, "markdown-lint").status, "failed");
    const data = outcomeFor(failed, "markdown-lint");
    assert.equal(data.status === "failed" && data.data.sourceFileCount, 1);
  });
});
