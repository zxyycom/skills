import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { McpShellStdioSmokeClient } from "./mcpshell-stdio-smoke.ts";
import { createBridgeFixture, fixtureSsh } from "./support.ts";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const distributedSkill = path.join(
  repositoryRoot,
  "skills",
  "mcpshell-workspace-tools"
);
const toolNames = [
  "workspace_shell",
  "workspace_apply_patch",
  "workspace_put_file",
  "workspace_get_file"
] as const;

type JsonObject = Readonly<Record<string, unknown>>;
type ToolDefinition = Readonly<{
  inputSchema: JsonObject;
  name: string;
}>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): JsonObject {
  if (!isJsonObject(value)) {
    assert.fail(`${label} must be an object`);
  }
  return value;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    assert.fail(`${label} must be an array`);
  }
  return value;
}

function requireTools(value: unknown): ToolDefinition[] {
  const result = requireObject(value, "tools/list result");
  const listedTools = requireArray(result.tools, "tools/list tools");
  return listedTools.map((tool, index) => {
    const record = requireObject(tool, `tools[${index}]`);
    assert.equal(typeof record.name, "string", `tools[${index}].name`);
    return {
      inputSchema: requireObject(
        record.inputSchema,
        `tools[${index}].inputSchema`
      ),
      name: record.name as string
    };
  });
}

function assertInputSchema(
  tool: ToolDefinition,
  expectedProperties: Readonly<
    Record<string, Readonly<{ default?: unknown; type: string }>>
  >,
  required: readonly string[]
): void {
  const schema = tool.inputSchema;
  assert.equal(schema.type, "object", `${tool.name} input schema type`);
  const properties = requireObject(
    schema.properties,
    `${tool.name} properties`
  );
  assert.deepEqual(
    Object.keys(properties).sort(),
    Object.keys(expectedProperties).sort()
  );
  const actualRequired = requireArray(
    schema.required,
    `${tool.name} required`
  ).map((value, index) => {
    assert.equal(typeof value, "string", `${tool.name} required[${index}]`);
    return value as string;
  });
  assert.deepEqual([...actualRequired].sort(), [...required].sort());
  for (const [name, expected] of Object.entries(expectedProperties)) {
    const property = requireObject(properties[name], `${tool.name}.${name}`);
    assert.equal(property.type, expected.type, `${tool.name}.${name} type`);
    if ("default" in expected) {
      assert.equal(
        property.default,
        expected.default,
        `${tool.name}.${name} default`
      );
    }
  }
  assert.equal(
    "backend" in properties,
    false,
    `${tool.name} does not expose backend`
  );
  assert.equal(
    "project_root" in properties,
    false,
    `${tool.name} does not expose project root`
  );
}

function assertGeneratedWorkspaceSchemas(tools: ToolDefinition[]): void {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  assert.equal(
    byName.size,
    toolNames.length,
    "tools/list has no duplicate names"
  );
  assert.deepEqual([...byName.keys()].sort(), [...toolNames].sort());
  const tool = (name: (typeof toolNames)[number]): ToolDefinition => {
    const value = byName.get(name);
    if (value === undefined) {
      assert.fail(`tools/list omitted ${name}`);
    }
    return value;
  };
  assertInputSchema(tool("workspace_shell"), { command: { type: "string" } }, [
    "command"
  ]);
  assertInputSchema(
    tool("workspace_apply_patch"),
    { patch: { type: "string" } },
    ["patch"]
  );
  for (const name of ["workspace_put_file", "workspace_get_file"] as const) {
    assertInputSchema(
      tool(name),
      {
        destination_path: { type: "string" },
        replace: { default: false, type: "boolean" },
        source_path: { type: "string" }
      },
      ["source_path", "destination_path"]
    );
  }
}

function workspaceEnvelope(value: unknown): JsonObject {
  const result = requireObject(value, "tools/call result");
  const [content] = requireArray(result.content, "tools/call content");
  const textContent = requireObject(content, "tools/call text content");
  assert.equal(textContent.type, "text", "tools/call content type");
  assert.equal(typeof textContent.text, "string", "tools/call content text");
  return requireObject(
    JSON.parse(textContent.text as string),
    "workspace shell envelope"
  );
}

async function copyGeneratedSkill(targetSkill: string): Promise<void> {
  await fs.mkdir(path.join(targetSkill, "scripts"), { recursive: true });
  await fs.copyFile(
    path.join(distributedSkill, "references", "mcpshell-tools.yaml"),
    path.join(targetSkill, "references", "mcpshell-tools.yaml")
  );
  await fs.copyFile(
    path.join(distributedSkill, "scripts", "mcpshell-workspace.mjs"),
    path.join(targetSkill, "scripts", "mcpshell-workspace.mjs")
  );
}

const mcpshell = process.env.MCPSHELL_BIN ?? "";

test(
  "MCPShell stdio exposes the generated fixed-root tools and one read-only shell call",
  {
    skip:
      mcpshell.length === 0
        ? "set MCPSHELL_BIN to an existing MCPShell executable to run this smoke"
        : false
  },
  async () => {
    const fixture = await createBridgeFixture();
    let client: McpShellStdioSmokeClient | undefined;
    try {
      await copyGeneratedSkill(fixture.skill);
      await fs.writeFile(
        path.join(fixture.skill, ".env.mcpshell"),
        [
          `MCPSHELL_BACKEND_HANDLE=${fixture.bridgeConfig.backendHandle}`,
          `MCPSHELL_PROJECT_ROOT=${fixture.bridgeConfig.projectRoot}`,
          `MCPSHELL_STAGING_ROOT=${fixture.bridgeConfig.stagingRoot}`,
          ""
        ].join("\n")
      );
      const toolsPath = path.join(
        fixture.skill,
        "references",
        "mcpshell-tools.yaml"
      );
      const env = {
        ...process.env,
        PATH: `${path.dirname(fixtureSsh(fixture))}${path.delimiter}${process.env.PATH ?? ""}`
      };
      await execFileAsync(mcpshell, ["validate", "--tools", toolsPath], {
        cwd: fixture.agentProject,
        env,
        maxBuffer: 1024 * 1024
      });

      client = new McpShellStdioSmokeClient(mcpshell, toolsPath, {
        cwd: fixture.agentProject,
        env
      });
      const initialized = requireObject(
        await client.initialize(),
        "initialize result"
      );
      assert.equal(
        typeof initialized.protocolVersion,
        "string",
        "initialize protocol version"
      );
      client.initialized();
      const tools = requireTools(await client.listTools());
      assertGeneratedWorkspaceSchemas(tools);

      const shell = workspaceEnvelope(
        await client.callReadOnlyShell(`printf 'mcp-smoke:%s\\n' "$PWD"`)
      );
      assert.equal(shell.operation, "workspace_shell");
      assert.equal(shell.ok, true);
      assert.equal(shell.failure_kind, null);
      assert.equal(shell.stdout, `mcp-smoke:${fixture.project}\n`);

      await client.close();
      client = undefined;
    } finally {
      await client?.terminate();
      await fixture.cleanup();
    }
  }
);
