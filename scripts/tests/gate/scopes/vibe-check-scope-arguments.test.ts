import assert from "node:assert/strict";
import test from "node:test";
import { resolveGateInvocation, runVibeCheck } from "../../../vibe-check.ts";

test("CLI combines repeated capability scopes in first-seen order and accepts the Bun separator", () => {
  const expected = {
    scope: "selected",
    selectionScopes: ["gate-tests", "mcpshell"],
    cold: false,
    diagnosticLog: true,
    tags: []
  };
  const args = [
    "--scope",
    "gate-tests",
    "--scope",
    "mcpshell",
    "--scope",
    "gate-tests",
    "--diagnostic-log"
  ];
  assert.deepEqual(resolveGateInvocation(args), expected);
  assert.deepEqual(resolveGateInvocation(["--", ...args]), expected);
  assert.equal(
    resolveGateInvocation(["--", "--scope", "changed"])?.scope,
    "changed"
  );
});

test("CLI rejects unknown missing and mixed scopes before any Gate side effects", async () => {
  for (const args of [
    ["--scope"],
    ["--scope", "selected"],
    ["--scope", "not-a-capability"],
    ["--scope", "gate-tests", "--scope"],
    ["--scope", "gate-tests", "--scope", "quick"],
    ["--scope", "changed", "--scope", "gate-tests"],
    ["--scope", "gate-tests", "--scope", "full"],
    ["--scope", "mcpshell", "--tag", "release"],
    ["--full", "--scope", "mcpshell"],
    ["--scope", "mcpshell", "--cold"],
    ["--scope", "mcpshell", "--baseline-ref", "HEAD"],
    ["--", "--", "--scope", "mcpshell"],
    ["--scope", "mcpshell", "--unknown"]
  ]) {
    assert.equal(resolveGateInvocation(args), null, args.join(" "));
    const effects: string[] = [];
    const diagnostics: string[] = [];
    assert.equal(
      await runVibeCheck(args, {
        continuousIntegration: false,
        createDefinition: () => {
          effects.push("definition");
          throw new Error();
        },
        createInvocationDirectory: () => {
          effects.push("directory");
          return "unused";
        },
        prepareActivation: async () => {
          effects.push("prepare");
          throw new Error();
        },
        publishReceipts: async () => {
          effects.push("receipt");
          throw new Error();
        },
        runProject: async () => {
          effects.push("run");
          throw new Error();
        },
        reportError: (message) => diagnostics.push(message),
        reportInfo: (message) => effects.push(message)
      }),
      1
    );
    assert.deepEqual(effects, []);
    assert.equal(diagnostics.length, 1);
    assert.match(diagnostics[0]!, /Usage: bun run check/u);
  }
});

test("CLI lists discoverable capability scopes without constructing or executing a Gate", async () => {
  const information: string[] = [];
  const effects: string[] = [];
  assert.equal(
    await runVibeCheck(["--list-scopes"], {
      continuousIntegration: true,
      createDefinition: () => {
        effects.push("definition");
        throw new Error();
      },
      createInvocationDirectory: () => {
        effects.push("directory");
        return "unused";
      },
      prepareActivation: async () => {
        effects.push("prepare");
        throw new Error();
      },
      runProject: async () => {
        effects.push("run");
        throw new Error();
      },
      reportInfo: (message) => information.push(message),
      reportError: (message) => effects.push(message)
    }),
    0
  );
  assert.deepEqual(effects, []);
  for (const group of [
    "gate-tests",
    "task-graph",
    "decision-stage",
    "mcpshell"
  ])
    assert.ok(information.join("\n").includes(group), group);
});
