import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createGitRepositoryFixture } from "../tools/shared/tests/git-fixture.ts";
import {
  maintenanceCliPackageScripts,
  type MaintenanceCliCommand
} from "./validators/project-config.ts";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const environmentRepositoryFixtureRoot = path.join(
  workspaceRoot,
  "scripts",
  "fixtures",
  "environment-repository"
);

type CommandResult = SpawnSyncReturns<string>;

const gitCommitConfig = [
  "-c",
  "user.email=environment@example.invalid",
  "-c",
  "user.name=Environment Test"
];

function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env
): CommandResult {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env,
    stdio: "pipe",
    windowsHide: true
  });
}

function requireSuccess(result: CommandResult, label: string): void {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

async function writeExecutable(
  filePath: string,
  source: string
): Promise<void> {
  await fs.writeFile(filePath, source, "utf8");
  await fs.chmod(filePath, 0o755);
}

async function populateRepository(root: string): Promise<void> {
  await fs.mkdir(path.join(root, "scripts"), { recursive: true });
  for (const script of [
    "environment.js",
    "setup-git-hooks.js",
    "setup-repository.js",
    "task-graph.js"
  ]) {
    await fs.copyFile(
      path.join(workspaceRoot, "scripts", script),
      path.join(root, "scripts", script)
    );
  }
}

let repositoryTemplate: Promise<string> | null = null;
let repositoryTemplatePath: string | null = null;

after(async () => {
  if (repositoryTemplatePath !== null) {
    await fs.rm(repositoryTemplatePath, {
      recursive: true,
      force: true
    });
    repositoryTemplatePath = null;
  }
});

async function repositoryTemplateRoot(): Promise<string> {
  repositoryTemplate ??= createRepositoryTemplate();
  try {
    return await repositoryTemplate;
  } catch (error) {
    repositoryTemplate = null;
    throw error;
  }
}

async function createRepositoryTemplate(): Promise<string> {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills environment repository template ")
  );
  repositoryTemplatePath = parent;
  try {
    const fixture = await createGitRepositoryFixture({
      fixtureRoot: environmentRepositoryFixtureRoot,
      parentDirectory: parent,
      prepareRepository: populateRepository,
      repositoryName: "repository",
      userEmail: "environment@example.invalid",
      userName: "Environment Test"
    });
    return fixture.repositoryRoot;
  } catch (error) {
    await fs.rm(parent, { recursive: true, force: true });
    repositoryTemplatePath = null;
    throw error;
  }
}

async function createRepository(parent: string, name: string): Promise<string> {
  const root = path.join(parent, name);
  await fs.cp(await repositoryTemplateRoot(), root, { recursive: true });
  return root;
}

async function copyRepositoryPath(
  relativePath: string,
  targetRoot: string
): Promise<void> {
  const source = path.join(workspaceRoot, relativePath);
  const target = path.join(targetRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(source, target, { recursive: true });
}

async function createHashHookRepository(
  parent: string,
  name: string
): Promise<string> {
  const root = path.join(parent, name);
  await fs.mkdir(root, { recursive: true });
  for (const relativePath of [
    "scripts/hash-skills.ts",
    "scripts/lib/oxc-config.ts",
    "scripts/lib/project.ts",
    "scripts/lib/skill-package-hash.ts",
    "scripts/lib/skill-package-release.ts",
    "scripts/lib/skill-package-versioning.ts",
    "tools/shared/src/markdown/frontmatter.ts",
    "tools/shared/src/node/filesystem.ts",
    "tools/shared/src/version-control",
    "tools/skill-package/src/release-manifest.ts",
    "tools/skill-package/src/version.ts"
  ]) {
    await copyRepositoryPath(relativePath, root);
  }

  await fs.mkdir(path.join(root, ".githooks"), { recursive: true });
  const hookSource = await fs.readFile(
    path.join(workspaceRoot, ".githooks", "pre-commit"),
    "utf8"
  );
  await fs.writeFile(
    path.join(root, ".githooks", "pre-commit"),
    `${hookSource.trimEnd()}\nprintf 'executed\\n' > .hash-hook-ran\n`,
    "utf8"
  );
  await fs.chmod(path.join(root, ".githooks", "pre-commit"), 0o755);
  await fs.writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        scripts: { "hash:skills": "bun scripts/hash-skills.ts" },
        type: "module"
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(root, ".gitignore"),
    "node_modules/\n.hash-hook-ran\n",
    "utf8"
  );
  await fs.mkdir(path.join(root, "skills", "alpha"), { recursive: true });
  await fs.writeFile(
    path.join(root, "skills", "alpha", "SKILL.md"),
    [
      "---",
      "name: alpha",
      "description: Linked worktree hook regression fixture.",
      "metadata:",
      '  version: "1"',
      "---",
      "",
      "# Alpha",
      ""
    ].join("\n"),
    "utf8"
  );

  requireSuccess(run("git", ["init", "-b", "main"], root), "git init");
  requireSuccess(run("git", ["add", "."], root), "git add");
  requireSuccess(
    run(
      "git",
      [...gitCommitConfig, "commit", "--no-verify", "-m", "fixture"],
      root
    ),
    "git commit"
  );
  return root;
}

