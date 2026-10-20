import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { run } from "@zxyycom/vibe-check";
import type { ProjectDefinition, RunControls } from "@zxyycom/vibe-check";
import { gateInvocationOutputControls, runVibeCheck } from "./vibe-check.ts";
import {
  capturedCliDependencies,
  createCliCapture,
  failedDefinition,
  invalidDefinition,
  passedDefinition,
  runInProject,
  unknownDependencyDefinition
} from "./vibe-check-cli-test-support.ts";
import {
  repositoryRoot,
  withTemporaryDirectory
} from "./vibe-check-test-support.ts";

test("CLI maps successful invocations and diagnostic log artifacts", async () => {
  const capture = createCliCapture();
  const dependencies = capturedCliDependencies(capture);
  assert.equal(await runVibeCheck([], dependencies), 0);
  assert.deepEqual(capture.selectedInvocation, {
    cold: false,
    diagnosticLog: false,
    tags: []
  });
  assert.match(capture.information.at(-1) ?? "", /^Vibe Check artifacts: /u);
  assert.equal(
    await runVibeCheck(
      ["--full", "--baseline-ref", "origin/release"],
      dependencies
    ),
    0
  );
  assert.deepEqual(capture.selectedInvocation, {
    baselineRef: "origin/release",
    cold: false,
    diagnosticLog: false,
    tags: ["release"]
  });

  capture.information.length = 0;
  let diagnosticControls: unknown;
  let invocationDirectory = "";
  await withTemporaryDirectory(
    "skills-vibe-diagnostic-log-",
    async (directory) => {
      invocationDirectory = path.join(directory, "invocation");
      assert.equal(
        await runVibeCheck(["--diagnostic-log"], {
          ...dependencies,
          createInvocationDirectory: () => invocationDirectory,
          async runProject(definition, controls) {
            diagnosticControls = controls;
            return await runInProject(definition, controls, directory);
          }
        }),
        0
      );
    }
  );
  assert.deepEqual(capture.selectedInvocation, {
    cold: false,
    diagnosticLog: true,
    tags: []
  });
  assert.deepEqual(diagnosticControls, {
    ...gateInvocationOutputControls(invocationDirectory, true),
    flags: [],
    projectRoot: repositoryRoot
  });
  assert.match(capture.information.at(-3) ?? "", /^Vibe Check artifacts: /u);
  assert.match(
    capture.information.at(-2) ?? "",
    /^Vibe Check diagnostic log \(core\): .*core\.log$/u
  );
  assert.match(
    capture.information.at(-1) ?? "",
    /^Vibe Check diagnostic log \(scheduler\): .*scheduler\.log$/u
  );
});

test("CLI reports diagnostic paths after a completed failing Gate", async () => {
  const capture = createCliCapture();
  await withTemporaryDirectory(
    "skills-vibe-diagnostic-log-failure-",
    async (directory) => {
      assert.equal(
        await runVibeCheck(["--diagnostic-log"], {
          ...capturedCliDependencies(capture, failedDefinition()),
          createInvocationDirectory: () => path.join(directory, "invocation"),
          async runProject(definition, controls) {
            return await runInProject(definition, controls, directory);
          }
        }),
        1
      );
    }
  );
  assert.match(
    capture.diagnostics.at(-1) ?? "",
    /Vibe Check gate failed: failed/u
  );
  assert.match(capture.information.at(-3) ?? "", /^Vibe Check artifacts: /u);
  assert.match(
    capture.information.at(-2) ?? "",
    /^Vibe Check diagnostic log \(core\): .*core\.log$/u
  );
  assert.match(
    capture.information.at(-1) ?? "",
    /^Vibe Check diagnostic log \(scheduler\): .*scheduler\.log$/u
  );
});

test("CLI maps usage, definition, runner, and gate failures to exit code one", async () => {
  const capture = createCliCapture();
  let definitionCalls = 0;
  for (const argv of [
    ["--unknown"],
    ["--diagnostic-log", "--diagnostic-log"]
  ]) {
    assert.equal(
      await runVibeCheck(argv, {
        createDefinition: () => {
          definitionCalls += 1;
          return passedDefinition();
        },
        reportError: (message) => capture.diagnostics.push(message)
      }),
      1
    );
    assert.match(
      capture.diagnostics.at(-1) ?? "",
      /Usage: bun run check \[--tag release\]/u
    );
  }
  assert.equal(definitionCalls, 0);

  for (const definition of [
    failedDefinition(),
    invalidDefinition(),
    unknownDependencyDefinition()
  ]) {
    assert.equal(
      await runVibeCheck([], {
        ...capturedCliDependencies(capture, definition),
        reportInfo: () => undefined
      }),
      1
    );
  }
  assert.match(
    capture.diagnostics.at(-1) ?? "",
    /Vibe Check invocation failed: /u
  );

  const configurationInformation: string[] = [];
  assert.equal(
    await runVibeCheck(["--diagnostic-log"], {
      createDefinition: passedDefinition,
      createInvocationDirectory: () =>
        path.join(os.tmpdir(), `skills-vibe-invalid-controls-${process.pid}`),
      prepareActivation: false,
      reportError: (message) => capture.diagnostics.push(message),
      reportInfo: (message) => configurationInformation.push(message),
      async runProject(_definition: ProjectDefinition, controls: RunControls) {
        return await run({}, controls);
      }
    }),
    1
  );
  assert.match(
    capture.diagnostics.at(-1) ?? "",
    /Vibe Check invocation failed: /u
  );
  assert.deepEqual(configurationInformation, []);
});

test("CLI command failures provide direct rerun and transcript location without child text", async () => {
  const fs = await import("node:fs/promises");
  const { defineConfig } = await import("@zxyycom/vibe-check");
  const { createPackageScriptCheck } =
    await import("./lib/vibe-gate/checks/package-script.ts");
  await withTemporaryDirectory(
    "gate-cli-command-diagnostic-",
    async (directory) => {
      await fs.writeFile(
        path.join(directory, "package.json"),
        JSON.stringify({ scripts: { typecheck: "node probe.js" } })
      );
      await fs.writeFile(
        path.join(directory, "probe.js"),
        'console.error("private-child-marker"); process.exit(8)'
      );
      const capture = createCliCapture();
      const definition = defineConfig({
        checks: [createPackageScriptCheck("typecheck")],
        scheduler: { resourceCapacities: { "external-process": 3 } }
      });
      assert.equal(
        await runVibeCheck([], {
          ...capturedCliDependencies(capture, definition),
          createInvocationDirectory: () => path.join(directory, "invocation"),
          runProject: (selected, controls) =>
            runInProject(selected, controls, directory)
        }),
        1
      );
      const text = capture.diagnostics.join(" ");
      assert.match(text, /rerun bun run typecheck/u);
      assert.match(text, /process\.log/u);
      assert.equal(text.includes("private-child-marker"), false);
    }
  );
});
