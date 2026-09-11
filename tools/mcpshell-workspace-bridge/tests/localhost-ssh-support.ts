import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { BridgeFixture } from "./support.ts";

const execFileAsync = promisify(execFile);
type JsonObject = Readonly<Record<string, unknown>>;

export type LocalhostSshd = Readonly<{
  backendHandle: string;
  cleanup(): Promise<void>;
  sshDirectory: string;
}>;

export function requireObject(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    assert.fail(`${label} must be an object`);
  }
  return value as JsonObject;
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\\"'\\\"'")}'`;
}

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function reserveLoopbackPort(): Promise<number> {
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

export async function stopSshd(child: ChildProcess): Promise<void> {
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

export async function createLocalhostSshd(
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
