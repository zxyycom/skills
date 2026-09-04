import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { McpShellStdioSmokeClient } from "./mcpshell-stdio-smoke.ts";
import { createBridgeFixture, type BridgeFixture } from "./support.ts";

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

type LocalhostSshd = Readonly<{
  backendHandle: string;
  cleanup(): Promise<void>;
  sshDirectory: string;
}>;

function requireObject(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    assert.fail(`${label} must be an object`);
  }
  return value as JsonObject;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\\"'\\\"'")}'`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function reserveLoopbackPort(): Promise<number> {
  const server = net.createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        server.close(() =>
          reject(new Error("could not reserve a loopback port"))
        );
        return;
      }
      server.close((error) => {
        if (error === undefined) {
          resolve(address.port);
        } else {
          reject(error);
        }
      });
    });
  });
}

async function stopSshd(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }
  const exited = new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
  });
  child.kill("SIGTERM");
  await Promise.race([exited, delay(2_000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

async function createLocalhostSshd(
  fixture: BridgeFixture
): Promise<LocalhostSshd> {
  const sshDirectory = path.join(path.dirname(fixture.project), "loopback-ssh");
  const hostKey = path.join(sshDirectory, "host_ed25519");
  const clientKey = path.join(sshDirectory, "client_ed25519");
  const authorizedKeys = path.join(sshDirectory, "authorized_keys");
  const knownHosts = path.join(sshDirectory, "known_hosts");
  const clientConfig = path.join(sshDirectory, "ssh_config");
  const serverConfig = path.join(sshDirectory, "sshd_config");
  const sshBin = path.join(sshDirectory, "bin", "ssh");
  const backendHandle = "mcpshell-loopback";
  const port = await reserveLoopbackPort();
  await fs.mkdir(path.dirname(sshBin), { mode: 0o700, recursive: true });
  await fs.chmod(sshDirectory, 0o700);
  for (const keyPath of [hostKey, clientKey]) {
    await execFileAsync("ssh-keygen", [
      "-q",
      "-t",
      "ed25519",
      "-N",
      "",
      "-f",
      keyPath
    ]);
  }
  const clientPublicKey = await fs.readFile(`${clientKey}.pub`, "utf8");
  const hostPublicKey = await execFileAsync("ssh-keygen", [
    "-y",
    "-f",
    hostKey
  ]);
  await fs.writeFile(authorizedKeys, clientPublicKey, { mode: 0o600 });
  await fs.writeFile(
    knownHosts,
    `[127.0.0.1]:${port} ${hostPublicKey.stdout.trim()}\n`,
    { mode: 0o600 }
  );
  await fs.writeFile(
    clientConfig,
    [
      `Host ${backendHandle}`,
      "  HostName 127.0.0.1",
      `  Port ${port}`,
      `  User ${os.userInfo().username}`,
      `  IdentityFile ${clientKey}`,
      "  IdentitiesOnly yes",
      "  BatchMode yes",
      "  PreferredAuthentications publickey",
      "  StrictHostKeyChecking yes",
      `  UserKnownHostsFile ${knownHosts}`,
      "  GlobalKnownHostsFile /dev/null",
      "  ControlMaster no",
      "  LogLevel ERROR",
      ""
    ].join("\n"),
    { mode: 0o600 }
  );
  await fs.writeFile(
    serverConfig,
    [
      `Port ${port}`,
      "ListenAddress 127.0.0.1",
      `HostKey ${hostKey}`,
      `AuthorizedKeysFile ${authorizedKeys}`,
      `PidFile ${path.join(sshDirectory, "sshd.pid")}`,
      "PasswordAuthentication no",
      "KbdInteractiveAuthentication no",
      "UsePAM no",
      "PermitRootLogin prohibit-password",
      "PermitUserRC no",
      "PubkeyAuthentication yes",
      "StrictModes no",
      "AllowTcpForwarding no",
      "X11Forwarding no",
      "LogLevel ERROR",
      ""
    ].join("\n"),
    { mode: 0o600 }
  );
  await fs.writeFile(
    sshBin,
    `#!/bin/sh\nexec /usr/bin/ssh -F ${shellQuote(clientConfig)} "$@"\n`,
    { mode: 0o700 }
  );
  const sshd = spawn("/usr/sbin/sshd", ["-D", "-e", "-f", serverConfig], {
    stdio: ["ignore", "ignore", "pipe"]
  });
  let sshdLog = "";
  sshd.stderr.on("data", (chunk: Buffer) => {
    sshdLog = `${sshdLog}${chunk.toString("utf8")}`.slice(-8_192);
  });
  try {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (sshd.exitCode !== null) {
        throw new Error(`temporary sshd exited: ${sshdLog}`);
      }
      try {
        await execFileAsync("/usr/bin/ssh", [
          "-F",
          clientConfig,
          "-T",
          backendHandle,
          "true"
        ]);
        return {
          backendHandle,
          cleanup: () => stopSshd(sshd),
          sshDirectory
        };
      } catch {
        await delay(50);
      }
    }
    throw new Error(
      `temporary sshd did not accept public-key authentication: ${sshdLog}`
    );
  } catch (error) {
    await stopSshd(sshd);
    throw error;
  }
}

function workspaceEnvelope(value: unknown, label: string): JsonObject {
  const result = requireObject(value, `${label} tools/call result`);
  const content = result.content;
  if (!Array.isArray(content) || content.length !== 1) {
    assert.fail(`${label} tools/call must return exactly one content item`);
  }
  const textContent = requireObject(content[0], `${label} tools/call content`);
  if (textContent.type !== "text" || typeof textContent.text !== "string") {
    assert.fail(`${label} tools/call content must be text`);
  }
  return requireObject(JSON.parse(textContent.text), `${label} envelope`);
}

function localhostE2ESkip(): false | string {
  if (!localhostSshSmokeEnabled) {
    return "set MCPSHELL_LOCALHOST_SSH_SMOKE=1 to run the local OpenSSH smoke";
  }
  if (mcpshell.length === 0) {
    return "set MCPSHELL_BIN to a real MCPShell executable for the localhost E2E smoke";
  }
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
