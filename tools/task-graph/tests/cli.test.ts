import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { runTaskGraphCli, type TaskGraphResult } from "../src/cli.ts";
import { taskContent, uuidSequence, withTempWorkspace } from "./helpers.ts";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
const cliSourcePath = path.join(repositoryRoot, "tools", "task-graph", "src", "cli.ts");

type CliCall = {
  exitCode: number;
  output: string;
  result: TaskGraphResult;
};

type CliServiceOptions = NonNullable<
  NonNullable<Parameters<typeof runTaskGraphCli>[1]>["serviceOptions"]
>;

async function callCli(
  root: string,
  args: string[],
  serviceOptions: CliServiceOptions = {}
): Promise<CliCall> {
  const chunks: string[] = [];
  const exitCode = await runTaskGraphCli(["--root", root, ...args], {
    io: { stdout: (text) => chunks.push(text) },
    serviceOptions: {
      clock: () => new Date("2026-08-06T08:00:00.000Z"),
      idGenerator: uuidSequence(1),
      leaseIdGenerator: uuidSequence(1001),
      ...serviceOptions
    }
  });
  assert.equal(chunks.length, 1);
  const output = chunks[0]!;
  assert.ok(output.endsWith("\n"));
  assert.equal(output.slice(0, -1).includes("\n"), false);
  const result = JSON.parse(output) as TaskGraphResult;
  assert.equal(exitCode, result.ok ? 0 : 1);
  return { exitCode, output, result };
}

