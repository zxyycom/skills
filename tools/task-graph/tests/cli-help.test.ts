import assert from "node:assert/strict";
import test from "node:test";
import { withTempWorkspace } from "./helpers.ts";
import {
  callCli,
  callRawCli,
  requireRecord,
  requireRecords,
  requireString,
  requireStrings
} from "./cli-test-support.ts";

import { verifyCommandHelp } from "./cli-help-support.ts";
test("CLI root help exposes commands runtime requirements and the global JSON option", async () => {
  await withTempWorkspace(async (root) => {
    const help = await callCli(root, []);
    assert.equal(help.result.ok, true);
    if (help.result.ok) {
      assert.equal(help.result.revision, null);
      const data = requireRecord(help.result.data, "root help data");
      const commands = requireStrings(data.commands, "root help data.commands");
      const usage = requireString(data.usage, "root help data.usage");
      assert.equal(usage.startsWith("task-graph"), true);
      assert.equal(data.requiresMutationRuntime, null);
      assert.equal(commands.length, 24);
      assert.ok(commands.includes("index stage"));
      assert.deepEqual(data.runtimeRequirements, {
        supportedNodeRange: "^22.22.2 || ^24.15.0 || >=26.0.0",
        mutationPrerequisite: "compatible-runtime",
        setupCommand: ["runtime", "info"],
        installCommandSource: "runtime info data.installCommand"
      });
      const globalOptions = requireRecords(
        data.globalOptions,
        "root help data.globalOptions"
      );
      assert.deepEqual(
        globalOptions.find((option) => option.name === "--json"),
        { name: "--json", required: false, type: "boolean", default: false }
      );
    }
  });
});

test("CLI command help recovers every command and structured special parameters", async () =>
  await verifyCommandHelp());

test("CLI rejects prototype-like command and option names", async () => {
  await withTempWorkspace(async (root) => {
    for (const args of [
      ["help", "constructor"],
      ["index", "info", "--constructor"]
    ]) {
      const prototypeLookup = await callCli(root, args);
      assert.equal(prototypeLookup.result.ok, false);
      if (!prototypeLookup.result.ok) {
        assert.equal(prototypeLookup.result.error.code, "ARGUMENT_INVALID");
      }
    }
  });
});

test("CLI version reports 3.1.0 through the JSON protocol", async () => {
  await withTempWorkspace(async (root) => {
    const version = await callCli(root, ["--version"]);
    assert.equal(version.result.ok, true);
    if (version.result.ok) {
      assert.deepEqual(version.result.data, {
        name: "task-graph",
        version: "3.1.0"
      });
      assert.equal(version.result.revision, null);
    }
  });
});

test("CLI usage failures use the JSON protocol", async () => {
  await withTempWorkspace(async (root) => {
    const usage = await callCli(root, ["task", "create"]);
    assert.equal(usage.exitCode, 1);
    assert.equal(usage.result.ok, false);
    if (!usage.result.ok) {
      assert.equal(usage.result.error.code, "ARGUMENT_INVALID");
      assert.equal(usage.result.revision, null);
    }

    const longArguments = await callCli(root, [
      "task",
      "show",
      ...Array.from({ length: 12_000 }, () => "extra")
    ]);
    assert.equal(longArguments.exitCode, 1);
    assert.equal(longArguments.result.ok, false);
    if (!longArguments.result.ok)
      assert.equal(longArguments.result.error.code, "ARGUMENT_INVALID");
  });
});

test("CLI task-list columns prefer injection then TTY and otherwise fall back to 80", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    await callCli(root, [
      "task",
      "create",
      "--title",
      "route task",
      "--goal",
      "exercise columns",
      "--expected-revision",
      "0"
    ]);
    const inline = await callRawCli(root, ["task", "list"], { columns: 80 });
    const block = await callRawCli(root, ["task", "list"], { columns: 79 });
    assert.match(
      inline.output,
      /\nL0 \[task-000001\] candidate route task\n$/u
    );
    assert.match(
      block.output,
      /\nL0 \[task-000001\] candidate\n  title:route task\n$/u
    );

    const stdout = process.stdout;
    const originalIsTty = Object.getOwnPropertyDescriptor(stdout, "isTTY");
    const originalColumns = Object.getOwnPropertyDescriptor(stdout, "columns");
    try {
      Object.defineProperties(stdout, {
        isTTY: { configurable: true, value: true },
        columns: { configurable: true, value: 79 }
      });
      assert.equal(
        (await callRawCli(root, ["task", "list"])).output,
        block.output
      );
      assert.equal(
        (await callRawCli(root, ["task", "list"], { columns: 80 })).output,
        inline.output
      );
      assert.equal(
        (await callRawCli(root, ["task", "list"], { columns: 0 })).output,
        block.output
      );

      for (const invalidTtyColumns of [0, 79.5]) {
        Object.defineProperty(stdout, "columns", {
          configurable: true,
          value: invalidTtyColumns
        });
        assert.equal(
          (await callRawCli(root, ["task", "list"])).output,
          inline.output
        );
      }

      Object.defineProperties(stdout, {
        isTTY: { configurable: true, value: false },
        columns: { configurable: true, value: 79 }
      });
      assert.equal(
        (await callRawCli(root, ["task", "list"])).output,
        inline.output
      );
      for (const invalidInjectedColumns of [0, 79.5]) {
        assert.equal(
          (
            await callRawCli(root, ["task", "list"], {
              columns: invalidInjectedColumns
            })
          ).output,
          inline.output
        );
      }
    } finally {
      if (originalIsTty === undefined) Reflect.deleteProperty(stdout, "isTTY");
      else Object.defineProperty(stdout, "isTTY", originalIsTty);
      if (originalColumns === undefined)
        Reflect.deleteProperty(stdout, "columns");
      else Object.defineProperty(stdout, "columns", originalColumns);
    }
  });
});