type MetricToolMode = "missing" | "mismatch" | "probe-failure" | "ready";

type FakeToolOptions = Readonly<{
  bunVersion?: string;
  lizard?: MetricToolMode;
  scc?: MetricToolMode;
}>;

async function createFakeToolPath(
  parent: string,
  options: FakeToolOptions = {}
): Promise<string> {
  const bin = path.join(parent, "fake tools");
  await fs.mkdir(bin, { recursive: true });
  const metricTools = {
    lizard: options.lizard ?? "ready",
    scc: options.scc ?? "ready"
  };
  const bunVersion = options.bunVersion ?? "1.3.14";

  const tools = [
    "bun",
    "pnpm",
    "codegraph",
    ...(metricTools.scc === "missing" ? [] : ["scc"]),
    ...(metricTools.lizard === "missing" ? [] : ["lizard"])
  ];
  if (process.platform === "win32") {
    const dispatcherPath = path.join(bin, "fake-tool.mjs");
    await fs.writeFile(
      dispatcherPath,
      [
        "const [tool, command] = process.argv.slice(2);",
        `if (tool === 'bun' && command === '--version') console.log(${JSON.stringify(bunVersion)});`,
        "else if (tool === 'pnpm' && command === '--version') console.log('11.7.0');",
        "else if (tool === 'pnpm' && command === 'list') console.log('[{}]');",
        "else if (tool === 'pnpm' && command === 'install') process.exit(0);",
        "else if (tool === 'codegraph' && command === '--version') console.log('codegraph 1.2.3');",
        "else if (tool === 'codegraph' && command === 'status') console.log(JSON.stringify({ initialized: true, lastIndexed: 'fixture' }));",
        "else if (tool === 'codegraph' && (command === 'init' || command === 'sync')) process.exit(0);",
        `else if (tool === 'scc' && command === '--version') { const mode = ${JSON.stringify(metricTools.scc)}; if (mode === 'mismatch') console.log('scc version 3.7.1'); else if (mode === 'probe-failure') { console.error('scc probe failed'); process.exit(2); } else console.log('scc version 3.7.0'); }`,
        `else if (tool === 'lizard' && command === '--version') { const mode = ${JSON.stringify(metricTools.lizard)}; if (mode === 'mismatch') console.log('1.23.1'); else if (mode === 'probe-failure') { console.error('lizard probe failed'); process.exit(2); } else console.log('1.23.0'); }`,
        "else { console.error(`unexpected ${tool} command: ${process.argv.slice(3).join(' ')}`); process.exit(2); }",
        ""
      ].join("\n"),
      "utf8"
    );
    for (const tool of tools) {
      const quoteBatch = (value: string): string =>
        `"${value.replaceAll("%", "%%").replaceAll('"', '""')}"`;
      await fs.writeFile(
        path.join(bin, `${tool}.cmd`),
        `@${quoteBatch(process.execPath)} ${quoteBatch(dispatcherPath)} ${tool} %*\r\n`,
        "utf8"
      );
    }
  } else {
    const dispatcherPath = path.join(bin, "fake-tool");
    await writeExecutable(
      dispatcherPath,
      [
        "#!/bin/sh",
        "tool=${0##*/}",
        "command=$1",
        "shift",
        'case "$tool:$command" in',
        `  bun:--version) printf '%s\\n' ${JSON.stringify(bunVersion)} ;;`,
        "  pnpm:--version) printf '%s\\n' '11.7.0' ;;",
        "  pnpm:list) printf '%s\\n' '[{}]' ;;",
        "  pnpm:install) ;;",
        "  codegraph:--version) printf '%s\\n' 'codegraph 1.2.3' ;;",
        `  codegraph:status) printf '%s\\n' '${JSON.stringify({ initialized: true, lastIndexed: "fixture" })}' ;;`,
        "  codegraph:init|codegraph:sync) ;;",
        metricTools.scc === "probe-failure"
          ? "  scc:--version) printf '%s\\n' 'scc probe failed' >&2; exit 2 ;;"
          : `  scc:--version) printf '%s\\n' ${JSON.stringify(metricTools.scc === "mismatch" ? "scc version 3.7.1" : "scc version 3.7.0")} ;;`,
        metricTools.lizard === "probe-failure"
          ? "  lizard:--version) printf '%s\\n' 'lizard probe failed' >&2; exit 2 ;;"
          : `  lizard:--version) printf '%s\\n' ${JSON.stringify(metricTools.lizard === "mismatch" ? "1.23.1" : "1.23.0")} ;;`,
        '  *) printf \'unexpected %s command: %s\\n\' "$tool" "$*" >&2; exit 2 ;;',
        "esac",
        ""
      ].join("\n")
    );
    for (const tool of tools) {
      await fs.link(dispatcherPath, path.join(bin, tool));
    }
  }
  return bin;
}

