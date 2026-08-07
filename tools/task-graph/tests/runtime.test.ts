import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  checkTaskGraphRuntime,
  getTaskGraphRuntimeInfo,
  installTaskGraphRuntime,
  runNpmCommand,
  type RuntimeContextOptions
} from "../src/runtime.ts";
import {
  copyRootNativePackages,
  expectTaskGraphRejection,
  prepareRootNativeRuntime,
  resolveNodeExecutable,
  resolveNodeVersion,
  withTempWorkspace
} from "./helpers.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
const runtimeAssetRoot = path.join(repositoryRoot, "tools", "task-graph", "references", "runtime");
const cliSourcePath = path.join(repositoryRoot, "tools", "task-graph", "src", "cli.ts");
const installChildPath = path.join(
  repositoryRoot,
  "tools",
  "task-graph",
  "tests",
  "runtime-install-child.ts"
);
const execFileAsync = promisify(execFile);

async function callNodeTaskGraph(
  args: string[],
  environment: NodeJS.ProcessEnv
): Promise<{ exitCode: number | null; stderr: string; stdout: string }> {
  const child = spawn(await resolveNodeExecutable(), [cliSourcePath, ...args], {
    cwd: repositoryRoot,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  return {
    exitCode,
    stderr: Buffer.concat(stderr).toString("utf8"),
    stdout: Buffer.concat(stdout).toString("utf8")
  };
}

function runtimeOptions(toolHome: string): RuntimeContextOptions {
  return {
    environment: { TASK_GRAPH_TOOL_HOME: toolHome },
    nodeVersion: "v24.15.0"
  };
}

test("runtime info uses deterministic text identity, default and environment homes, and no writes", async () => {
  await withTempWorkspace(async (root) => {
    const lfAssets = path.join(root, "lf-assets");
    const crlfAssets = path.join(root, "crlf-assets");
    await Promise.all([fs.mkdir(lfAssets), fs.mkdir(crlfAssets)]);
    for (const name of ["package.json", "package-lock.json"]) {
      const text = await fs.readFile(path.join(runtimeAssetRoot, name), "utf8");
      await Promise.all([
        fs.writeFile(path.join(lfAssets, name), text.replace(/\r\n/gu, "\n"), "utf8"),
        fs.writeFile(path.join(crlfAssets, name), text.replace(/\r?\n/gu, "\r\n"), "utf8")
      ]);
    }
    const defaultHomeParent = path.join(root, "home");
    const defaultInfo = await getTaskGraphRuntimeInfo({
      assetDirectoryUrl: pathToFileURL(`${lfAssets}${path.sep}`),
      environment: {},
      homedir: () => defaultHomeParent
    });
    const configuredHome = path.join(root, "configured-home");
    const configuredInfo = await getTaskGraphRuntimeInfo({
      assetDirectoryUrl: pathToFileURL(`${crlfAssets}${path.sep}`),
      environment: { TASK_GRAPH_TOOL_HOME: configuredHome },
      homedir: () => path.join(root, "unused-home")
    });
    assert.equal(defaultInfo.runtimeId, configuredInfo.runtimeId);
    assert.match(defaultInfo.runtimeId, /^v1-[a-f0-9]{64}$/u);
    assert.equal(defaultInfo.toolHome, path.join(defaultHomeParent, ".tools", "task-graph"));
    assert.equal(defaultInfo.toolHomeSource, "default");
    assert.equal(configuredInfo.toolHome, path.resolve(configuredHome));
    assert.equal(configuredInfo.toolHomeSource, "environment");
    assert.equal(defaultInfo.state, "missing");
    assert.equal(configuredInfo.state, "missing");
    await assert.rejects(fs.stat(defaultInfo.toolHome), { code: "ENOENT" });
    await assert.rejects(fs.stat(configuredInfo.toolHome), { code: "ENOENT" });
  });
});

test("runtime engine boundaries reject unsupported Node before installation state", async () => {
  await withTempWorkspace(async (root) => {
    for (const nodeVersion of ["v22.22.1", "v24.14.9", "v25.9.0", "invalid"]) {
      const error = await expectTaskGraphRejection(
        () => checkTaskGraphRuntime({ ...runtimeOptions(root), nodeVersion }),
        "RUNTIME_UNSUPPORTED"
      );
      assert.equal(error.details.supportedNodeRange, "^22.22.2 || ^24.15.0 || >=26.0.0");
    }
    for (const nodeVersion of ["v22.22.2", "v24.15.0", "v26.0.0"]) {
      await expectTaskGraphRejection(
        () => checkTaskGraphRuntime({ ...runtimeOptions(root), nodeVersion }),
        "RUNTIME_MISSING"
      );
    }
  });
});

test("runtime missing and invalid marker states fail closed without repair", async () => {
  await withTempWorkspace(async (root) => {
    const options = runtimeOptions(path.join(root, "tool-home"));
    const missing = await getTaskGraphRuntimeInfo(options);
    assert.equal(missing.state, "missing");
    const missingError = await expectTaskGraphRejection(
      () => checkTaskGraphRuntime(options),
      "RUNTIME_MISSING"
    );
    assert.deepEqual(missingError.details.installCommand, ["runtime", "install"]);
    await fs.mkdir(missing.runtimePath, { recursive: true });
    await fs.writeFile(path.join(missing.runtimePath, "runtime.json"), "{}\n", "utf8");
    assert.equal((await getTaskGraphRuntimeInfo(options)).state, "invalid");
    await expectTaskGraphRejection(
      () => checkTaskGraphRuntime(options),
      "RUNTIME_INCOMPATIBLE"
    );
    assert.equal((await fs.readFile(path.join(missing.runtimePath, "runtime.json"), "utf8")), "{}\n");
  });
});

test("runtime install failure sanitizes long, chunk-independent JSON and URL secrets before 8 KiB tail", async () => {
  await withTempWorkspace(async (root) => {
    const options = {
      ...runtimeOptions(path.join(root, "tool-home")),
      commandRunner: async () => ({
        exitCode: 9,
        signal: null,
        stdout: `_authToken=${"S".repeat(100_000)}\nstdout-safe\n`,
        stderr: `\u001b[31m{"token":"json-secret"}\nhttps://user:pass@example.test/path\npassword='quoted-secret'\nstderr-safe\n`,
        timedOut: false
      })
    };
    const error = await expectTaskGraphRejection(
      () => installTaskGraphRuntime(options),
      "RUNTIME_INSTALL_FAILED"
    );
    assert.equal(error.details.phase, "npm-ci");
    const stdout = String(error.details.stdoutTail);
    const stderr = String(error.details.stderrTail);
    assert.equal(Buffer.byteLength(stdout) <= 8 * 1024, true);
    assert.equal(Buffer.byteLength(stderr) <= 8 * 1024, true);
    assert.match(stdout, /_authToken=\[redacted\]/u);
    assert.match(stdout, /stdout-safe/u);
    assert.match(stderr, /"token":"\[redacted\]"/u);
    assert.match(stderr, /https:\/\/\[redacted\]@example\.test\/path/u);
    assert.match(stderr, /password='\[redacted\]'/u);
    for (const secret of ["json-secret", "quoted-secret", "user:pass", "SSSSSSSS"]) {
      assert.equal(`${stdout}${stderr}`.includes(secret), false);
    }
    const runtimes = path.join(root, "tool-home", "runtimes");
    assert.deepEqual(await fs.readdir(runtimes), []);
  });
});

test("npm command sanitizer handles secret keys split across process output chunks", async () => {
  await withTempWorkspace(async (root) => {
    const node = await resolveNodeExecutable();
    const script = [
      "process.stdout.write('_auth')",
      "setTimeout(()=>{",
      "process.stdout.write('Token=chunk-secret\\n\\\"token\\\":\\\"json-secret\\\"\\nhttps://user:pass@example.test/path\\n')",
      "process.exit(7)",
      "},10)"
    ].join(";");
    const result = await runNpmCommand({
      args: ["-e", script],
      command: node,
      cwd: root,
      timeoutMilliseconds: 2_000
    });
    assert.equal(result.exitCode, 7);
    assert.equal(result.timedOut, false);
    assert.match(result.stdout, /_authToken=\[redacted\]/u);
    assert.match(result.stdout, /"token":"\[redacted\]"/u);
    assert.match(result.stdout, /https:\/\/\[redacted\]@example\.test\/path/u);
    assert.equal(result.stdout.includes("chunk-secret"), false);
    assert.equal(result.stdout.includes("json-secret"), false);
    assert.equal(result.stdout.includes("user:pass"), false);
  });
});

test("npm command spawn errors reject promptly and clear process resources", async () => {
  await withTempWorkspace(async (root) => {
    const started = performance.now();
    await assert.rejects(runNpmCommand({
      args: [],
      command: path.join(root, "command-that-does-not-exist"),
      cwd: root,
      timeoutMilliseconds: 10_000
    }));
    assert.equal(performance.now() - started < 2_000, true);
  });
});

test("npm command timeout terminates and waits for the direct child", async () => {
  await withTempWorkspace(async (root) => {
    const result = await runNpmCommand({
      args: ["-e", "setInterval(()=>{},1000)"],
      command: await resolveNodeExecutable(),
      cwd: root,
      timeoutMilliseconds: 30
    });
    assert.equal(result.timedOut, true);
    assert.equal(result.exitCode === null || result.exitCode !== 0, true);
  });
});

test("npm timeout does not wait for or capture a detached descendant holding inherited pipes", async () => {
  await withTempWorkspace(async (root) => {
    const readySentinel = path.join(root, "descendant-ready");
    const parentConfirmedSentinel = path.join(root, "parent-confirmed-ready");
    const lateSentinel = path.join(root, "descendant-late-output");
    const descendant = [
      "const fs=require('node:fs')",
      "process.chdir(require('node:os').tmpdir())",
      "process.stdout.on('error',()=>{})",
      "process.stderr.on('error',()=>{})",
      "fs.writeFileSync(" + JSON.stringify(readySentinel) + ",'ready\\n')",
      "if(typeof process.send!=='function')process.exit(11)",
      "process.send('ready',()=>process.disconnect())",
      "setTimeout(()=>{fs.writeFileSync("
        + JSON.stringify(lateSentinel)
        + ",'late\\n');process.stdout.write('DESCENDANT_LATE_STDOUT\\n')},4500)",
      "setTimeout(()=>process.exit(0),8000)"
    ].join(";");
    const parent = [
      "const {spawn}=require('node:child_process')",
      "const fs=require('node:fs')",
      "const readySentinel=" + JSON.stringify(readySentinel),
      "const parentConfirmedSentinel=" + JSON.stringify(parentConfirmedSentinel),
      "const child=spawn(process.execPath,['-e',"
        + JSON.stringify(descendant)
        + "],{detached:true,stdio:['ignore','inherit','inherit','ipc'],windowsHide:true})",
      "child.once('error',()=>process.exit(12))",
      "child.once('message',(message)=>{",
      "if(message!=='ready')process.exit(13)",
      "if(fs.readFileSync(readySentinel,'utf8')!=='ready\\n')process.exit(14)",
      "fs.writeFileSync(parentConfirmedSentinel,'confirmed\\n')",
      "child.unref()",
      "process.stdout.write('PARENT_CONFIRMED\\n',()=>process.exit(0))",
      "})"
    ].join(";");
    const started = performance.now();
    const result = await runNpmCommand({
      args: ["-e", parent],
      command: await resolveNodeExecutable(),
      cwd: root,
      timeoutMilliseconds: 3_000,
      windowsTaskkill: async () => false
    });
    const elapsed = performance.now() - started;
    assert.equal(await fs.readFile(readySentinel, "utf8"), "ready\n");
    assert.equal(await fs.readFile(parentConfirmedSentinel, "utf8"), "confirmed\n");
    assert.equal(result.exitCode, 0);
    assert.equal(result.signal, null);
    assert.equal(result.timedOut, true);
    assert.equal(result.stdout.includes("PARENT_CONFIRMED"), true);
    assert.equal(
      elapsed < 6_500,
      true,
      "timeout settlement took " + elapsed + "ms"
    );

    let lateText: string | null = null;
    const lateDeadline = performance.now() + 6_000;
    while (lateText === null && performance.now() < lateDeadline) {
      try {
        lateText = await fs.readFile(lateSentinel, "utf8");
      } catch (error) {
        if (!(
          error instanceof Error
          && "code" in error
          && error.code === "ENOENT"
        )) {
          throw error;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }
    }
    assert.equal(lateText, "late\n", "detached descendant did not emit late output");
    assert.equal(result.stdout.includes("DESCENDANT_LATE_STDOUT"), false);
  });
});

test("Windows npm timeout falls back to direct kill when taskkill is unsuccessful", async () => {
  if (process.platform !== "win32") {
    return;
  }
  await withTempWorkspace(async (root) => {
    let taskkillCalls = 0;
    const result = await runNpmCommand({
      args: ["-e", "setInterval(()=>{},1000)"],
      command: await resolveNodeExecutable(),
      cwd: root,
      timeoutMilliseconds: 30,
      windowsTaskkill: async () => {
        taskkillCalls += 1;
        return false;
      }
    });
    assert.equal(taskkillCalls, 1);
    assert.equal(result.timedOut, true);
    assert.equal(result.exitCode === null || result.exitCode !== 0, true);
  });
});

test("Windows npm timeout bounds a taskkill call that never settles", async () => {
  if (process.platform !== "win32") {
    return;
  }
  await withTempWorkspace(async (root) => {
    let taskkillCalls = 0;
    const started = performance.now();
    const result = await runNpmCommand({
      args: ["-e", "setInterval(()=>{},1000)"],
      command: await resolveNodeExecutable(),
      cwd: root,
      timeoutMilliseconds: 30,
      windowsTaskkill: async () => {
        taskkillCalls += 1;
        return await new Promise<boolean>(() => undefined);
      }
    });
    const elapsed = performance.now() - started;
    assert.equal(taskkillCalls, 1);
    assert.equal(result.timedOut, true);
    assert.equal(elapsed < 1_000, true, `timeout settlement took ${elapsed}ms`);
  });
});

test("POSIX npm timeout escalates to SIGKILL for an ignoring process group and descendants", async () => {
  if (process.platform === "win32") {
    return;
  }
  await withTempWorkspace(async (root) => {
    const sentinel = path.join(root, "descendant-survived");
    const descendant = `setTimeout(()=>require('node:fs').writeFileSync(${JSON.stringify(sentinel)},'bad'),700);setInterval(()=>{},1000)`;
    const script = [
      "const {spawn}=require('node:child_process')",
      "process.on('SIGTERM',()=>{})",
      `spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'ignore'})`,
      "setInterval(()=>{},1000)"
    ].join(";");
    const result = await runNpmCommand({
      args: ["-e", script],
      command: await resolveNodeExecutable(),
      cwd: root,
      timeoutMilliseconds: 30
    });
    assert.equal(result.timedOut, true);
    assert.equal(result.signal, "SIGKILL");
    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    await assert.rejects(fs.stat(sentinel), { code: "ENOENT" });
  });
});

test("runtime install never removes a pre-existing UUID-collision directory it did not create", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "tool-home");
    const options = runtimeOptions(toolHome);
    const info = await getTaskGraphRuntimeInfo(options);
    const uuid = "00000000-0000-4000-8000-000000000001";
    const collision = path.join(toolHome, "runtimes", `.install-${info.runtimeId}-${uuid}`);
    await fs.mkdir(collision, { recursive: true });
    await fs.writeFile(path.join(collision, "sentinel"), "owned elsewhere\n", "utf8");
    const error = await expectTaskGraphRejection(
      () => installTaskGraphRuntime({ ...options, uuid: () => uuid }),
      "RUNTIME_INSTALL_FAILED"
    );
    assert.equal(error.details.phase, "prepare");
    assert.equal(await fs.readFile(path.join(collision, "sentinel"), "utf8"), "owned elsewhere\n");
  });
});

