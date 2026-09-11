import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  requireSuccess,
  run,
  workspaceRoot
} from "./environment-test-process.ts";
import { createRepository } from "./environment-test-repository.ts";
import {
  maintenanceCliPackageScripts,
  type MaintenanceCliCommand
} from "./validators/project-config.ts";

test("repository maintenance short commands invoke their owned skill CLIs", () => {
  const commandHelpPatterns = {
    "change-plan": /change-plan\.mjs check-all/u,
    "decision-records": /Query and maintain agent-oriented decision records/u,
    "investigation-report":
      /Investigation Report records and their derived index/u,
    "task-graph": /"commands":\[/u,
    "test-evidence": /Validate, query, and stage Case test evidence/u,
    "validate-skill": /Validate the portable structure contract/u
  } satisfies Readonly<Record<MaintenanceCliCommand, RegExp>>;

  const commands = Object.keys(
    maintenanceCliPackageScripts
  ) as MaintenanceCliCommand[];
  for (const script of commands) {
    const expectedOutput = commandHelpPatterns[script];
    const result = run(
      "bun",
      ["run", "--silent", script, "--", "--help"],
      workspaceRoot
    );
    requireSuccess(result, `bun run ${script} -- --help`);
    assert.match(result.stdout, expectedOutput);
  }
});

test("task-graph package command defaults to the main root and accepts an explicit project root", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills task launcher ")
  );
  try {
    const main = await createRepository(tempRoot, "main repository");
    const linked = path.join(tempRoot, "linked worker");
    requireSuccess(
      run("git", ["worktree", "add", "-b", "worker", linked], main),
      "git worktree add"
    );
    requireSuccess(
      run(
        process.execPath,
        [path.join(linked, "scripts", "setup-repository.js")],
        linked
      ),
      "repository setup"
    );

    const launched = run(
      "bun",
      ["run", "task-graph", "--", "task", "list"],
      linked
    );
    requireSuccess(launched, "task-graph package command");
    assert.deepEqual(JSON.parse(launched.stdout), {
      argv: ["task", "list", "--root", main],
      cwd: main
    });

    const alternate = await createRepository(tempRoot, "alternate project");
    for (const explicitArgs of [
      ["task", "list", "--root", alternate],
      [`--root=${path.relative(linked, alternate)}`, "task", "list"]
    ]) {
      const explicit = run(
        "bun",
        ["run", "task-graph", "--", ...explicitArgs],
        linked
      );
      requireSuccess(explicit, "task-graph explicit project root");
      assert.deepEqual(JSON.parse(explicit.stdout), {
        argv: ["task", "list", "--root", alternate],
        cwd: alternate
      });
    }

    const nested = path.join(linked, "nested invocation");
    await fs.mkdir(nested);
    const direct = run(
      process.execPath,
      [
        path.join(linked, "scripts", "task-graph.js"),
        "task",
        "list",
        "--root",
        path.relative(linked, alternate)
      ],
      nested
    );
    requireSuccess(direct, "task-graph explicit root from a nested cwd");
    assert.deepEqual(JSON.parse(direct.stdout), {
      argv: ["task", "list", "--root", alternate],
      cwd: alternate
    });

    for (const invalidArgs of [
      ["task", "list", "--root"],
      ["task", "list", "--root", alternate, `--root=${main}`],
      ["task", "list", "--index", "alternate.json"],
      ["task", "list", "--index=alternate.json"]
    ]) {
      const invalid = run(
        "bun",
        ["run", "task-graph", "--", ...invalidArgs],
        linked
      );
      assert.equal(invalid.status, 1);
      assert.match(
        invalid.stderr,
        /--root requires|--root may be specified only once|owns --index/u
      );
    }
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("task-graph package command rejects an invalid explicit project root", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills invalid task root ")
  );
  try {
    const main = await createRepository(tempRoot, "main repository");
    const linked = path.join(tempRoot, "linked worker");
    requireSuccess(
      run("git", ["worktree", "add", "-b", "worker", linked], main),
      "git worktree add"
    );
    const missingRoot = path.join(tempRoot, "missing project");
    const missing = run(
      "bun",
      ["run", "task-graph", "--", "task", "list", "--root", missingRoot],
      linked
    );
    assert.equal(missing.status, 1);
    assert.equal(missing.stdout, "");
    assert.match(missing.stderr, /selected project has no task index/u);

    const incompleteRoot = path.join(tempRoot, "incomplete project");
    await fs.mkdir(path.join(incompleteRoot, "docs", "task-graph"), {
      recursive: true
    });
    await fs.writeFile(
      path.join(incompleteRoot, "docs", "task-graph", "task-graph-index.json"),
      "{}\n",
      "utf8"
    );
    const incomplete = run(
      "bun",
      ["run", "task-graph", "--", "task", "list", "--root", incompleteRoot],
      linked
    );
    assert.equal(incomplete.status, 1);
    assert.equal(incomplete.stdout, "");
    assert.match(incomplete.stderr, /selected project has no task-graph CLI/u);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
