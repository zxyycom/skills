import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import * as v from "valibot";
import { createVibeNativeChecks, vibeNativeCheckIds } from "./lib/vibe-gate.ts";

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
  const patterns = stringArray(maintainedFiles.patterns);
  assert.ok(patterns, `missing maintained patterns for ${checkId}`);
  return patterns;
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
  const parsed = v.safeParse(v.record(v.string(), v.unknown()), value);
  return parsed.success ? parsed.output : null;
}

function stringArray(value: unknown): string[] | null {
  if (value === undefined) return null;
  return v.parse(v.array(v.string()), value);
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
    for (const historicalExclusion of ["docs/investigations/_resources/**"]) {
      assert.ok(
        exclusions.includes(`!${historicalExclusion}`),
        `${checkId} must exclude ${historicalExclusion}`
      );
    }
  }
  for (const [areaId, requiredPatterns] of [
    ["product", ["tools/**/*.{js,ts}", "!tools/**/tests/**"]],
    ["automation", ["scripts/**/*.{js,ts}", "!scripts/**/*.test.{js,ts}"]],
    ["tests", ["scripts/**/*.test.{js,ts}", "tools/**/tests/**/*.{js,ts}"]]
  ] as const) {
    const area = codeAreaOptions(optionsById, "function-metrics", areaId);
    assert.equal(
      optionsRecord(area.files, `missing files for ${areaId}`)
        .useDefaultExcludes,
      false
    );
    const exclusions = stringArray(
      optionsRecord(area.files, `missing files for ${areaId}`).patterns
    );
    for (const pattern of [
      ...requiredPatterns,
      "!docs/investigations/_resources/**"
    ]) {
      assert.ok(
        exclusions?.includes(pattern),
        `${areaId} must select ${pattern}`
      );
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
    for (const candidateExclusion of ["docs/investigations/_candidate.*"]) {
      assert.ok(
        exclusions.includes(`!${candidateExclusion}`),
        `${checkId} must exclude ${candidateExclusion}`
      );
    }
  }
  const secretFiles = optionsRecord(
    optionsRecord(optionsById.get("secret-detection"), "missing secret Check")
      .files,
    "missing secret files"
  );
  assert.equal(secretFiles.useDefaultExcludes, false);
  assert.ok(stringArray(secretFiles.patterns)?.includes(".githooks/*"));
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

test("project secret detection keeps its limits and scans selected source and hook files", async () => {
  const { defineConfig } = await import("@zxyycom/vibe-check");
  const fs = await import("node:fs/promises");
  const { runDefinition, outcomeFor, withTemporaryDirectory } =
    await import("./vibe-check-test-support.ts");
  await withTemporaryDirectory("gate-secret-selection-", async (directory) => {
    const check = createVibeNativeChecks(directory).find(
      ({ checkId }) => checkId === "secret-detection"
    );
    assert.ok(check);
    const options = optionsRecord(check.options, "missing secret options");
    assert.equal(options.maximumFileCount, 5_120);
    assert.equal(options.maximumFileBytes, 1_048_576);
    assert.equal(options.maximumTotalBytes, 67_108_864);
    assert.deepEqual(options.findingWaivers, []);
    await fs.mkdir(path.join(directory, "scripts"));
    await fs.mkdir(path.join(directory, ".githooks"));
    await fs.writeFile(
      path.join(directory, "scripts/source.ts"),
      "export {};\n"
    );
    await fs.writeFile(
      path.join(directory, ".githooks/pre-commit"),
      "#!/bin/sh\nexit 0\n"
    );
    await fs.writeFile(path.join(directory, "tsconfig.json"), "{}\n");
    const passed = await runDefinition(
      defineConfig({ checks: [check] }),
      directory
    );
    assert.equal(passed.aggregate, "passed");
    const outcome = outcomeFor(passed, "secret-detection");
    assert.equal(outcome.status, "passed");
    assert.deepEqual(outcome.status === "passed" ? { ...outcome.data } : null, {
      selectedFileCount: 3,
      scannedFileCount: 3,
      findingCount: 0,
      waivedFindingCount: 0,
      coverageGapCount: 0
    });
  });
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

test("project Markdown lint consumes only its receipt capability flag in incremental mode", async () => {
  const { defineConfig } = await import("@zxyycom/vibe-check");
  const fs = await import("node:fs/promises");
  const { runDefinition, outcomeFor, withTemporaryDirectory } =
    await import("./vibe-check-test-support.ts");
  await withTemporaryDirectory(
    "gate-markdown-receipt-flags-",
    async (directory) => {
      await fs.writeFile(path.join(directory, "document.md"), "[broken]()\n");
      const check = createVibeNativeChecks(directory, {
        incremental: true
      }).find(({ checkId }) => checkId === "markdown-lint");
      assert.ok(check);
      const definition = defineConfig({ checks: [check] });
      const reused = await runDefinition(definition, directory, [
        "gate-tool:repository-code"
      ]);
      assert.equal(
        outcomeFor(reused, "markdown-lint").status,
        "not-applicable"
      );
      const executed = await runDefinition(definition, directory, [
        "gate-tool:markdown-content"
      ]);
      assert.equal(outcomeFor(executed, "markdown-lint").status, "failed");
    }
  );
});

test("project Markdown links still observe non-Markdown target deletion without receipt flags", async () => {
  const { defineConfig } = await import("@zxyycom/vibe-check");
  const fs = await import("node:fs/promises");
  const { runDefinition, outcomeFor, withTemporaryDirectory } =
    await import("./vibe-check-test-support.ts");
  await withTemporaryDirectory(
    "gate-markdown-links-always-",
    async (directory) => {
      await fs.writeFile(
        path.join(directory, "document.md"),
        "[target](target.ts)\n"
      );
      await fs.writeFile(path.join(directory, "target.ts"), "export {};\n");
      const check = createVibeNativeChecks(directory, {
        incremental: true
      }).find(({ checkId }) => checkId === "markdown-link-validation");
      assert.ok(check);
      assert.equal(check.enabledByFlags, undefined);
      const definition = defineConfig({ checks: [check] });
      const before = await runDefinition(definition, directory);
      assert.equal(
        outcomeFor(before, "markdown-link-validation").status,
        "passed"
      );
      await fs.rm(path.join(directory, "target.ts"));
      const after = await runDefinition(definition, directory);
      assert.equal(
        outcomeFor(after, "markdown-link-validation").status,
        "failed"
      );
    }
  );
});
