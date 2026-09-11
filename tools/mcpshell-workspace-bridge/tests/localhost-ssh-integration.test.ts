import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { McpShellStdioSmokeClient } from "./mcpshell-stdio-smoke.ts";
import { createBridgeFixture } from "./support.ts";
import {
  createLocalhostSshd,
  requireObject,
  type LocalhostSshd
} from "./localhost-ssh-support.ts";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const distributedRuntime = path.join(
  repositoryRoot,
  "skills",
  "mcpshell-workspace-tools",
  "scripts",
  "mcpshell-workspace.mjs"
);
const distributedTools = path.join(
  repositoryRoot,
  "skills",
  "mcpshell-workspace-tools",
  "references",
  "mcpshell-tools.yaml"
);
const localhostSshSmokeEnabled =
  process.env.MCPSHELL_LOCALHOST_SSH_SMOKE === "1";
const mcpshell = process.env.MCPSHELL_BIN ?? "";

type JsonObject = Readonly<Record<string, unknown>>;
function workspaceEnvelope(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    assert.fail(`${label} must be an object`);
  return value as JsonObject;
}
function localhostE2ESkip(): false | string {
  if (!localhostSshSmokeEnabled)
    return "set MCPSHELL_LOCALHOST_SSH_SMOKE=1 to run localhost OpenSSH smoke";
  if (mcpshell.length === 0)
    return "set MCPSHELL_BIN to run MCPShell localhost smoke";
  return false;
}

test(
  "localhost OpenSSH runs all generated workspace operations against isolated roots",
  {
    skip: localhostE2ESkip()
  },
  async () => {
    const fixture = await createBridgeFixture();
    let sshd: LocalhostSshd | undefined;
    let client: McpShellStdioSmokeClient | undefined;
    try {
      await fs.mkdir(path.join(fixture.skill, "scripts"), { recursive: true });
      await fs.copyFile(
        distributedRuntime,
        path.join(fixture.skill, "scripts", "mcpshell-workspace.mjs")
      );
      await fs.copyFile(
        distributedTools,
        path.join(fixture.skill, "references", "mcpshell-tools.yaml")
      );
      sshd = await createLocalhostSshd(fixture);
      await fs.writeFile(
        path.join(fixture.skill, ".env.mcpshell"),
        [
          `MCPSHELL_BACKEND_HANDLE=${sshd.backendHandle}`,
          `MCPSHELL_PROJECT_ROOT=${fixture.project}`,
          `MCPSHELL_STAGING_ROOT=${fixture.staging}`,
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
        PATH: `${path.join(sshd.sshDirectory, "bin")}${path.delimiter}${process.env.PATH ?? ""}`
      };
      const version = await execFileAsync(mcpshell, ["--version"], {
        cwd: fixture.agentProject,
        env,
        maxBuffer: 1024 * 1024
      });
      assert.notEqual(
        `${version.stdout}${version.stderr}`.trim(),
        "",
        "MCPShell --version must identify the executable used by this smoke"
      );
      await execFileAsync(mcpshell, ["validate", "--tools", toolsPath], {
        cwd: fixture.agentProject,
        env,
        maxBuffer: 1024 * 1024
      });
      client = new McpShellStdioSmokeClient(mcpshell, toolsPath, {
        cwd: fixture.agentProject,
        env
      });
      await client.initialize();
      client.initialized();

      const shell = workspaceEnvelope(
        await client.callTool("workspace_shell", {
          command: `printf 'loopback:%s\\n' "$PWD"`
        }),
        "workspace_shell"
      );
      assert.equal(shell.operation, "workspace_shell");
      assert.equal(shell.ok, true, JSON.stringify(shell));
      assert.equal(shell.stdout, `loopback:${fixture.project}\n`);

      const patch = workspaceEnvelope(
        await client.callTool("workspace_apply_patch", {
          patch:
            "diff --git a/tracked.txt b/tracked.txt\n--- a/tracked.txt\n+++ b/tracked.txt\n@@ -1 +1 @@\n-before\n+patched\n"
        }),
        "workspace_apply_patch"
      );
      assert.equal(patch.operation, "workspace_apply_patch");
      assert.equal(patch.ok, true, JSON.stringify(patch));
      assert.equal(
        await fs.readFile(path.join(fixture.project, "tracked.txt"), "utf8"),
        "patched\n"
      );

      const transferred = Buffer.from([0, 1, 2, 255, 10]);
      const transferredSha256 = createHash("sha256")
        .update(transferred)
        .digest("hex");
      await fs.writeFile(path.join(fixture.staging, "source.bin"), transferred);
      const put = workspaceEnvelope(
        await client.callTool("workspace_put_file", {
          destination_path: "from-agent.bin",
          source_path: "source.bin"
        }),
        "workspace_put_file"
      );
      assert.equal(put.operation, "workspace_put_file");
      assert.equal(put.ok, true, JSON.stringify(put));
      assert.equal(
        requireObject(put.evidence, "put evidence").bytes,
        transferred.length
      );
      assert.equal(
        requireObject(put.evidence, "put evidence").sha256,
        transferredSha256
      );
      assert.deepEqual(
        await fs.readFile(path.join(fixture.project, "from-agent.bin")),
        transferred
      );

      const get = workspaceEnvelope(
        await client.callTool("workspace_get_file", {
          destination_path: "received.bin",
          source_path: "from-agent.bin"
        }),
        "workspace_get_file"
      );
      assert.equal(get.operation, "workspace_get_file");
      assert.equal(get.ok, true, JSON.stringify(get));
      assert.equal(
        requireObject(get.evidence, "get evidence").bytes,
        transferred.length
      );
      assert.equal(
        requireObject(get.evidence, "get evidence").sha256,
        transferredSha256
      );
      assert.deepEqual(
        await fs.readFile(path.join(fixture.staging, "received.bin")),
        transferred
      );
      await client.close();
      client = undefined;
    } finally {
      await client?.terminate();
      await sshd?.cleanup();
      await fixture.cleanup();
    }
  }
);
