import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, test } from "node:test";
import { readCliRequest, runInitializer } from "../src/initializer.ts";
import { createBridgeFixture, type BridgeFixture } from "./support.ts";

const fixtures: BridgeFixture[] = [];
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()));
});

async function fixture(): Promise<BridgeFixture> {
  const value = await createBridgeFixture();
  fixtures.push(value);
  return value;
}

function paths(
  value: BridgeFixture
): Readonly<{ agentProjectDirectory: string; skillDirectory: string }> {
  return {
    agentProjectDirectory: value.agentProject,
    skillDirectory: value.skill
  };
}

test("initializer previews without writing machine configuration", async () => {
  const value = await fixture();
  const result = await runInitializer(
    {
      command: "preview",
      config: value.bridgeConfig,
      identity: "workspace_bridge"
    },
    paths(value)
  );
  assert.deepEqual(result, {
    actions: [
      {
        action: "create",
        resource: "skills/mcpshell-workspace-tools/.env.mcpshell"
      },
      { action: "create", resource: ".codex/config.toml" }
    ],
    command: "preview",
    failure_kind: null,
    files: [
      ".codex/config.toml",
      "skills/mcpshell-workspace-tools/.env.mcpshell",
      "skills/mcpshell-workspace-tools/references/mcpshell-tools.yaml"
    ],
    identity: "workspace_bridge",
    ok: true,
    wrote: false
  });
  assert.doesNotMatch(
    JSON.stringify(result),
    new RegExp(value.agentProject, "u")
  );
  assert.doesNotMatch(JSON.stringify(result), new RegExp(value.project, "u"));
  await assert.rejects(fs.access(path.join(value.skill, ".env.mcpshell")));
});