async function callProcessCli(
  args: string[],
  input: string
): Promise<{ exitCode: number | null; stderr: string; stdout: string }> {
  const child = spawn(process.execPath, [cliSourcePath, ...args], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
  child.stdin.end(input);
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  return {
    exitCode,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8")
  };
}

test("CLI help, version, and usage stay inside the single-JSON LF protocol", async () => {
  await withTempWorkspace(async (root) => {
    const help = await callCli(root, []);
    assert.equal(help.result.ok, true);
    if (help.result.ok) {
      assert.equal(help.result.revision, null);
      const data = help.result.data as { commands: string[]; usage: string };
      assert.equal(data.usage.startsWith("task-graph"), true);
      assert.equal(data.commands.length, 32);
      for (const command of data.commands) {
        const commandHelp = await callCli(root, [...command.split(" "), "--help"]);
        assert.equal(commandHelp.result.ok, true);
        if (commandHelp.result.ok) {
          assert.equal((commandHelp.result.data as { command: string }).command, command);
        }
      }
    }

    const createHelp = await callCli(root, ["scope", "create", "--help"]);
    assert.equal(createHelp.result.ok, true);
    if (createHelp.result.ok) {
      const data = createHelp.result.data as {
        command: string;
        parameters: { options: Array<{ name: string; required: boolean; type: string }> };
        usage: string;
      };
      assert.equal(data.command, "scope create");
      assert.match(data.usage, /--expected-revision/u);
      assert.deepEqual(
        data.parameters.options.find((option) => option.name === "--binding"),
        { name: "--binding", required: false, type: "key-value", multiple: true }
      );
    }

    const applyHelp = await callCli(root, ["help", "apply"]);
    assert.equal(applyHelp.result.ok, true);
    if (applyHelp.result.ok) {
      const data = applyHelp.result.data as {
        parameters: { input: { default: string; fileOption: string; format: string } };
      };
      assert.deepEqual(data.parameters.input, {
        default: "stdin",
        fileOption: "--file",
        format: "json"
      });
    }
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

    const version = await callCli(root, ["--version"]);
    assert.equal(version.result.ok, true);
    if (version.result.ok) {
      assert.deepEqual(version.result.data, { name: "task-graph", version: "1.0.0" });
      assert.equal(version.result.revision, null);
    }

    const usage = await callCli(root, ["scope", "create"]);
    assert.equal(usage.exitCode, 1);
    assert.equal(usage.result.ok, false);
    if (!usage.result.ok) {
      assert.equal(usage.result.error.code, "ARGUMENT_INVALID");
      assert.equal(usage.result.revision, null);
    }
  });
});

test("CLI success and predictable schema, state, conflict, and file failures use one envelope", async () => {
  await withTempWorkspace(async (root) => {
    const initialized = await callCli(root, ["index", "init"]);
    assert.equal(initialized.result.ok, true);
    assert.equal(initialized.result.revision, 0);

    const scope = await callCli(root, [
      "scope", "create",
      "--key", "cli-scope",
      "--binding", "thread=supported",
      "--expected-revision", "0"
    ]);
    assert.equal(scope.result.ok, true);
    assert.equal(scope.result.revision, 1);

    const task = await callCli(root, [
      "task", "create", "scope-000001",
      "--title", "candidate",
      "--goal", "candidate goal",
      "--acceptance", "candidate accepted",
      "--reference", "thread=supported",
      "--expected-revision", "1"
    ]);
    assert.equal(task.result.ok, true);
    assert.equal(task.result.revision, 2);

    const bindingFilter = await callCli(root, [
      "scope", "list", "--binding", "thread=supported"
    ]);
    assert.equal(bindingFilter.result.ok, true);
    if (bindingFilter.result.ok) {
      assert.ok((bindingFilter.result.data as Record<string, unknown>)["scope-000001"]);
    }
    const shownTask = await callCli(root, [
      "task", "show", "scope-000001", "task-000001"
    ]);
    assert.equal(shownTask.result.ok, true);
    if (shownTask.result.ok) {
      const references = (shownTask.result.data as {
        task: { content: { references: Record<string, string> } };
      }).task.content.references;
      assert.deepEqual(references, { thread: "supported" });
    }

    const reservedBinding = await callCli(root, [
      "scope", "create",
      "--key", "reserved-binding",
      "--binding", "constructor=blocked",
      "--expected-revision", "2"
    ]);
    assert.equal(reservedBinding.result.ok, false);
    if (!reservedBinding.result.ok) {
      assert.equal(reservedBinding.result.error.code, "REQUEST_INVALID");
    }

    const reservedReference = await callCli(root, [
      "task", "create", "scope-000001",
      "--title", "reserved reference",
      "--goal", "reserved reference goal",
      "--acceptance", "reserved reference accepted",
      "--reference", "prototype=blocked",
      "--expected-revision", "2"
    ]);
    assert.equal(reservedReference.result.ok, false);
    if (!reservedReference.result.ok) {
      assert.equal(reservedReference.result.error.code, "REQUEST_INVALID");
    }

    const prototypeReference = await callCli(root, [
      "task", "create", "scope-000001",
      "--title", "invalid prototype",
      "--goal", "invalid prototype goal",
      "--acceptance", "invalid prototype accepted",
      "--reference", "__proto__=blocked",
      "--expected-revision", "2"
    ]);
    assert.equal(prototypeReference.result.ok, false);
    if (!prototypeReference.result.ok) {
      assert.equal(prototypeReference.result.error.code, "REQUEST_INVALID");
    }

    for (const [args, code] of [
      [["scope", "show", "constructor"], "SCOPE_NOT_FOUND"],
      [["task", "show", "scope-000001", "constructor"], "TASK_NOT_FOUND"]
    ] as const) {
      const lookup = await callCli(root, [...args]);
      assert.equal(lookup.result.ok, false);
      if (!lookup.result.ok) assert.equal(lookup.result.error.code, code);
    }

    const stateFailure = await callCli(root, [
      "claim", "scope-000001", "task-000001", "--actor", "worker"
    ]);
    assert.equal(stateFailure.result.ok, false);
    if (!stateFailure.result.ok) {
      assert.equal(stateFailure.result.error.code, "STATE_CONFLICT");
      assert.equal(stateFailure.result.revision, 2);
    }

    const conflict = await callCli(root, [
      "scope", "create",
      "--key", "stale",
      "--expected-revision", "1"
    ]);
    assert.equal(conflict.result.ok, false);
    if (!conflict.result.ok) {
      assert.equal(conflict.result.error.code, "REVISION_CONFLICT");
      assert.equal(conflict.result.error.retryable, true);
    }

    const invalidRequestPath = path.join(root, "invalid-request.json");
    await fs.writeFile(invalidRequestPath, JSON.stringify({
      expectedRevision: 2,
      operations: [{ kind: "create-scope", key: "invalid", extra: true }]
    }), "utf8");
    const schemaFailure = await callCli(root, ["apply", "--file", invalidRequestPath]);
    assert.equal(schemaFailure.result.ok, false);
    if (!schemaFailure.result.ok) {
      assert.equal(schemaFailure.result.error.code, "REQUEST_INVALID");
    }

    const missingFile = await callCli(root, [
      "apply", "--file", path.join(root, "missing.json")
    ]);
    assert.equal(missingFile.result.ok, false);
    if (!missingFile.result.ok) {
      assert.equal(missingFile.result.error.code, "REQUEST_INVALID");
    }

    const duplicateInit = await callCli(root, ["index", "init"]);
    assert.equal(duplicateInit.result.ok, false);
    if (!duplicateInit.result.ok) {
      assert.equal(duplicateInit.result.error.code, "INDEX_EXISTS");
    }
  });

  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    const unknown = await callCli(root, [
      "scope", "create",
      "--key", "committed-but-response-lost",
      "--expected-revision", "0"
    ], {
      idGenerator: uuidSequence(2001),
      hooks: {
        afterCommit: () => {
          throw new Error("simulated response loss");
        }
      }
    });
    assert.equal(unknown.result.ok, false);
    if (!unknown.result.ok) {
      assert.equal(unknown.result.error.code, "WRITE_OUTCOME_UNKNOWN");
      assert.equal(unknown.result.revision, 1);
      assert.equal(unknown.result.error.details.possibleRevision, 1);
    }
  });

  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    const unknown = await callCli(root, [
      "scope", "create",
      "--key", "committed-then-unreadable",
      "--expected-revision", "0"
    ], {
      idGenerator: uuidSequence(3001),
      hooks: {
        afterCommit: async ({ indexPath }) => {
          await fs.unlink(indexPath);
          throw new Error("simulated unreadable outcome");
        }
      }
    });
    assert.equal(unknown.result.ok, false);
    if (!unknown.result.ok) {
      assert.equal(unknown.result.error.code, "WRITE_OUTCOME_UNKNOWN");
      assert.equal(unknown.result.revision, null);
      assert.equal(unknown.result.error.details.possibleRevision, 1);
    }
  });
});

