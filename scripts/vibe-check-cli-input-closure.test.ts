import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { run } from "@zxyycom/vibe-check";
import {
  activationFlagForTool,
  type GateActivationPlan
} from "./lib/vibe-gate.ts";
import { fixtureGateWorkspaceSnapshot } from "./lib/vibe-gate/test-support.ts";
import { runVibeCheck } from "./vibe-check.ts";
import { passedDefinition } from "./vibe-check-cli-test-support.ts";
import { noOutput, withTemporaryDirectory } from "./vibe-check-test-support.ts";

test("CLI locates unclosed inputs and keeps conservative execution and publication semantics", async () => {
  await withTemporaryDirectory(
    "gate-cli-unclosed-inputs-",
    async (directory) => {
      const files = [
        { path: "tools/decision-records/src/unreviewed.ts", kind: "file" },
        { path: "tools/unreviewed/src/value.ts", kind: "file" },
        { path: "tools/decision-records/src/link.ts", kind: "symlink" },
        { path: "tools/decision-records/src/pipe.ts", kind: "unsupported" }
      ] as const;
      const plan: GateActivationPlan = {
        activeCheckIds: ["passed"],
        activeToolIds: ["passed-tool"],
        cacheDirectory: path.join(directory, "cache"),
        decisions: [
          {
            action: "execute",
            checkId: "passed",
            fingerprint: null,
            reason: "conservative-fallback"
          }
        ],
        kind: "incremental",
        snapshot: {
          ...fixtureGateWorkspaceSnapshot(),
          files: files.map((file) => ({
            ...file,
            digest: "0".repeat(64),
            mode: 0o644,
            size: 0
          })),
          unclassifiedPaths: files.map((file) => file.path)
        }
      };
      const information: string[] = [];
      const diagnostics: string[] = [];
      let observedFlags: readonly string[] | undefined;
      const exitCode = await runVibeCheck([], {
        continuousIntegration: false,
        createDefinition: passedDefinition,
        createInvocationDirectory: () => directory,
        prepareActivation: async () => plan,
        reportError: (message) => diagnostics.push(message),
        reportInfo: (message) => information.push(message),
        async runProject(definition, controls) {
          observedFlags = controls.flags;
          return run(definition, { ...controls, outputs: noOutput });
        }
      });
      assert.equal(exitCode, 0);
      assert.deepEqual(diagnostics, []);
      assert.deepEqual(observedFlags, [activationFlagForTool("passed-tool")]);
      const summary = JSON.parse(
        await fs.readFile(
          path.join(directory, "machine", "gate-incremental.json"),
          "utf8"
        )
      );
      const entries = [
        { path: files[0].path, reason: "unowned-domain-input" },
        { path: files[1].path, reason: "unknown-input" },
        { path: files[2].path, reason: "symlink" },
        { path: files[3].path, reason: "unsupported-file-kind" }
      ];
      assert.deepEqual(summary.unclosedInputs, {
        entries,
        omittedCount: 0,
        total: 4
      });
      assert.equal(summary.mode, "incremental");
      assert.equal(summary.fallbackDetail, null);
      assert.deepEqual(summary.counts, {
        execute: 1,
        fallback: 1,
        firstRun: 0,
        reuse: 0
      });
      assert.deepEqual(summary.publication, {
        published: false,
        reason: "inputs-unclosed"
      });
      for (const entry of entries)
        assert.ok(information[0]?.includes(`${entry.path} (${entry.reason})`));
      assert.equal(information[0]?.includes("Snapshot fallback"), false);
      assert.equal(
        await fs.stat(plan.cacheDirectory).then(
          () => true,
          () => false
        ),
        false
      );
    }
  );
});

