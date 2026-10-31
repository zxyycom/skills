import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { run } from "@zxyycom/vibe-check";
import * as v from "valibot";
import { createGateDefinition, gateCheckIds } from "../../../lib/vibe-gate.ts";
import type { GateToolId } from "../../../lib/vibe-gate/impact/impact-tools.ts";
import { fixtureGateWorkspaceSnapshot } from "../../../lib/vibe-gate/test-support.ts";
import { runVibeCheck } from "../../../vibe-check.ts";
import { observeGateActivation } from "../cli/vibe-check-cli-test-support.ts";
import {
  noOutput,
  withTemporaryDirectory
} from "../vibe-check-test-support.ts";

const necessaryIds = [
  "gate-environment",
  "secret-detection",
  "json-validation",
  "json-schema-validation",
  "markdown-link-validation",
  "markdown-lint"
];
const codeQualityIds = [
  "file-metrics",
  "function-metrics",
  "script:typecheck",
  "script:lint",
  "script:format:check"
];

test("selected scopes execute only the necessary set subscriptions and dependency closure", async () => {
  const scenarios: readonly Readonly<{
    scopes: readonly GateToolId[];
    additional: readonly string[];
    hasCode?: boolean;
  }>[] = [
    {
      scopes: ["gate-tests"],
      additional: ["script:test:check"],
      hasCode: true
    },
    {
      scopes: ["decision-stage-tests"],
      additional: ["test:decision-records:pending-stage"],
      hasCode: true
    },
    {
      scopes: ["mcpshell"],
      additional: [
        "script:check:skill-updaters",
        "test:mcpshell:initializer",
        "test:mcpshell:runtime",
        "test:mcpshell:public-distribution"
      ],
      hasCode: true
    },
    {
      scopes: ["mcpshell", "gate-tests", "mcpshell"],
      additional: [
        "script:check:skill-updaters",
        "script:test:check",
        "test:mcpshell:initializer",
        "test:mcpshell:runtime",
        "test:mcpshell:public-distribution"
      ],
      hasCode: true
    },
    {
      scopes: ["repository-code"],
      additional: ["duplicate-detection"],
      hasCode: true
    },
    {
      scopes: ["decision-collection"],
      additional: ["script:check:decisions"]
    },
    {
      scopes: ["repository-validation"],
      additional: ["script:validate"],
      hasCode: true
    },
    {
      scopes: ["skill-validator"],
      additional: [
        "script:validate",
        "script:test:skill-validator",
        "script:check:skill-updaters"
      ],
      hasCode: true
    }
  ];
  await withTemporaryDirectory("gate-selected-closure-", async (directory) => {
    for (const [index, scenario] of scenarios.entries()) {
      const executed: string[] = [];
      const expected = [
        ...necessaryIds,
        ...(scenario.hasCode ? codeQualityIds : []),
        ...scenario.additional
      ].sort();
      const outputDirectory = path.join(directory, String(index));
      const scopes = [...new Set(scenario.scopes)];
      const information: string[] = [];
      const errors: string[] = [];
      assert.equal(
        await runVibeCheck(
          scenario.scopes.flatMap((scope) => ["--scope", scope]),
          {
            continuousIntegration: false,
            nowMilliseconds: () => 0,
            createInvocationDirectory: () => outputDirectory,
            prepareActivation: async () => {
              throw new Error("must not read unrelated workspace changes");
            },
            publishReceipts: async () => {
              throw new Error("must not publish complete receipts");
            },
            createDefinition(invocation, plan, dependencies) {
              assert.equal(invocation.scope, "selected");
              assert.equal(plan, null);
              assert.deepEqual(dependencies.selectionScopes, scopes);
              assert.equal(dependencies.activeToolIds, undefined);
              const definition = createGateDefinition(
                invocation.tags,
                dependencies
              );
              assert.deepEqual(
                definition.checks.map(({ checkId }) => checkId),
                gateCheckIds()
              );
              for (const script of ["typecheck", "lint", "format:check"]) {
                const check = definition.checks.find(
                  ({ checkId }) => checkId === `script:${script}`
                );
                assert.ok(check?.options && typeof check.options === "object");
                assert.deepEqual(Reflect.get(check.options, "arguments"), [
                  "run",
                  script
                ]);
              }
              return observeGateActivation(definition, executed);
            },
            reportInfo: (message) => information.push(message),
            reportError: (message) => errors.push(message),
            async runProject(definition, controls) {
              assert.deepEqual(
                controls.flags,
                scopes.map((scope) => `gate-tool:${scope}`)
              );
              const result = await run(definition, {
                ...controls,
                outputs: noOutput,
                projectRoot: directory
              });
              assert.equal(result.kind, "completed");
              if (result.kind !== "completed")
                throw new Error("missing terminal facts");
              assert.equal(result.snapshot.checks.length, 69);
              for (const { checkId, outcome } of result.snapshot.checks)
                assert.equal(
                  outcome.status,
                  expected.includes(checkId) ? "passed" : "not-applicable",
                  checkId
                );
              return result;
            }
          }
        ),
        0,
        `${scopes.join(",")}: ${errors.join("\n")}`
      );
      assert.deepEqual(executed.toSorted(), expected);
      const summary = v.parse(
        v.looseObject({
          selection: v.looseObject({
            basis: v.string(),
            eligible: v.number(),
            execute: v.number(),
            reuse: v.number(),
            disabled: v.number(),
            requestedScopes: v.array(v.string()),
            eligibleCheckIds: v.array(v.string()),
            executedCheckIds: v.array(v.string()),
            dependencyCheckIds: v.array(v.string())
          })
        }),
        JSON.parse(
          await fs.readFile(
            path.join(outputDirectory, "machine/gate-performance.json"),
            "utf8"
          )
        ) as unknown
      );
      assert.equal(summary.selection.basis, "native-terminal-facts");
      assert.equal(summary.selection.eligible, expected.length);
      assert.equal(summary.selection.execute, expected.length);
      assert.equal(summary.selection.reuse, 0);
      assert.equal(summary.selection.disabled, 69 - expected.length);
      assert.deepEqual(summary.selection.requestedScopes, scopes);
      assert.deepEqual(summary.selection.eligibleCheckIds.toSorted(), expected);
      assert.deepEqual(summary.selection.executedCheckIds.toSorted(), expected);
      assert.deepEqual(
        summary.selection.dependencyCheckIds,
        scopes.includes("mcpshell") || scopes.includes("skill-validator")
          ? ["script:check:skill-updaters"]
          : []
      );
      assert.ok(information.join("\n").includes("selected"));
      await assert.rejects(
        fs.access(path.join(outputDirectory, "machine/gate-incremental.json")),
        { code: "ENOENT" }
      );
    }
  });
});