test("runtime install probe reports an uncontended tryLock failure with child diagnostics", async () => {
  await withTempWorkspace(async (root) => {
    const node = await resolveNodeExecutable();
    const options = {
      ...runtimeOptions(path.join(root, "tool-home")),
      commandRunner: async (request: { cwd: string }) => {
        const result = await copyRootNativePackages(request.cwd);
        await fs.writeFile(
          path.join(request.cwd, "node_modules", "fs-native-extensions", "index.js"),
          "module.exports={tryLock:()=>false,unlock:()=>undefined};\n",
          "utf8"
        );
        return result;
      },
      probeCommandRunner: async (request: Parameters<typeof runNpmCommand>[0]) =>
        await runNpmCommand({ ...request, command: node })
    };
    const error = await expectTaskGraphRejection(
      () => installTaskGraphRuntime(options),
      "RUNTIME_INSTALL_FAILED"
    );
    assert.equal(error.details.phase, "probe");
    assert.equal(typeof error.details.exitCode, "number");
    assert.notEqual(error.details.exitCode, 0);
    assert.equal(error.details.signal, null);
    assert.equal(error.details.timedOut, false);
    assert.equal(error.details.stdoutTail, "");
    assert.match(String(error.details.stderrTail), /uncontended native lock failed/u);
  });
});