test("initializer applies idempotently and preserves unrelated TOML bytes", async () => {
  const value = await fixture();
  const configPath = path.join(value.agentProject, ".codex", "config.toml");
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  const unrelated =
    '# personal note\nmodel = "test"\n\n[mcp_servers.other]\ncommand = "other"\n';
  await fs.writeFile(configPath, unrelated);
  const request = {
    command: "apply" as const,
    config: value.bridgeConfig,
    identity: "workspace_bridge"
  };
  const first = await runInitializer(request, paths(value));
  assert.equal(first.ok, true);
  assert.deepEqual(first.actions, [
    {
      action: "create",
      resource: "skills/mcpshell-workspace-tools/.env.mcpshell"
    },
    { action: "create", resource: ".codex/config.toml" }
  ]);
  const once = await fs.readFile(configPath, "utf8");
  assert.match(once, /^# personal note/m);
  assert.match(once, /\[mcp_servers\.workspace_bridge\]/u);
  assert.doesNotMatch(once, new RegExp(value.bridgeConfig.projectRoot, "u"));
  const repeated = await runInitializer(request, paths(value));
  assert.equal(repeated.wrote, false);
  assert.deepEqual(repeated.actions, [
    {
      action: "unchanged",
      resource: "skills/mcpshell-workspace-tools/.env.mcpshell"
    },
    { action: "unchanged", resource: ".codex/config.toml" }
  ]);
  assert.equal(await fs.readFile(configPath, "utf8"), once);
  assert.equal(
    await fs.readFile(path.join(value.skill, ".env.mcpshell"), "utf8"),
    `MCPSHELL_BACKEND_HANDLE=fixture\nMCPSHELL_PROJECT_ROOT=${value.project}\nMCPSHELL_STAGING_ROOT=${value.staging}\n`
  );
});

test("initializer stops on an unowned identity and removes only owned configuration", async () => {
  const value = await fixture();
  const configPath = path.join(value.agentProject, ".codex", "config.toml");
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  const unowned = '[mcp_servers.workspace_bridge]\ncommand = "different"\n';
  await fs.writeFile(configPath, unowned);
  const conflict = await runInitializer(
    {
      command: "apply",
      config: value.bridgeConfig,
      identity: "workspace_bridge"
    },
    paths(value)
  );
  assert.equal(conflict.failure_kind, "config_conflict");
  assert.equal(await fs.readFile(configPath, "utf8"), unowned);
  await assert.rejects(fs.access(path.join(value.skill, ".env.mcpshell")));

  await fs.writeFile(configPath, "# keep\n");
  await runInitializer(
    {
      command: "apply",
      config: value.bridgeConfig,
      identity: "workspace_bridge"
    },
    paths(value)
  );
  const removal = await runInitializer(
    { command: "remove", identity: "workspace_bridge", removeEnv: true },
    paths(value)
  );
  assert.equal(removal.ok, true);
  assert.match(await fs.readFile(configPath, "utf8"), /^# keep/m);
  assert.doesNotMatch(
    await fs.readFile(configPath, "utf8"),
    /workspace_bridge/u
  );
  await assert.rejects(fs.access(path.join(value.skill, ".env.mcpshell")));
});

test("initializer preserves an indented following TOML table on apply and remove", async () => {
  const value = await fixture();
  const configPath = path.join(value.agentProject, ".codex", "config.toml");
  const request = {
    command: "apply" as const,
    config: value.bridgeConfig,
    identity: "workspace_bridge"
  };
  await runInitializer(request, paths(value));
  const following = '\t[mcp_servers.other]\ncommand = "other"\n';
  await fs.appendFile(configPath, `\n${following}`);

  const assertToml = (source: string): void => {
    const parsed = spawnSync(
      "python3",
      ["-c", "import sys, tomllib; tomllib.loads(sys.stdin.read())"],
      { encoding: "utf8", input: source }
    );
    assert.equal(parsed.status, 0, parsed.stderr);
  };

  const beforeReapply = await fs.readFile(configPath, "utf8");
  assertToml(beforeReapply);
  assert.equal((await runInitializer(request, paths(value))).ok, true);
  const afterReapply = await fs.readFile(configPath, "utf8");
  assert.match(afterReapply, /\t\[mcp_servers\.other\]\ncommand = "other"\n/u);
  assertToml(afterReapply);

  const removal = await runInitializer(
    { command: "remove", identity: "workspace_bridge" },
    paths(value)
  );
  assert.equal(removal.ok, true);
  const afterRemove = await fs.readFile(configPath, "utf8");
  assert.equal(afterRemove, following);
  assertToml(afterRemove);
});

test("initializer keeps a prelude newline before an indented following table on remove", async () => {
  const value = await fixture();
  const configPath = path.join(value.agentProject, ".codex", "config.toml");
  const source =
    "# prelude\n" +
    "# Managed by mcpshell-workspace-bridge: workspace_bridge\n" +
    "[mcp_servers.workspace_bridge]\n" +
    'command = "mcpshell"\n' +
    'args = ["mcp", "--tools", "skills/mcpshell-workspace-tools/references/mcpshell-tools.yaml"]\n' +
    '\t[mcp_servers.other]\ncommand = "other"\n';
  const expected = '# prelude\n\t[mcp_servers.other]\ncommand = "other"\n';
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, source);
  const parseToml = (toml: string): void => {
    const parsed = spawnSync(
      "python3",
      ["-c", "import sys, tomllib; tomllib.loads(sys.stdin.read())"],
      { encoding: "utf8", input: toml }
    );
    assert.equal(parsed.status, 0, parsed.stderr);
  };
  parseToml(source);

  const result = await runInitializer(
    { command: "remove", identity: "workspace_bridge" },
    paths(value)
  );
  assert.equal(result.ok, true);
  const afterRemove = await fs.readFile(configPath, "utf8");
  assert.equal(afterRemove, expected);
  parseToml(afterRemove);
});

test("initializer rejects non-exact ignore rules and line-breaking configuration", async () => {
  const value = await fixture();
  await fs.writeFile(path.join(value.skill, ".gitignore"), " /.env.mcpshell\n");
  const ignoredIncorrectly = await runInitializer(
    {
      command: "preview",
      config: value.bridgeConfig,
      identity: "workspace_bridge"
    },
    paths(value)
  );
  assert.equal(ignoredIncorrectly.failure_kind, "config_invalid");
  await fs.writeFile(path.join(value.skill, ".gitignore"), "/.env.mcpshell\n");
  const lineBreakingHandle = await runInitializer(
    {
      command: "apply",
      config: {
        ...value.bridgeConfig,
        backendHandle: "fixture\nINJECTED=value"
      },
      identity: "workspace_bridge"
    },
    paths(value)
  );
  assert.equal(lineBreakingHandle.failure_kind, "config_invalid");
  await assert.rejects(fs.access(path.join(value.skill, ".env.mcpshell")));
});

test("initializer rejects an inline-comment table header without changing TOML", async () => {
  const value = await fixture();
  const configPath = path.join(value.agentProject, ".codex", "config.toml");
  const source =
    '[mcp_servers.workspace_bridge] # existing registration\ncommand = "other"\n';
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, source);
  const result = await runInitializer(
    {
      command: "apply",
      config: value.bridgeConfig,
      identity: "workspace_bridge"
    },
    paths(value)
  );
  assert.equal(result.failure_kind, "config_conflict");
  assert.equal(await fs.readFile(configPath, "utf8"), source);
});