function environmentWith(
  fakeToolPath: string,
  pathValue: string = process.env.PATH ?? ""
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${fakeToolPath}${path.delimiter}${pathValue}`
  };
}

function runEnvironment(
  root: string,
  action: "check" | "setup",
  fakeToolPath: string,
  environment: NodeJS.ProcessEnv = environmentWith(fakeToolPath)
): CommandResult {
  return run(
    process.execPath,
    [path.join(root, "scripts", "environment.js"), action],
    root,
    environment
  );
}

function commandPaths(command: string): readonly string[] {
  const locator = process.platform === "win32" ? "where" : "which";
  const args = process.platform === "win32" ? [command] : ["-a", command];
  const result = run(locator, args, workspaceRoot);
  requireSuccess(result, `${locator} ${command}`);
  const paths = result.stdout
    .split(/\r?\n/u)
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0);
  assert.ok(paths.length > 0, `${locator} ${command} returned no path`);
  return paths;
}

function assertHookExecutes(root: string): void {
  const result = run(
    "git",
    [...gitCommitConfig, "commit", "--allow-empty", "-m", "hook check"],
    root
  );
  assert.notEqual(result.status, 0, "the fixture hook must block the commit");
}

async function assertHookIsUsable(root: string): Promise<void> {
  const hook = await fs.stat(path.join(root, ".githooks", "pre-commit"));
  assert.equal(hook.isFile(), true);
  if (process.platform !== "win32") {
    assert.notEqual(hook.mode & 0o111, 0);
  }
}

test("environment setup enables the pre-commit hook in a fresh clone", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills environment clone ")
  );
  try {
    const source = await createRepository(tempRoot, "source repository");
    const clone = path.join(tempRoot, "fresh clone");
    requireSuccess(
      run(
        "git",
        ["-c", "core.autocrlf=true", "clone", "--no-local", source, clone],
        tempRoot
      ),
      "git clone"
    );
    const fakeTools = await createFakeToolPath(tempRoot);

    const setup = runEnvironment(clone, "setup", fakeTools);
    requireSuccess(setup, "environment setup");
    assert.equal(
      run(
        "git",
        ["config", "--local", "--get", "core.hooksPath"],
        clone
      ).stdout.trim(),
      ".githooks"
    );
    assert.equal(
      (
        await fs.readFile(path.join(clone, ".githooks", "pre-commit"), "utf8")
      ).includes("\r"),
      false,
      "the hook must remain LF-only when checkout conversion is enabled"
    );
    await assertHookIsUsable(clone);

    assertHookExecutes(clone);
    assert.equal(
      await fs.readFile(path.join(clone, ".hook-ran"), "utf8"),
      "executed\n"
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("environment setup is idempotent in a linked worktree and keeps the main task root", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills environment worktree ")
  );
  try {
    const main = await createRepository(tempRoot, "main repository");
    const linked = path.join(tempRoot, "linked worker");
    requireSuccess(
      run("git", ["worktree", "add", "-b", "worker", linked], main),
      "git worktree add"
    );
    await fs.chmod(path.join(linked, ".githooks", "pre-commit"), 0o600);
    const fakeTools = await createFakeToolPath(tempRoot);

    requireSuccess(
      runEnvironment(linked, "setup", fakeTools),
      "first linked worktree setup"
    );
    requireSuccess(
      runEnvironment(linked, "setup", fakeTools),
      "repeated linked worktree setup"
    );
    assert.equal(
      run("git", ["worktree", "list", "--porcelain"], linked).stdout.split(
        "\n",
        1
      )[0],
      `worktree ${main}`
    );
    await assertHookIsUsable(linked);
    assertHookExecutes(linked);
    assert.equal(
      await fs.readFile(path.join(linked, ".hook-ran"), "utf8"),
      "executed\n"
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("real hash pre-commit succeeds in a linked worktree with isolated Git environment", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills real hash hook ")
  );
  try {
    const main = await createHashHookRepository(tempRoot, "main repository");
    const linked = path.join(tempRoot, "linked worker");
    requireSuccess(
      run("git", ["worktree", "add", "-b", "worker", linked], main),
      "git worktree add"
    );
    await fs.symlink(
      path.join(workspaceRoot, "node_modules"),
      path.join(linked, "node_modules"),
      process.platform === "win32" ? "junction" : "dir"
    );
    requireSuccess(
      run("git", ["config", "--local", "core.hooksPath", ".githooks"], linked),
      "configure hooksPath"
    );

    const commit = run(
      "git",
      [...gitCommitConfig, "commit", "--allow-empty", "-m", "hook regression"],
      linked
    );
    requireSuccess(commit, "linked worktree commit with real hash hook");
    assert.equal(
      await fs.readFile(path.join(linked, ".hash-hook-ran"), "utf8"),
      "executed\n"
    );
    assert.equal(
      run("git", ["log", "-1", "--format=%s"], linked).stdout.trim(),
      "hook regression"
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("environment check reports missing repository setup without writing it", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills environment check ")
  );
  try {
    const root = await createRepository(tempRoot, "unchecked repository");
    const fakeTools = await createFakeToolPath(tempRoot);
    const configBefore = run(
      "git",
      ["config", "--local", "--list"],
      root
    ).stdout;
    const modeBefore = (
      await fs.stat(path.join(root, ".githooks", "pre-commit"))
    ).mode;

    const check = runEnvironment(root, "check", fakeTools);

    assert.equal(check.status, 1);
    assert.match(check.stdout, /repository setup/u);
    assert.match(check.stdout, /environment\.js setup/u);
    assert.equal(
      run("git", ["config", "--local", "--list"], root).stdout,
      configBefore
    );
    assert.equal(
      (await fs.stat(path.join(root, ".githooks", "pre-commit"))).mode,
      modeBefore
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("environment requires exact SCC and Lizard prerequisites without installing them", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills environment metrics ")
  );
  try {
    const root = await createRepository(tempRoot, "metrics repository");
    const readyTools = await createFakeToolPath(path.join(tempRoot, "ready"));
    const readySetup = runEnvironment(root, "setup", readyTools);
    requireSuccess(readySetup, "environment setup with ready metric tools");
    assert.match(readySetup.stdout, /\[ok\]\s+scc 3\.7\.0/u);
    assert.match(readySetup.stdout, /\[ok\]\s+lizard 1\.23\.0/u);

    const sccDirectories = new Set(
      commandPaths("scc").map((sccPath) => path.dirname(sccPath))
    );
    const pathWithoutScc = (process.env.PATH ?? "")
      .split(path.delimiter)
      .filter((directory) => !sccDirectories.has(directory))
      .join(path.delimiter);
    const missingTools = await createFakeToolPath(
      path.join(tempRoot, "missing"),
      { scc: "missing" }
    );
    const missingEnvironment = environmentWith(missingTools, pathWithoutScc);
    const missing = runEnvironment(
      root,
      "check",
      missingTools,
      missingEnvironment
    );
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /\[missing\]\s+scc/u);
    assert.match(
      missing.stdout,
      /Install SCC 3\.7\.0 with: go install github\.com\/boyter\/scc\/v3@v3\.7\.0/u
    );

    const missingRoot = await createRepository(
      tempRoot,
      "missing metrics repository"
    );
    const missingSetup = runEnvironment(
      missingRoot,
      "setup",
      missingTools,
      missingEnvironment
    );
    assert.equal(missingSetup.status, 1);
    assert.match(missingSetup.stderr, /does not install them/u);
    assert.equal(
      run("git", ["config", "--local", "--get", "core.hooksPath"], missingRoot)
        .status,
      1,
      "missing metric prerequisites must stop setup before repository writes"
    );

    const mismatchTools = await createFakeToolPath(
      path.join(tempRoot, "mismatch"),
      { lizard: "mismatch" }
    );
    const mismatch = runEnvironment(root, "check", mismatchTools);
    assert.equal(mismatch.status, 1);
    assert.match(mismatch.stdout, /\[mismatch\]\s+lizard 1\.23\.1/u);
    assert.match(mismatch.stdout, /expected 1\.23\.0/u);
    assert.match(mismatch.stdout, /Install Lizard 1\.23\.0 on PATH/u);

    const probeFailureTools = await createFakeToolPath(
      path.join(tempRoot, "probe failure"),
      { scc: "probe-failure" }
    );
    const probeFailure = runEnvironment(root, "check", probeFailureTools);
    assert.equal(probeFailure.status, 1);
    assert.match(probeFailure.stdout, /\[error\]\s+scc/u);
    assert.match(probeFailure.stdout, /scc probe failed/u);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("environment requires the Vibe Bun runtime minimum", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills environment Bun runtime ")
  );
  try {
    const root = await createRepository(tempRoot, "Bun runtime repository");
    const supportedTools = await createFakeToolPath(
      path.join(tempRoot, "supported"),
      { bunVersion: "1.3.14" }
    );
    const setup = runEnvironment(root, "setup", supportedTools);
    requireSuccess(setup, "environment setup with supported Bun");
    assert.match(setup.stdout, /\[ok\]\s+bun 1\.3\.14/u);
    requireSuccess(
      runEnvironment(root, "check", supportedTools),
      "environment check with supported Bun"
    );

    const outdatedTools = await createFakeToolPath(
      path.join(tempRoot, "outdated"),
      { bunVersion: "1.3.13" }
    );
    const outdated = runEnvironment(root, "check", outdatedTools);
    assert.equal(outdated.status, 1);
    assert.match(
      outdated.stdout,
      /\[outdated\]\s+bun 1\.3\.13 - requires >= 1\.3\.14/u
    );
    assert.match(
      outdated.stdout,
      /Environment is not ready\. Run: node scripts\/environment\.js setup/u
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("repository maintenance short commands invoke their owned skill CLIs", () => {
  const commandHelpPatterns = {
    "change-plan": /change-plan\.mjs check-all/u,
    "decision-records": /Query and maintain agent-oriented decision records/u,
    "investigation-report":
      /Investigation Report records and their derived index/u,
    "task-graph": /"commands":\[/u,
    "test-evidence":
      /Validate, query, and selectively stage indexed test evidence/u,
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
