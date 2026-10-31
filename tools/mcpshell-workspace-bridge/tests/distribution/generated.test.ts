import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, test } from "node:test";
import {
  createBridgeFixture,
  fixtureSsh,
  type BridgeFixture
} from "../support.ts";
import YAML from "yaml";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);
const skill = path.join(root, "skills", "mcpshell-workspace-tools");
const fixtures: BridgeFixture[] = [];
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()));
});

test("generated bridge modules import without configuration side effects", async () => {
  const fixture = await createBridgeFixture();
  fixtures.push(fixture);
  const scripts = path.join(fixture.skill, "scripts");
  await fs.cp(path.join(skill, "scripts"), scripts, { recursive: true });
  const beforePaths = (
    await fs.readdir(fixture.agentProject, { recursive: true })
  ).sort();
  const beforeIgnore = await fs.readFile(
    path.join(fixture.skill, ".gitignore")
  );
  const beforeDefinitions = await fs.readFile(
    path.join(fixture.skill, "references", "mcpshell-tools.yaml")
  );
  for (const script of [
    "init-mcpshell-workspace.ts",
    "mcpshell-workspace.ts"
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `await import(${JSON.stringify(pathToFileURL(path.join(scripts, script)).href)});`
      ],
      {
        encoding: "utf8",
        cwd: fixture.agentProject,
        env: {}
      }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
    assert.deepEqual(
      (await fs.readdir(fixture.agentProject, { recursive: true })).sort(),
      beforePaths
    );
    assert.deepEqual(
      await fs.readFile(path.join(fixture.skill, ".gitignore")),
      beforeIgnore
    );
    assert.deepEqual(
      await fs.readFile(
        path.join(fixture.skill, "references", "mcpshell-tools.yaml")
      ),
      beforeDefinitions
    );
  }
});

test("distributed MCPShell ignore rules preserve environment safety and public initializer preview", async () => {
  const ignore = await fs.readFile(path.join(skill, ".gitignore"), "utf8");
  assert.equal(
    ignore.split("\n").filter((line) => line === "/.env.mcpshell").length,
    1
  );
  assert.match(ignore, /node_modules\//u);
  const preview = spawnSync(
    "node",
    [
      path.join(skill, "scripts/init-mcpshell-workspace.ts"),
      "preview",
      "--identity",
      "distribution_check",
      "--backend",
      "fixture",
      "--project-root",
      "/project",
      "--staging-root",
      "/tmp/mcpshell-distribution-check"
    ],
    { encoding: "utf8" }
  );
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).ok, true);
});

test("generated MCPShell definitions expose the four fixed-root operations", async () => {
  const definition = YAML.parse(
    await fs.readFile(
      path.join(skill, "references", "mcpshell-tools.yaml"),
      "utf8"
    )
  ) as {
    mcp: {
      tools: Array<{
        name: string;
        params: Record<string, { default?: unknown }>;
        run: { timeout: string };
      }>;
    };
  };
  assert.deepEqual(
    definition.mcp.tools.map((tool) => tool.name),
    [
      "workspace_shell",
      "workspace_apply_patch",
      "workspace_put_file",
      "workspace_get_file"
    ]
  );
  for (const tool of definition.mcp.tools) {
    assert.equal("backend" in tool.params, false);
    assert.equal("project_root" in tool.params, false);
  }
  assert.equal(definition.mcp.tools[2].params.replace.default, false);
  assert.deepEqual(
    definition.mcp.tools.map((tool) => tool.run.timeout),
    ["2m", "2m", "5m", "5m"]
  );
});

test("generated Node initializer and runtime execute from an installed skill layout", async () => {
  const fixture = await createBridgeFixture();
  fixtures.push(fixture);
  const scripts = path.join(fixture.skill, "scripts");
  await fs.mkdir(scripts, { recursive: true });
  await fs.cp(path.join(skill, "scripts"), scripts, { recursive: true });
  const init = spawnSync(
    process.execPath,
    [
      path.join(scripts, "init-mcpshell-workspace.ts"),
      "apply",
      "--identity",
      "workspace_bridge",
      "--backend",
      "fixture",
      "--project-root",
      fixture.project,
      "--staging-root",
      fixture.staging
    ],
    { encoding: "utf8" }
  );
  assert.equal(init.status, 0, init.stderr);
  assert.equal(JSON.parse(init.stdout).ok, true);
  assert.equal(init.stdout.includes(fixture.agentProject), false);
  assert.equal(init.stdout.includes(fixture.project), false);
  assert.equal(init.stdout.includes(fixture.staging), false);
  assert.equal(init.stdout.includes("MCPSHELL_BACKEND_HANDLE=fixture"), false);
  const shell = spawnSync(
    process.execPath,
    [path.join(scripts, "mcpshell-workspace.ts"), "shell"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        MCPSHELL_WORKSPACE_COMMAND: "printf node-runtime",
        PATH: `${path.dirname(fixtureSsh(fixture))}${path.delimiter}${process.env.PATH ?? ""}`
      },
      maxBuffer: 1024 * 1024,
      cwd: fixture.agentProject
    }
  );
  assert.equal(shell.status, 0, shell.stderr);
  const result = JSON.parse(shell.stdout) as { ok: boolean; stdout: string };
  assert.equal(result.ok, true);
  assert.equal(result.stdout, "node-runtime");
});

test("generated runtime renders missing and malformed configuration as JSON envelopes", async () => {
  const fixture = await createBridgeFixture();
  fixtures.push(fixture);
  const scripts = path.join(fixture.skill, "scripts");
  await fs.mkdir(scripts, { recursive: true });
  const runtimePath = path.join(scripts, "mcpshell-workspace.ts");
  await fs.cp(path.join(skill, "scripts"), scripts, { recursive: true });
  for (const environmentSource of [undefined, "MCPSHELL_BACKEND_HANDLE=\n"]) {
    const environmentPath = path.join(fixture.skill, ".env.mcpshell");
    if (environmentSource === undefined) {
      await fs.rm(environmentPath, { force: true });
    } else {
      await fs.writeFile(environmentPath, environmentSource);
    }
    for (const mode of ["shell", "apply-patch", "put-file", "get-file"]) {
      const execution = spawnSync(process.execPath, [runtimePath, mode], {
        encoding: "utf8",
        env: {
          ...process.env,
          MCPSHELL_WORKSPACE_COMMAND: "true"
        },
        maxBuffer: 1024 * 1024
      });
      assert.equal(execution.status, 0, execution.stderr);
      const result = JSON.parse(execution.stdout) as {
        failure_kind: string | null;
        ok: boolean;
      };
      assert.equal(result.ok, false);
      assert.equal(result.failure_kind, "config_invalid");
    }
  }
});
