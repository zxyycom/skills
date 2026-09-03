import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, test } from "node:test";
import { runInitializer } from "../src/initializer.ts";
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
  assert.equal((await runInitializer(request, paths(value))).ok, true);
  const once = await fs.readFile(configPath, "utf8");
  assert.match(once, /^# personal note/m);
  assert.match(once, /\[mcp_servers\.workspace_bridge\]/u);
  assert.doesNotMatch(once, new RegExp(value.bridgeConfig.projectRoot, "u"));
  assert.equal((await runInitializer(request, paths(value))).wrote, true);
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