test("CLI bounds and sanitizes unclosed input diagnostics with exact omission counts", async () => {
  await withTemporaryDirectory("gate-cli-safe-unclosed-", async (directory) => {
    const providerToken = `ghp_${"a".repeat(24)}`;
    const paths = [
      "tools/decision-records/src/\u001bpassword=private-value.ts",
      "tools/decision-records/src/control\u001b\n\u202e.ts",
      `tools/decision-records/src/${"x".repeat(900)}.ts`,
      `tools/decision-records/src/\u001b${providerToken}.ts`,
      `tools/decision-records/src/${"\u001b".repeat(900)}.ts`,
      ...Array.from(
        { length: 7 },
        (_, index) => `tools/decision-records/src/omitted-${index}.ts`
      )
    ];
    const plan: GateActivationPlan = {
      activeCheckIds: ["passed"],
      activeToolIds: ["passed-tool"],
      cacheDirectory: path.join(directory, "cache"),
      decisions: [
        {
          action: "execute",
          checkId: "passed",
          fingerprint: null,
          reason: "conservative-fallback"
        }
      ],
      kind: "incremental",
      snapshot: {
        ...fixtureGateWorkspaceSnapshot(),
        files: paths.map((relativePath) => ({
          path: relativePath,
          kind: "file",
          digest: "0".repeat(64),
          mode: 0o644,
          size: 0
        })),
        unclassifiedPaths: paths
      }
    };
    const information: string[] = [];
    const exitCode = await runVibeCheck([], {
      continuousIntegration: false,
      createDefinition: passedDefinition,
      createInvocationDirectory: () => directory,
      prepareActivation: async () => plan,
      reportInfo: (message) => information.push(message),
      async runProject(definition, controls) {
        return run(definition, { ...controls, outputs: noOutput });
      }
    });
    assert.equal(exitCode, 0);
    const summaryText = await fs.readFile(
      path.join(directory, "machine", "gate-incremental.json"),
      "utf8"
    );
    const summary = JSON.parse(summaryText);
    assert.equal(summary.unclosedInputs.total, 12);
    assert.equal(summary.unclosedInputs.entries.length, 5);
    assert.equal(summary.unclosedInputs.omittedCount, 7);
    assert.match(
      summary.unclosedInputs.entries[0].path,
      /password=\[redacted\]/u
    );
    assert.equal(
      summary.unclosedInputs.entries[1].path,
      "tools/decision-records/src/control\\u001b \\u202e.ts"
    );
    assert.equal(summary.unclosedInputs.entries[2].path.length, 500);
    assert.match(summary.unclosedInputs.entries[3].path, /\[redacted\]/u);
    assert.equal(summary.unclosedInputs.entries[4].path.length, 500);
    assert.ok(information[0]!.length < 4_000);
    assert.match(information[0]!, /7 more omitted/u);
    for (const publicText of [summaryText, information.join("\n")]) {
      assert.equal(publicText.includes("private-value"), false);
      assert.equal(publicText.includes(providerToken), false);
      assert.equal(publicText.includes("omitted-0"), false);
      assert.equal(publicText.includes("\u001b"), false);
      assert.equal(publicText.includes("\u202e"), false);
    }
  });
});

test("CLI distinguishes safe snapshot acquisition failures from unclosed input diagnostics", async () => {
  await withTemporaryDirectory("gate-cli-safe-snapshot-", async (directory) => {
    const providerToken = `ghp_${"a".repeat(24)}`;
    for (const failure of [
      "Could not read Gate input tools/example.ts",
      "required tool probe failed"
    ]) {
      const fallbackPlan: GateActivationPlan = {
        activeCheckIds: ["passed"],
        activeToolIds: ["passed-tool"],
        cacheDirectory: path.join(directory, "cache"),
        decisions: [
          {
            action: "execute",
            checkId: "passed",
            fingerprint: null,
            reason: "snapshot-unavailable"
          }
        ],
        fallbackDetail: `${failure}; \u001bpassword=private-value; \u001b${providerToken}; /private/workspace/file; \u001b[31m`,
        kind: "fallback",
        snapshot: null
      };
      const information: string[] = [];
      const exitCode = await runVibeCheck([], {
        continuousIntegration: false,
        createDefinition: passedDefinition,
        createInvocationDirectory: () => directory,
        prepareActivation: async () => fallbackPlan,
        publishReceipts: async () => ({
          published: false,
          reason: "snapshot-unavailable",
          detail: fallbackPlan.fallbackDetail
        }),
        reportInfo: (message) => information.push(message),
        async runProject(definition, controls) {
          return run(definition, { ...controls, outputs: noOutput });
        }
      });
      assert.equal(exitCode, 0);
      const summaryText = await fs.readFile(
        path.join(directory, "machine", "gate-incremental.json"),
        "utf8"
      );
      const summary = JSON.parse(summaryText);
      assert.equal(summary.mode, "fallback");
      assert.equal(summary.unclosedInputs, null);
      assert.ok(summary.fallbackDetail.startsWith(failure));
      assert.equal(summary.publication.detail, summary.fallbackDetail);
      assert.match(information[0]!, /Snapshot fallback:/u);
      assert.equal(information[0]!.includes("Inputs unclosed"), false);
      for (const publicText of [summaryText, information.join("\n")]) {
        assert.equal(publicText.includes("private-value"), false);
        assert.equal(publicText.includes(providerToken), false);
        assert.equal(publicText.includes("/private/workspace"), false);
        assert.equal(publicText.includes("\u001b"), false);
      }
    }
  });
});
