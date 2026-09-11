import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runTaskGraphCli } from "../src/cli.ts";
import { prepareRootNativeRuntime, withTempWorkspace } from "./helpers.ts";
import {
  callCli,
  type CliCall,
  callCliWithMissingRuntime,
  callProcessCli,
  parseJsonCall,
  requireOnlyOutput,
  requireRecord
} from "./cli-test-support.ts";

const compatibleNodeVersion = "v26.0.0";

test("CLI gates every mutation before argument parsing or apply request and index access", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "missing-tool-home");
    const requestPath = path.join(root, "observable-request.json");
    const indexPath = path.join(
      root,
      "docs",
      "task-graph",
      "task-graph-index.json"
    );
    const nodeVersion = compatibleNodeVersion;
    await fs.writeFile(requestPath, "{not-json", "utf8");
    const originalReadFile = fs.readFile;
    let requestReads = 0;
    let indexReads = 0;
    Object.defineProperty(fs, "readFile", {
      configurable: true,
      value: async (...args: Parameters<typeof fs.readFile>) => {
        const target = args[0];
        if (typeof target === "string") {
          if (path.resolve(target) === requestPath) requestReads += 1;
          if (path.resolve(target) === indexPath) indexReads += 1;
        }
        return await originalReadFile(...args);
      }
    });
    try {
      const mutationInvocations = [
        ["index", "init"],
        ["task", "create"],
        ["task", "update-content"],
        ["task", "update-control"],
        ["task", "remove"],
        ["relation", "parent"],
        ["relation", "dependency-add"],
        ["relation", "dependency-remove"],
        ["relation", "exclusion-add"],
        ["relation", "exclusion-remove"],
        ["claim"],
        ["renew"],
        ["release"],
        ["complete"],
        ["fail"],
        ["retry"],
        ["cancel"],
        ["apply", "--file", requestPath]
      ];
      for (const args of mutationInvocations) {
        const failure = await callCliWithMissingRuntime(
          root,
          args,
          toolHome,
          nodeVersion
        );
        assert.equal(failure.exitCode, 1);
        assert.equal(failure.output.endsWith("\n"), true);
        assert.equal(failure.output.slice(0, -1).includes("\n"), false);
        assert.equal(failure.result.ok, false);
        if (!failure.result.ok) {
          assert.equal(failure.result.error.code, "RUNTIME_MISSING");
          assert.equal(failure.result.revision, null);
        }
      }
    } finally {
      Object.defineProperty(fs, "readFile", {
        configurable: true,
        value: originalReadFile
      });
    }
    assert.equal(requestReads, 0);
    assert.equal(indexReads, 0);
    await assert.rejects(fs.stat(path.dirname(indexPath)), { code: "ENOENT" });
  });
});

test("CLI domain read-only commands run without an installed runtime", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    await callCli(root, [
      "task",
      "create",
      "--title",
      "read-only task",
      "--goal",
      "query without runtime",
      "--acceptance",
      "all read-only commands succeed",
      "--expected-revision",
      "0"
    ]);
    const toolHome = path.join(root, "missing-tool-home");
    const nodeVersion = compatibleNodeVersion;
    for (const args of [
      ["index", "info"],
      ["task", "list", "--json"],
      ["task", "show", "task-000001"],
      ["actionable"]
    ]) {
      const result = await callCliWithMissingRuntime(
        root,
        args,
        toolHome,
        nodeVersion
      );
      assert.equal(result.exitCode, 0, args.join(" "));
      assert.equal(result.result.ok, true, args.join(" "));
    }
    await assert.rejects(fs.stat(toolHome), { code: "ENOENT" });
  });
});

test("CLI runtime info reports missing and compatible states without index access", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "tool-home");
    const nodeVersion = compatibleNodeVersion;
    const invoke = async (args: string[]): Promise<CliCall> => {
      const chunks: string[] = [];
      const exitCode = await runTaskGraphCli(["--root", root, ...args], {
        io: { stdout: (text) => chunks.push(text) },
        runtimeOptions: {
          environment: { TASK_GRAPH_TOOL_HOME: toolHome },
          nodeVersion
        }
      });
      const output = requireOnlyOutput(chunks);
      assert.equal(output.endsWith("\n"), true);
      assert.equal(output.slice(0, -1).includes("\n"), false);
      return { exitCode, output, result: parseJsonCall({ exitCode, output }) };
    };
    const missing = await invoke(["runtime", "info"]);
    assert.equal(missing.result.ok, true);
    if (missing.result.ok) {
      const data = requireRecord(missing.result.data, "runtime info data");
      assert.equal(data.state, "missing");
      assert.equal(missing.result.revision, null);
    }
    await prepareRootNativeRuntime(toolHome);
    const compatible = await callProcessCli(
      ["runtime", "info", "--root", root],
      "",
      { ...process.env, TASK_GRAPH_TOOL_HOME: toolHome }
    );
    assert.equal(compatible.exitCode, 0);
    assert.equal(compatible.stderr, "");
    const compatibleResult = parseJsonCall({
      exitCode: compatible.exitCode,
      output: compatible.stdout
    });
    assert.equal(compatibleResult.ok, true);
    if (compatibleResult.ok) {
      const data = requireRecord(compatibleResult.data, "runtime info data");
      assert.equal(data.compatible, true);
    }
    await assert.rejects(fs.stat(path.join(root, "docs")), { code: "ENOENT" });
  });
});