test("selected success and failure preserve receipts and do not enforce quick budgets", async () => {
  await withTemporaryDirectory("gate-selected-receipts-", async (directory) => {
    const receipt = path.join(directory, "receipts.json");
    await fs.writeFile(receipt, "prior complete proof\n");
    for (const fail of [false, true]) {
      let clockReads = 0;
      let publicationCalls = 0;
      const errors: string[] = [];
      const executed: string[] = [];
      const exit = await runVibeCheck(["--scope", "gate-tests"], {
        continuousIntegration: false,
        nowMilliseconds: () => (clockReads++ === 0 ? 0 : 60_000),
        createInvocationDirectory: () => path.join(directory, String(fail)),
        createDefinition: (invocation, _plan, dependencies) =>
          observeGateActivation(
            createGateDefinition(invocation.tags, dependencies),
            executed,
            fail ? "script:test:check" : undefined
          ),
        prepareActivation: async () => {
          throw new Error("no workspace scan");
        },
        publishReceipts: async () => {
          publicationCalls += 1;
          return { published: true, receiptCount: 999 };
        },
        reportInfo: () => undefined,
        reportError: (message) => errors.push(message),
        runProject: (definition, controls) =>
          run(definition, {
            ...controls,
            outputs: noOutput,
            projectRoot: directory
          })
      });
      assert.equal(exit, fail ? 1 : 0);
      assert.equal(publicationCalls, 0);
      assert.equal(
        await fs.readFile(receipt, "utf8"),
        "prior complete proof\n"
      );
      assert.equal(
        errors.some((message) => message.includes("performance budget failed")),
        false
      );
      assert.equal(
        errors.some((message) => message.includes("gate failed")),
        fail
      );
    }
  });
});

test("CI widens selected scopes to complete base without carrying narrowing flags", async () => {
  await withTemporaryDirectory("gate-selected-ci-", async (directory) => {
    const executed: string[] = [];
    let preparations = 0;
    let publications = 0;
    assert.equal(
      await runVibeCheck(["--scope", "gate-tests"], {
        continuousIntegration: true,
        nowMilliseconds: () => 0,
        createInvocationDirectory: () => directory,
        prepareActivation: async (invocation) => {
          preparations += 1;
          assert.equal(invocation.scope, "full");
          assert.equal(invocation.selectionScopes, undefined);
          return {
            kind: "incremental",
            snapshot: fixtureGateWorkspaceSnapshot(),
            cacheDirectory: path.join(directory, "cache"),
            activeCheckIds: [],
            activeToolIds: [],
            decisions: []
          };
        },
        publishReceipts: async () => {
          publications += 1;
          return { published: false, reason: "not-incremental" };
        },
        createDefinition(invocation, _plan, dependencies) {
          assert.equal(dependencies.selectionScopes, undefined);
          assert.equal(dependencies.activeToolIds, undefined);
          return observeGateActivation(
            createGateDefinition(invocation.tags, dependencies),
            executed
          );
        },
        reportInfo: () => undefined,
        reportError: () => undefined,
        async runProject(definition, controls) {
          assert.deepEqual(controls.flags, []);
          return run(definition, {
            ...controls,
            outputs: noOutput,
            projectRoot: directory
          });
        }
      }),
      0
    );
    assert.equal(preparations, 1);
    assert.equal(publications, 1);
    assert.deepEqual(
      executed.toSorted(),
      gateCheckIds()
        .filter(
          (id) =>
            ![
              "release:skill-prepare",
              "release:skill-version",
              "pack:skills"
            ].includes(id)
        )
        .toSorted()
    );
  });
});
