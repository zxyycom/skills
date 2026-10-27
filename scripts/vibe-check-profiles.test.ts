import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { run } from "@zxyycom/vibe-check";
import { createGateDefinition, gateCheckIds } from "./lib/vibe-gate.ts";
import {
  outsideQuickScopeFlag,
  quickGateCheckIds
} from "./lib/vibe-gate/profiles.ts";
import { resolveGateInvocation, runVibeCheck } from "./vibe-check.ts";
import { passedDefinition } from "./vibe-check-cli-test-support.ts";
import { authoritativeGatePackageScripts } from "./validators/project-config.ts";
import { noOutput, withTemporaryDirectory } from "./vibe-check-test-support.ts";

test("project scopes parse independently from release compatibility arguments", () => {
  assert.equal(
    authoritativeGatePackageScripts["check:changed"],
    "bun run check --scope changed"
  );
  assert.equal(authoritativeGatePackageScripts.all, "bun run check:changed");
  for (const scope of ["quick", "changed", "full"] as const)
    assert.equal(resolveGateInvocation(["--scope", scope])?.scope, scope);
  for (const args of [
    ["--scope"],
    ["--scope", "release"],
    ["--scope", "unknown"],
    ["--scope", "quick", "--scope", "changed"],
    ["--scope", "changed", "--full"],
    ["--tag", "release", "--scope", "full"]
  ])
    assert.equal(resolveGateInvocation(args), null);
});

test("quick Definition retains the catalog while always enabling its necessary checks", () => {
  const quick = createGateDefinition([], {
    scope: "quick",
    activeToolIds: ["repository-code"]
  });
  const changed = createGateDefinition([], {
    activeToolIds: ["repository-code"]
  });
  assert.deepEqual(
    quick.checks.map(({ checkId }) => checkId),
    gateCheckIds()
  );
  const expectedQuickIds = [
    "gate-environment",
    "secret-detection",
    "json-validation",
    "json-schema-validation",
    "markdown-link-validation",
    "markdown-lint",
    "script:typecheck",
    "script:lint",
    "script:format:check",
    "script:validate"
  ];
  assert.deepEqual([...quickGateCheckIds].sort(), expectedQuickIds.toSorted());
  for (const [index, check] of quick.checks.entries()) {
    const complete = changed.checks[index]!;
    assert.deepEqual(check.dependsOn, complete.dependsOn, check.checkId);
    assert.deepEqual(
      check.resourceClaims,
      complete.resourceClaims,
      check.checkId
    );
    assert.deepEqual(
      check.enabledByFlags,
      expectedQuickIds.includes(check.checkId)
        ? undefined
        : {
            when:
              complete.enabledByFlags === undefined
                ? outsideQuickScopeFlag
                : {
                    kind: "all",
                    conditions: [
                      outsideQuickScopeFlag,
                      complete.enabledByFlags.when
                    ]
                  },
            propagateDependsOn: true
          },
      check.checkId
    );
  }
});

test("quick CLI skips workspace activation and preserves complete receipts", async () => {
  await withTemporaryDirectory("gate-quick-receipt-", async (directory) => {
    const cacheDirectory = path.join(directory, "cache");
    await fs.mkdir(cacheDirectory);
    const receiptPath = path.join(cacheDirectory, "receipts.json");
    await fs.writeFile(receiptPath, "existing proof\n");
    let preparationCalls = 0;
    let publicationCalls = 0;
    let selectedScope = "";
    const information: string[] = [];
    const exit = await runVibeCheck([], {
      continuousIntegration: false,
      createDefinition(invocation, plan, dependencies) {
        selectedScope = invocation.scope;
        assert.equal(plan, null);
        assert.equal(dependencies.scope, "quick");
        assert.equal(dependencies.activeToolIds, undefined);
        assert.equal(dependencies.selectionScopes, undefined);
        return passedDefinition();
      },
      createInvocationDirectory: () => directory,
      nowMilliseconds: () => 100,
      prepareActivation: async () => {
        preparationCalls += 1;
        throw new Error("unrelated workspace is unreadable");
      },
      publishReceipts: async () => {
        publicationCalls += 1;
        return { published: false, reason: "not-incremental" };
      },
      reportInfo: (message) => information.push(message),
      async runProject(definition, controls) {
        assert.deepEqual(controls.flags, []);
        return run(definition, { ...controls, outputs: noOutput });
      }
    });
    assert.equal(exit, 0);
    assert.equal(preparationCalls, 0);
    assert.equal(publicationCalls, 0);
    assert.equal(selectedScope, "quick");
    const scopeMessage = information.find((message) =>
      message.startsWith("Vibe Check scope:")
    );
    assert.ok(scopeMessage);
    assert.ok(scopeMessage.includes("fixed necessary baseline only"));
    assert.ok(
      scopeMessage.includes("add --scope <capability> for the current task")
    );
    assert.equal(scopeMessage.includes("check:changed"), false);
    assert.equal(await fs.readFile(receiptPath, "utf8"), "existing proof\n");
    await assert.rejects(
      fs.access(path.join(directory, "machine/gate-incremental.json")),
      { code: "ENOENT" }
    );
  });
});
