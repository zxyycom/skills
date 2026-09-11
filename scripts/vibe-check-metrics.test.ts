import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  defineConfig,
  fileMetrics,
  functionMetrics,
  parseFileMetricsData,
  parseFunctionMetricsData
} from "@zxyycom/vibe-check";
import { createVibeNativeChecks } from "./lib/vibe-gate.ts";
import {
  noOutput,
  outcomeFor,
  runDefinition,
  withTemporaryDirectory
} from "./vibe-check-test-support.ts";

test("metric findings use blocking policy and measurement failures fail closed", async () => {
  await withTemporaryDirectory("skills-vibe-metrics-", async (directory) => {
    await fs.writeFile(
      path.join(directory, "fixture.ts"),
      [
        "export function fixture(value: number): number {",
        "  const one = value + 1;",
        "  const two = one + 2;",
        "  return two;",
        "}",
        ""
      ].join("\n"),
      "utf8"
    );
    const selection = {
      exclude: [],
      include: ["**/*.ts"],
      source: "filesystem"
    } as const;
    const fileCheck = fileMetrics({
      codeAreas: {
        fixture: {
          codeLines: {
            lowDecisionTokenAllowance: {
              maximumCodeLines: 2,
              maximumDecisionTokens: 0
            },
            maximum: 1
          },
          files: selection,
          findingPolicy: "blocking"
        }
      },
      findingPolicy: "blocking",
      findingWaivers: []
    });
    const functionCheck = functionMetrics({
      codeAreas: {
        fixture: {
          files: selection,
          findingPolicy: "blocking",
          limits: {
            codeLines: {
              lowComplexityAllowance: {
                cyclomaticComplexityBelow: 1,
                maximum: 2
              },
              maximum: 1
            },
            cyclomaticComplexity: { maximum: 100 },
            parameters: { maximum: 100 }
          }
        }
      },
      findingPolicy: "blocking",
      findingWaivers: []
    });
    const findings = await runDefinition(
      defineConfig({ checks: [fileCheck, functionCheck], outputs: noOutput }),
      directory
    );

    assert.equal(findings.aggregate, "failed");
    const fileOutcome = outcomeFor(findings, "file-metrics");
    const functionOutcome = outcomeFor(findings, "function-metrics");
    assert.equal(fileOutcome.status, "failed");
    assert.equal(functionOutcome.status, "failed");
    if (
      fileOutcome.status !== "failed" ||
      functionOutcome.status !== "failed"
    ) {
      throw new Error("metric findings must fail their Checks");
    }
    const fileData = parseFileMetricsData(fileOutcome.data);
    const functionData = parseFunctionMetricsData(functionOutcome.data);
    assert.ok(fileData.findingCount > 0);
    assert.equal(fileData.blockingFindingCount, fileData.findingCount);
    assert.ok(functionData.findingCount > 0);
    assert.equal(functionData.blockingFindingCount, functionData.findingCount);
    assert.deepEqual(fileCheck.options.findingWaivers, []);

    for (const checkId of ["file-metrics", "function-metrics"]) {
      const productionCheck = createVibeNativeChecks(directory).find(
        (check) => check.checkId === checkId
      );
      assert.ok(productionCheck?.options);
      const codeAreas = Reflect.get(productionCheck.options, "codeAreas");
      assert.ok(codeAreas !== null && typeof codeAreas === "object");
      for (const area of Object.values(codeAreas)) {
        assert.ok(area !== null && typeof area === "object");
        assert.equal(Reflect.get(area, "findingPolicy"), "blocking");
      }
    }

    const unavailable = await runDefinition(
      defineConfig({
        checks: [
          fileMetrics({
            codeAreas: { fixture: { files: selection } },
            findingWaivers: [],
            scanner: { executable: "missing-scc-for-vibe-test" }
          }),
          functionCheck
        ],
        outputs: noOutput
      }),
      directory
    );
    assert.equal(unavailable.aggregate, "failed");
    assert.equal(outcomeFor(unavailable, "file-metrics").status, "unavailable");
    assert.equal(outcomeFor(unavailable, "function-metrics").status, "failed");

    const notApplicable = await withTemporaryDirectory(
      "skills-vibe-empty-metrics-",
      async (emptyDirectory) =>
        runDefinition(
          defineConfig({
            checks: [
              functionMetrics({
                codeAreas: { fixture: { files: selection } }
              })
            ],
            outputs: noOutput
          }),
          emptyDirectory
        )
    );
    assert.equal(notApplicable.aggregate, "failed");
    assert.equal(
      notApplicable.snapshot.checks[0]?.outcome.status,
      "not-applicable"
    );
  });
});

test("function metrics uses the bundled analyzer without an external scanner", async () => {
  await withTemporaryDirectory(
    "skills-vibe-function-analyzer-",
    async (directory) => {
      await fs.writeFile(
        path.join(directory, "fixture.ts"),
        "export function fixture(value: number): number { return value + 1; }\n",
        "utf8"
      );
      const productionCheck = createVibeNativeChecks().find(
        ({ checkId }) => checkId === "function-metrics"
      );
      if (!productionCheck) {
        throw new Error("missing production function-metrics Check");
      }
      assert.ok(productionCheck.options);
      assert.equal(Object.hasOwn(productionCheck.options, "scanner"), false);

      const pathBefore = process.env.PATH;
      process.env.PATH = "";
      try {
        const result = await runDefinition(
          defineConfig({
            checks: [
              functionMetrics({
                codeAreas: {
                  fixture: {
                    files: {
                      exclude: [],
                      include: ["**/*.ts"],
                      source: "filesystem"
                    }
                  }
                }
              })
            ],
            outputs: noOutput
          }),
          directory
        );
        assert.equal(result.aggregate, "passed");
        assert.equal(outcomeFor(result, "function-metrics").status, "passed");
      } finally {
        if (pathBefore === undefined) {
          delete process.env.PATH;
        } else {
          process.env.PATH = pathBefore;
        }
      }
    }
  );
});