test("CLI index check preserves the unsupported schema error code", async () => {
  await withTempWorkspace(async (root) => {
    const indexPath = path.join(root, "docs", "task-graph", "task-graph-index.json");
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(indexPath, `${JSON.stringify({
      schemaVersion: 2,
      revision: 0,
      nextIds: { scope: 1, task: 1 },
      scopes: {},
      constructor: "unsupported-schema-field"
    }, null, 2)}\n`, "utf8");
    const checked = await callCli(root, ["index", "check"]);
    assert.equal(checked.exitCode, 1);
    assert.equal(checked.result.ok, false);
    if (!checked.result.ok) {
      assert.equal(checked.result.error.code, "SCHEMA_UNSUPPORTED");
      assert.equal(checked.result.revision, null);
    }
  });
});

test("process CLI maps path and recovery failures to JSON exit one with empty stderr", async () => {
  await withTempWorkspace(async (root) => {
    const rootFile = path.join(root, "not-a-directory");
    await fs.writeFile(rootFile, "ordinary file\n", "utf8");
    try {
      await execFileAsync(process.execPath, [
        cliSourcePath,
        "index", "info",
        "--root", rootFile
      ], { encoding: "utf8", windowsHide: true });
      assert.fail("CLI should fail when --root is an ordinary file");
    } catch (error) {
      const failure = error as Error & {
        code?: number | string;
        stderr?: string;
        stdout?: string;
      };
      assert.equal(failure.code, 1);
      assert.equal(failure.stderr, "");
      const output = failure.stdout ?? "";
      assert.ok(output.endsWith("\n"));
      assert.equal(output.slice(0, -1).includes("\n"), false);
      const result = JSON.parse(output) as TaskGraphResult;
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.ok(
          result.error.code === "INDEX_NOT_FOUND"
          || result.error.code === "INDEX_READ_FAILED"
        );
      }
    }
  });

  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    const lockPath = path.join(
      root,
      "docs",
      "task-graph",
      "task-graph-index.json.lock"
    );
    await fs.mkdir(lockPath);
    const ownerToken = "00000000-0000-4000-8000-000000009001";
    const reclaimerToken = "00000000-0000-4000-8000-000000009301";
    await fs.writeFile(
      path.join(
        lockPath,
        `owner-${ownerToken}.claimed-by-${reclaimerToken}.json`
      ),
      `${JSON.stringify({
        hostname: "test-host",
        ownerToken,
        pid: 9001,
        updatedAt: "2020-01-01T00:00:00.000Z"
      })}\n`,
      "utf8"
    );
    await fs.writeFile(
      path.join(lockPath, `reclaimer-${reclaimerToken}.json`),
      "{not-json}\n",
      "utf8"
    );
    const invoked = await callProcessCli([
      "scope", "create",
      "--root", root,
      "--key", "blocked-by-invalid-recovery",
      "--expected-revision", "0"
    ], "");
    assert.equal(invoked.exitCode, 1);
    assert.equal(invoked.stderr, "");
    assert.ok(invoked.stdout.endsWith("\n"));
    assert.equal(invoked.stdout.slice(0, -1).includes("\n"), false);
    const result = JSON.parse(invoked.stdout) as TaskGraphResult;
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "LOCK_RECOVERY_REQUIRED");
    }
  });
});