test("initializer recovers registration from a complete existing environment", async () => {
  const value = await fixture();
  const configPath = path.join(value.agentProject, ".codex", "config.toml");
  const envPath = path.join(value.skill, ".env.mcpshell");
  const missing = await runInitializer(
    { command: "apply", identity: "workspace_bridge" },
    paths(value)
  );
  assert.equal(missing.failure_kind, "config_invalid");
  await assert.rejects(fs.access(configPath));

  const invalidEnvironment = "MCPSHELL_BACKEND_HANDLE=fixture\n";
  await fs.writeFile(envPath, invalidEnvironment);
  const invalid = await runInitializer(
    { command: "apply", identity: "workspace_bridge" },
    paths(value)
  );
  assert.equal(invalid.failure_kind, "config_invalid");
  assert.equal(await fs.readFile(envPath, "utf8"), invalidEnvironment);
  await assert.rejects(fs.access(configPath));

  const environment =
    `MCPSHELL_BACKEND_HANDLE=${value.bridgeConfig.backendHandle}\n` +
    `MCPSHELL_PROJECT_ROOT=${value.bridgeConfig.projectRoot}\n` +
    `MCPSHELL_STAGING_ROOT=${value.bridgeConfig.stagingRoot}\n`;
  await fs.writeFile(envPath, environment);
  const request = { command: "preview" as const, identity: "workspace_bridge" };

  const preview = await runInitializer(request, paths(value));
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.actions, [
    {
      action: "unchanged",
      resource: "skills/mcpshell-workspace-tools/.env.mcpshell"
    },
    { action: "create", resource: ".codex/config.toml" }
  ]);
  assert.doesNotMatch(JSON.stringify(preview), new RegExp(value.project, "u"));
  await assert.rejects(fs.access(configPath));

  const applied = await runInitializer(
    { command: "apply", identity: "workspace_bridge" },
    paths(value)
  );
  assert.equal(applied.wrote, true);
  assert.equal(await fs.readFile(envPath, "utf8"), environment);
  assert.match(
    await fs.readFile(configPath, "utf8"),
    /\[mcp_servers\.workspace_bridge\]/u
  );
});