test("runtime install probe preserves sanitized timed-out child diagnostics", async () => {
  await withTempWorkspace(async (root) => {
    const options = {
      ...runtimeOptions(path.join(root, "tool-home")),
      commandRunner: async (request: { cwd: string }) =>
        await copyRootNativePackages(request.cwd),
      probeCommandRunner: async () => ({
        exitCode: null,
        signal: "SIGKILL" as const,
        stdout: "token=stdout-secret\nstdout-safe\n",
        stderr: "https://user:pass@example.test/path\nstderr-safe\n",
        timedOut: true
      })
    };
    const error = await expectTaskGraphRejection(
      () => installTaskGraphRuntime(options),
      "RUNTIME_INSTALL_FAILED"
    );
    assert.equal(error.details.phase, "probe");
    assert.equal(error.details.exitCode, null);
    assert.equal(error.details.signal, "SIGKILL");
    assert.equal(error.details.timedOut, true);
    assert.match(String(error.details.stdoutTail), /token=\[redacted\]/u);
    assert.match(String(error.details.stdoutTail), /stdout-safe/u);
    assert.match(String(error.details.stderrTail), /https:\/\/\[redacted\]@example\.test\/path/u);
    assert.match(String(error.details.stderrTail), /stderr-safe/u);
    assert.equal(JSON.stringify(error.details).includes("stdout-secret"), false);
    assert.equal(JSON.stringify(error.details).includes("user:pass"), false);
  });
});