test("CLI rejects ambiguous lease and revision pairs plus invalid control reasons", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    await callCli(root, [
      "scope", "create",
      "--key", "argument-scope",
      "--expected-revision", "0"
    ]);
    await callCli(root, [
      "task", "create", "scope-000001",
      "--title", "running",
      "--goal", "running goal",
      "--acceptance", "running accepted",
      "--control", "queued",
      "--expected-revision", "1"
    ]);
    const claimed = await callCli(root, [
      "claim", "scope-000001", "task-000001", "--actor", "worker"
    ]);
    assert.equal(claimed.result.ok, true);
    const leaseId = claimed.result.ok
      ? (claimed.result.data as { leaseId: string }).leaseId
      : "";
    for (const args of [
      [
        "complete", "scope-000001", "task-000001",
        "--lease", leaseId,
        "--expected-revision", "3",
        "--result-summary", "ambiguous"
      ],
      [
        "cancel", "scope-000001", "task-000001",
        "--lease", leaseId,
        "--expected-revision", "3",
        "--reason", "ambiguous"
      ]
    ]) {
      const failure = await callCli(root, args);
      assert.equal(failure.result.ok, false);
      if (!failure.result.ok) {
        assert.equal(failure.result.error.code, "ARGUMENT_INVALID");
      }
    }

    for (const args of [
      [
        "complete", "scope-000001", "task-000001",
        "--result-summary", "missing mutation precondition"
      ],
      [
        "cancel", "scope-000001", "task-000001",
        "--reason", "missing mutation precondition"
      ]
    ]) {
      const failure = await callCli(root, args);
      assert.equal(failure.result.ok, false);
      if (!failure.result.ok) {
        assert.equal(failure.result.error.code, "ARGUMENT_INVALID");
      }
    }

    for (const controlArgs of [
      ["--control", "queued", "--reason", "not allowed"],
      ["--control", "waiting"],
      ["--reason", "orphaned"]
    ]) {
      const failure = await callCli(root, [
        "task", "create", "scope-000001",
        "--title", "invalid control",
        "--goal", "invalid control goal",
        "--acceptance", "invalid control accepted",
        "--expected-revision", "3",
        ...controlArgs
      ]);
      assert.equal(failure.result.ok, false);
      if (!failure.result.ok) {
        assert.equal(failure.result.error.code, "ARGUMENT_INVALID");
      }
    }
  });
});