test("initializer previews and applies the same update actions", async () => {
  const value = await fixture();
  const configPath = path.join(value.agentProject, ".codex", "config.toml");
  const envPath = path.join(value.skill, ".env.mcpshell");
  const oldEnvironment =
    "MCPSHELL_BACKEND_HANDLE=old\n" +
    "MCPSHELL_PROJECT_ROOT=/old/project\n" +
    "MCPSHELL_STAGING_ROOT=/old/staging\n";
  const oldRegistration =
    "# Managed by mcpshell-workspace-bridge: workspace_bridge\n" +
    "[mcp_servers.workspace_bridge]\n" +
    'command = "old"\n';
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, oldRegistration);
  await fs.writeFile(envPath, oldEnvironment);
  const request = {
    command: "preview" as const,
    config: value.bridgeConfig,
    identity: "workspace_bridge"
  };

  const preview = await runInitializer(request, paths(value));
  const expectedActions = [
    {
      action: "update" as const,
      resource: "skills/mcpshell-workspace-tools/.env.mcpshell"
    },
    { action: "update" as const, resource: ".codex/config.toml" }
  ];
  assert.deepEqual(preview.actions, expectedActions);
  assert.doesNotMatch(JSON.stringify(preview), /old|\/old\/project/u);
  assert.equal(await fs.readFile(envPath, "utf8"), oldEnvironment);
  assert.equal(await fs.readFile(configPath, "utf8"), oldRegistration);

  const applied = await runInitializer(
    { ...request, command: "apply" },
    paths(value)
  );
  assert.deepEqual(applied.actions, expectedActions);
  assert.equal(applied.wrote, true);
  assert.equal(
    await fs.readFile(envPath, "utf8"),
    `MCPSHELL_BACKEND_HANDLE=fixture\nMCPSHELL_PROJECT_ROOT=${value.project}\nMCPSHELL_STAGING_ROOT=${value.staging}\n`
  );
  assert.match(await fs.readFile(configPath, "utf8"), /command = "mcpshell"/u);
});

test("initializer requires complete CLI configuration flags", () => {
  const omitted = readCliRequest([
    "node",
    "init-mcpshell-workspace.mjs",
    "preview",
    "--identity",
    "workspace_bridge"
  ]);
  assert.equal(omitted.config, undefined);
  assert.throws(
    () =>
      readCliRequest([
        "node",
        "init-mcpshell-workspace.mjs",
        "apply",
        "--identity",
        "workspace_bridge",
        "--backend",
        "fixture"
      ]),
    /must be provided together/u
  );
});

test("initializer rejects another owned identity until it is removed", async () => {
  const value = await fixture();
  const configPath = path.join(value.agentProject, ".codex", "config.toml");
  const envPath = path.join(value.skill, ".env.mcpshell");
  const oldEnvironment =
    "MCPSHELL_BACKEND_HANDLE=old\n" +
    "MCPSHELL_PROJECT_ROOT=/old/project\n" +
    "MCPSHELL_STAGING_ROOT=/old/staging\n";
  const oldRegistration =
    "# Managed by mcpshell-workspace-bridge: old_workspace\n" +
    "[mcp_servers.old_workspace]\n" +
    'command = "mcpshell"\n' +
    'args = ["mcp", "--tools", "skills/mcpshell-workspace-tools/references/mcpshell-tools.yaml"]\n';
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, oldRegistration);
  await fs.writeFile(envPath, oldEnvironment);

  for (const command of ["preview", "apply"] as const) {
    const result = await runInitializer(
      {
        command,
        config: value.bridgeConfig,
        identity: "workspace_bridge"
      },
      paths(value)
    );
    assert.equal(result.failure_kind, "config_conflict");
    assert.equal(await fs.readFile(configPath, "utf8"), oldRegistration);
    assert.equal(await fs.readFile(envPath, "utf8"), oldEnvironment);
  }

  const removal = await runInitializer(
    { command: "remove", identity: "old_workspace" },
    paths(value)
  );
  assert.equal(removal.ok, true);
  assert.equal(await fs.readFile(configPath, "utf8"), "");

  const switched = await runInitializer(
    {
      command: "apply",
      config: value.bridgeConfig,
      identity: "workspace_bridge"
    },
    paths(value)
  );
  assert.equal(switched.ok, true);
  assert.match(
    await fs.readFile(configPath, "utf8"),
    /\[mcp_servers\.workspace_bridge\]/u
  );
});