test("concurrent native runtime installation converges to installed and reused with a real probe", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "tool-home");
    const node = await resolveNodeExecutable();
    const environment = { ...process.env, TASK_GRAPH_TOOL_HOME: toolHome };
    const results = await Promise.all([
      execFileAsync(node, [installChildPath, toolHome], {
        cwd: repositoryRoot,
        env: environment,
        windowsHide: true
      }),
      execFileAsync(node, [installChildPath, toolHome], {
        cwd: repositoryRoot,
        env: environment,
        windowsHide: true
      })
    ]);
    const actions = results.map(({ stdout }) =>
      (JSON.parse(stdout) as { action: string }).action
    ).sort();
    assert.deepEqual(actions, ["installed", "reused"]);
    const checked = await callNodeTaskGraph(["runtime", "check"], environment);
    assert.equal(checked.exitCode, 0);
    assert.equal(checked.stderr, "");
    const checkedResult = JSON.parse(checked.stdout) as {
      ok: boolean;
      data: { compatible: boolean; state: string };
    };
    assert.equal(checkedResult.ok, true);
    assert.equal(checkedResult.data.compatible, true);
    assert.equal(checkedResult.data.state, "installed");
    const reused = JSON.parse((await execFileAsync(node, [installChildPath, toolHome], {
      cwd: repositoryRoot,
      env: environment,
      windowsHide: true
    })).stdout) as { action: string };
    assert.equal(reused.action, "reused");
    assert.equal((await fs.readdir(path.join(toolHome, "runtimes"))).some(
      (name) => name.startsWith(".install-")
    ), false);
  });
});