test("CLI apply resolves aliases and rolls back every operation when one fails", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    await callCli(root, [
      "scope", "create",
      "--key", "apply-scope",
      "--expected-revision", "0"
    ]);
    const validRequestPath = path.join(root, "valid-apply.json");
    await fs.writeFile(validRequestPath, `${JSON.stringify({
      expectedRevision: 1,
      operations: [
        {
          kind: "create-task",
          scopeId: "scope-000001",
          alias: "constructor",
          content: taskContent("parent"),
          control: { mode: "queued" }
        },
        {
          kind: "create-task",
          scopeId: "scope-000001",
          alias: "child",
          parentId: "@constructor",
          content: taskContent("child")
        }
      ]
    }, null, 2)}\n`, "utf8");
    const applied = await callCli(root, ["apply", "--file", validRequestPath]);
    assert.equal(applied.result.ok, true);
    if (applied.result.ok) {
      assert.equal(applied.result.revision, 2);
      assert.deepEqual(
        (applied.result.data as { aliases: Record<string, string> }).aliases,
        { child: "task-000002", constructor: "task-000001" }
      );
    }

    const duplicateAliasPath = path.join(root, "duplicate-alias.json");
    await fs.writeFile(duplicateAliasPath, `${JSON.stringify({
      expectedRevision: 2,
      operations: [
        {
          kind: "create-task",
          scopeId: "scope-000001",
          alias: "constructor",
          content: taskContent("first duplicate")
        },
        {
          kind: "create-task",
          scopeId: "scope-000001",
          alias: "constructor",
          content: taskContent("second duplicate")
        }
      ]
    }, null, 2)}\n`, "utf8");
    const duplicateAlias = await callCli(root, ["apply", "--file", duplicateAliasPath]);
    assert.equal(duplicateAlias.result.ok, false);
    if (!duplicateAlias.result.ok) {
      assert.equal(duplicateAlias.result.error.code, "REQUEST_INVALID");
    }

    const longAliasPath = path.join(root, "long-alias.json");
    await fs.writeFile(longAliasPath, `${JSON.stringify({
      expectedRevision: 2,
      operations: [{
        kind: "create-task",
        scopeId: "scope-000001",
        alias: "a".repeat(81),
        content: taskContent("long alias")
      }]
    }, null, 2)}\n`, "utf8");
    const longAlias = await callCli(root, ["apply", "--file", longAliasPath]);
    assert.equal(longAlias.result.ok, false);
    if (!longAlias.result.ok) {
      assert.equal(longAlias.result.error.code, "REQUEST_INVALID");
    }

    const invalidRequestPath = path.join(root, "rollback-apply.json");
    await fs.writeFile(invalidRequestPath, `${JSON.stringify({
      expectedRevision: 2,
      operations: [
        {
          kind: "create-task",
          scopeId: "scope-000001",
          alias: "temporary",
          content: taskContent("temporary")
        },
        {
          kind: "set-dependency",
          scopeId: "scope-000001",
          taskId: "@temporary",
          dependencyId: "task-999999",
          present: true
        }
      ]
    }, null, 2)}\n`, "utf8");
    const rejected = await callCli(root, ["apply", "--file", invalidRequestPath]);
    assert.equal(rejected.result.ok, false);
    if (!rejected.result.ok) {
      assert.equal(rejected.result.error.code, "TASK_NOT_FOUND");
    }
    const info = await callCli(root, ["index", "info"]);
    assert.equal(info.result.ok, true);
    if (info.result.ok) {
      assert.equal(info.result.revision, 2);
      assert.equal((info.result.data as { nextIds: { task: number } }).nextIds.task, 3);
    }
  });
});

test("process CLI apply accepts a JSON request from stdin without extra output", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    await callCli(root, [
      "scope", "create",
      "--key", "stdin-scope",
      "--expected-revision", "0"
    ]);
    const request = `${JSON.stringify({
      expectedRevision: 1,
      operations: [{
        kind: "create-task",
        scopeId: "scope-000001",
        alias: "stdin-task",
        content: taskContent("stdin task"),
        control: { mode: "queued" }
      }]
    })}\n`;
    const invoked = await callProcessCli([
      "apply",
      "--root", root
    ], request);
    assert.equal(invoked.exitCode, 0);
    assert.equal(invoked.stderr, "");
    assert.ok(invoked.stdout.endsWith("\n"));
    assert.equal(invoked.stdout.slice(0, -1).includes("\n"), false);
    const result = JSON.parse(invoked.stdout) as TaskGraphResult;
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.revision, 2);
      assert.deepEqual(
        (result.data as { aliases: Record<string, string> }).aliases,
        { "stdin-task": "task-000001" }
      );
    }
  });
});
