import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  getTaskGraphRuntimeInfo,
  loadNativeLockBinding,
  type RuntimeContextOptions
} from "../../src/runtime.ts";
import {
  expectTaskGraphRejection,
  resolveNodeVersion,
  withTempWorkspace
} from "../support/helpers.ts";

async function runtimeOptions(
  toolHome: string
): Promise<RuntimeContextOptions> {
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
    assert.equal(
      defaultInfo.toolHome,
      path.join(defaultHome, ".tools", "task-graph")
    );
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

test("runtime inspection enforces each supported Node range boundary", async () => {
  await withTempWorkspace(async (root) => {
    const environment = { TASK_GRAPH_TOOL_HOME: path.join(root, "tool-home") };
    for (const nodeVersion of [
      "22.22.2",
      "v22.23.0",
      "v24.15.0",
      "v24.16.0",
      "v26.0.0",
      "v28.0.0"
    ]) {
      const info = await getTaskGraphRuntimeInfo({ environment, nodeVersion });
      assert.equal(info.state, "missing", nodeVersion);
    }
    for (const nodeVersion of [
      "v22.21.9",
      "v22.22.1",
      "v23.0.0",
      "v24.14.9",
      "v25.0.0",
      "v24.15",
      "invalid"
    ]) {
      await expectTaskGraphRejection(
        () => getTaskGraphRuntimeInfo({ environment, nodeVersion }),
        "RUNTIME_UNSUPPORTED"
      );
    }
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
    const installCommand = missingError.details.installCommand;
    if (
      installCommand === null ||
      typeof installCommand !== "object" ||
      Array.isArray(installCommand)
    ) {
      throw new Error(
        "RUNTIME_MISSING installCommand detail must be an object"
      );
    }
    assert.equal(Object.getPrototypeOf(installCommand), null);
    assert.deepEqual({ ...installCommand }, missing.installCommand);

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
