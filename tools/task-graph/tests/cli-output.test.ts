import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { renderTaskListResult } from "../src/task-list-renderer.ts";
import { withTempWorkspace } from "./helpers.ts";
import {
  callCli,
  callProcessCli,
  callRawCli,
  parseJsonCall,
  writeRichListProjectionFixture
} from "./cli-test-support.ts";

test("CLI task list --json accepts the global flag before or after the command", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    const before = await callRawCli(root, ["--json", "task", "list"]);
    const after = await callRawCli(root, ["task", "list", "--json"]);
    const beforeResult = parseJsonCall(before);
    assert.equal(beforeResult.ok, true);
    assert.deepEqual(parseJsonCall(after), beforeResult);
    assert.equal(after.output, before.output);
  });
});

test("CLI task list --json data equals the complete programmatic list projection", async () => {
  await withTempWorkspace(async (root) => {
    const service = await writeRichListProjectionFixture(root);
    const listed = await service.listTasks();
    const jsonCall = await callRawCli(root, ["task", "list", "--json"]);
    const result = parseJsonCall(jsonCall);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.revision, listed.revision);
    assert.deepEqual(result.data, listed.data);
  });
});

test("CLI default task list renders the complete programmatic projection", async () => {
  await withTempWorkspace(async (root) => {
    const service = await writeRichListProjectionFixture(root);
    const listed = await service.listTasks();
    const programmaticText = renderTaskListResult(
      {
        ok: true,
        indexPath: path.join(
          root,
          "docs",
          "task-graph",
          "task-graph-index.json"
        ),
        revision: listed.revision,
        data: listed.data
      },
      { columns: 80 }
    );
    const cliText = await callRawCli(root, ["task", "list"], { columns: 80 });
    assert.equal(cliText.exitCode, 0);
    assert.equal(cliText.output, programmaticText);
    assert.match(programmaticText, /parent:\[task-000001\]/u);
    assert.match(programmaticText, /needs:\[task-000003\]/u);
    assert.ok(programmaticText.includes('reason:"awaiting review"'));
    assert.match(programmaticText, /RUN MUTEX - cannot run at the same time/u);
  });
});

test("CLI task-list help and commands without text renderers remain on the JSON protocol", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    await callCli(root, [
      "task",
      "create",
      "--title",
      "route task",
      "--goal",
      "exercise JSON routes",
      "--expected-revision",
      "0"
    ]);
    for (const { args, ok } of [
      { args: ["task", "list", "--help"], ok: true },
      { args: ["task", "show", "task-000001"], ok: true },
      { args: ["task", "show"], ok: false }
    ]) {
      assert.equal(parseJsonCall(await callRawCli(root, args)).ok, ok);
    }
  });
});

test("CLI task-list command failures follow the selected output protocol", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    const textFailure = await callRawCli(root, ["task", "list", "unexpected"]);
    assert.equal(textFailure.exitCode, 1);
    assert.match(
      textFailure.output,
      /^TASK LIST ERROR code=ARGUMENT_INVALID revision=0 retryable=false /u
    );
    assert.match(textFailure.output, /\n  detail actualPositionals=1\n/u);

    const jsonFailure = await callRawCli(root, [
      "task",
      "list",
      "unexpected",
      "--json"
    ]);
    const result = parseJsonCall(jsonFailure);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "ARGUMENT_INVALID");
      assert.equal(result.revision, 0);
    }
  });
});

test("CLI global argument failures use revision-null JSON", async () => {
  await withTempWorkspace(async (root) => {
    for (const { args, message } of [
      {
        args: ["--json", "task", "list", "--json"],
        message: /--json must not be repeated/u
      },
      {
        args: ["task", "list", "--json=compact"],
        message: /--json does not accept a value/u
      },
      {
        args: ["task", "list", "--root", "--json"],
        message: /--root requires a non-empty path/u
      },
      {
        args: ["task", "list", "--index", "--json"],
        message: /--index requires a non-empty path/u
      }
    ]) {
      const failure = await callRawCli(root, args);
      const result = parseJsonCall(failure);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.error.code, "ARGUMENT_INVALID");
        assert.equal(result.revision, null);
        assert.match(result.error.message, message);
      }
    }
  });
});

test("CLI service-construction failures stay on the global JSON protocol", async () => {
  await withTempWorkspace(async (root) => {
    const failure = await callRawCli(root, [
      "task",
      "list",
      "--index",
      "../outside.json"
    ]);
    const result = parseJsonCall(failure);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "ARGUMENT_INVALID");
      assert.equal(result.revision, null);
    }
  });
});

test("process CLI preserves selected stdout protocol stderr and exit status", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    await callCli(root, [
      "task",
      "create",
      "--title",
      "route task",
      "--goal",
      "exercise process transport",
      "--expected-revision",
      "0"
    ]);
    const calls = [
      {
        args: ["task", "list", "--root", root],
        expected: await callRawCli(root, ["task", "list"], { columns: 80 })
      },
      {
        args: ["task", "list", "unexpected", "--json", "--root", root],
        expected: await callRawCli(root, [
          "task",
          "list",
          "unexpected",
          "--json"
        ])
      }
    ];
    for (const { args, expected } of calls) {
      const processCall = await callProcessCli(args, "");
      assert.equal(processCall.exitCode, expected.exitCode);
      assert.equal(processCall.stdout, expected.output);
      assert.equal(processCall.stderr, "");
    }
  });
});

test("process CLI reports stdout faults only on stderr with exit two", async () => {
  await withTempWorkspace(async (root) => {
    const preloadPath = path.join(root, "stdout-fault.mjs");
    await fs.writeFile(
      preloadPath,
      "process.stdout.write = () => { throw new Error('simulated stdout fault'); };\n",
      "utf8"
    );
    const fault = await callProcessCli(["--version", "--root", root], "", {
      ...process.env,
      NODE_OPTIONS: [
        process.env.NODE_OPTIONS,
        `--import=${pathToFileURL(preloadPath).href}`
      ]
        .filter((value) => value !== undefined && value !== "")
        .join(" ")
    });
    assert.equal(fault.exitCode, 2);
    assert.equal(fault.stdout, "");
    assert.match(fault.stderr, /simulated stdout fault/u);
  });
});
