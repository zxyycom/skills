import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  getTaskGraphRuntimeInfo,
  loadNativeLockBinding,
  type RuntimeContextOptions
} from "../src/runtime.ts";
import {
  expectTaskGraphRejection,
  prepareRootNativeRuntime,
  resolveNodeExecutable,
  resolveNodeVersion,
  withTempWorkspace
} from "./helpers.ts";

const execFileAsync = promisify(execFile);

async function runtimeOptions(toolHome: string): Promise<RuntimeContextOptions> {
  return {
    environment: { TASK_GRAPH_TOOL_HOME: toolHome },
    nodeVersion: await resolveNodeVersion()
  };
}

test("runtime info returns deterministic installation argv without persistent writes", async () => {
  await withTempWorkspace(async (root) => {
    const defaultHome = path.join(root, "default-home");
    const environmentHome = path.join(root, "environment-home");
    const nodeVersion = await resolveNodeVersion();
    const defaultInfo = await getTaskGraphRuntimeInfo({
      environment: {},
      homedir: () => defaultHome,
      nodeVersion
    });
    const environmentInfo = await getTaskGraphRuntimeInfo({
      environment: { TASK_GRAPH_TOOL_HOME: environmentHome },
      homedir: () => defaultHome,
      nodeVersion
    });

    assert.equal(defaultInfo.runtimeId, "fs-native-extensions-1.5.0");
    assert.equal(defaultInfo.toolHome, path.join(defaultHome, ".tools", "task-graph"));
    assert.equal(defaultInfo.toolHomeSource, "default");
    assert.equal(environmentInfo.toolHome, path.resolve(environmentHome));
    assert.equal(environmentInfo.toolHomeSource, "environment");
    assert.equal(environmentInfo.state, "missing");
    assert.equal(environmentInfo.compatible, false);
    assert.deepEqual(environmentInfo.installCommand, {
      command: "npm",
      args: [
        "install",
        "--prefix",
        environmentInfo.runtimePath,
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--save-exact",
        "fs-native-extensions@1.5.0"
      ]
    });
    await assert.rejects(fs.stat(defaultHome), { code: "ENOENT" });
    await assert.rejects(fs.stat(environmentHome), { code: "ENOENT" });
  });
});

test("runtime inspection rejects unsupported Node before installation state", async () => {
  await withTempWorkspace(async (root) => {
    const options = {
      environment: { TASK_GRAPH_TOOL_HOME: path.join(root, "tool-home") },
      nodeVersion: "v20.0.0"
    };
    await expectTaskGraphRejection(
      () => getTaskGraphRuntimeInfo(options),
      "RUNTIME_UNSUPPORTED"
    );
    await expectTaskGraphRejection(
      () => loadNativeLockBinding(options),
      "RUNTIME_UNSUPPORTED"
    );
  });
});

test("runtime missing and incompatible states fail closed", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "tool-home");
    const options = await runtimeOptions(toolHome);
    const missing = await getTaskGraphRuntimeInfo(options);
    assert.equal(missing.state, "missing");
    const missingError = await expectTaskGraphRejection(
      () => loadNativeLockBinding(options),
      "RUNTIME_MISSING"
    );
    assert.deepEqual(missingError.details.installCommand, missing.installCommand);

    const packageRoot = path.join(
      missing.runtimePath,
      "node_modules",
      "fs-native-extensions"
    );
    await fs.mkdir(packageRoot, { recursive: true });
    await fs.writeFile(
      path.join(packageRoot, "package.json"),
      `${JSON.stringify({ name: "fs-native-extensions", version: "0.0.0" })}\n`,
      "utf8"
    );
    const incompatible = await getTaskGraphRuntimeInfo(options);
    assert.equal(incompatible.state, "incompatible");
    assert.equal(incompatible.compatible, false);
    assert.equal(incompatible.installCommand, null);
    assert.match(incompatible.reason ?? "", /version is not 1\.5\.0/u);
    await expectTaskGraphRejection(
      () => loadNativeLockBinding(options),
      "RUNTIME_INCOMPATIBLE"
    );
  });
});

test("runtime loads the exact direct package and passes a real native lock probe", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "tool-home");
    await prepareRootNativeRuntime(toolHome);
    const runtimeModuleUrl = new URL("../src/runtime.ts", import.meta.url).href;
    const script = [
      `const runtime=await import(${JSON.stringify(runtimeModuleUrl)})`,
      `const options={environment:{TASK_GRAPH_TOOL_HOME:${JSON.stringify(toolHome)}}}`,
      "const info=await runtime.getTaskGraphRuntimeInfo(options)",
      "const binding=await runtime.loadNativeLockBinding(options)",
      "process.stdout.write(JSON.stringify({info,tryLock:typeof binding.tryLock,unlock:typeof binding.unlock}))"
    ].join(";");
    const result = JSON.parse((await execFileAsync(
      await resolveNodeExecutable(),
      ["--input-type=module", "-e", script],
      { windowsHide: true }
    )).stdout) as {
      info: Awaited<ReturnType<typeof getTaskGraphRuntimeInfo>>;
      tryLock: string;
      unlock: string;
    };
    assert.equal(result.info.state, "compatible");
    assert.equal(result.info.compatible, true);
    assert.equal(result.info.reason, null);
    assert.equal(result.info.installCommand, null);
    assert.equal(result.tryLock, "function");
    assert.equal(result.unlock, "function");
  });
});