test("runtime rejects a missing locked transitive package instead of ancestor node_modules fallback", async () => {
  const root = await fs.mkdtemp(path.join(repositoryRoot, ".tmp-task-graph-runtime-test-"));
  try {
    const toolHome = path.join(root, "tool-home");
    await prepareRootNativeRuntime(toolHome);
    const options = {
      environment: { TASK_GRAPH_TOOL_HOME: toolHome },
      nodeVersion: await resolveNodeVersion()
    };
    const info = await getTaskGraphRuntimeInfo(options);
    const targetDependency = path.join(info.runtimePath, "node_modules", "require-addon");
    const fallbackDependency = path.join(root, "node_modules", "require-addon");
    await fs.mkdir(path.dirname(fallbackDependency), { recursive: true });
    await fs.cp(targetDependency, fallbackDependency, { recursive: true });
    await fs.rm(targetDependency, { force: true, recursive: true });
    const environment = { ...process.env, TASK_GRAPH_TOOL_HOME: toolHome };
    const checked = await callNodeTaskGraph(["runtime", "check"], environment);
    assert.equal(checked.exitCode, 1);
    assert.equal(checked.stderr, "");
    const checkedResult = JSON.parse(checked.stdout) as {
      ok: boolean;
      error: { code: string };
    };
    assert.equal(checkedResult.ok, false);
    assert.equal(checkedResult.error.code, "RUNTIME_INCOMPATIBLE");
    const workspace = path.join(root, "workspace");
    const mutated = await callNodeTaskGraph(["index", "init", "--root", workspace], environment);
    assert.equal(mutated.exitCode, 1);
    const mutationResult = JSON.parse(mutated.stdout) as {
      ok: boolean;
      error: { code: string };
    };
    assert.equal(mutationResult.ok, false);
    assert.equal(mutationResult.error.code, "RUNTIME_INCOMPATIBLE");
    await assert.rejects(fs.stat(path.join(workspace, "docs")), { code: "ENOENT" });
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
});
