import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const requestTimeoutMs = 10_000;
const stderrLimit = 64 * 1024;
const shutdownGraceMs = 2_000;

type JsonObject = Readonly<Record<string, unknown>>;

type PendingRequest = Readonly<{
  reject(error: Error): void;
  resolve(result: unknown): void;
  timeout: ReturnType<typeof setTimeout>;
}>;

type ProcessExit = Readonly<{
  code: number | null;
  signal: NodeJS.Signals | null;
}>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stderrWithLimit(current: string, chunk: Buffer): string {
  if (current.length >= stderrLimit) {
    return current;
  }
  return `${current}${chunk.toString("utf8")}`.slice(0, stderrLimit);
}

/**
 * Test-only MCP stdio client for this smoke's fixed interaction sequence. It is
 * intentionally not a reusable MCP client or a product dependency.
 */
export class McpShellStdioSmokeClient {
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #exited: Promise<ProcessExit>;
  readonly #pending = new Map<number, PendingRequest>();
  #exit: ProcessExit | null = null;
  #nextRequestId = 1;
  #stderr = "";
  #stdoutRemainder = "";

  constructor(
    executable: string,
    toolsPath: string,
    options: Readonly<{ cwd: string; env: NodeJS.ProcessEnv }>
  ) {
    this.#child = spawn(executable, ["mcp", "--tools", toolsPath], {
      cwd: options.cwd,
      env: options.env,
      stdio: "pipe"
    });
    this.#exited = new Promise((resolve) => {
      this.#child.once("close", (code, signal) => {
        const exit = { code, signal };
        this.#exit = exit;
        this.#rejectPending(this.#failure("MCPShell stdio server exited"));
        resolve(exit);
      });
    });
    this.#child.stdout.setEncoding("utf8");
    this.#child.stdout.on("data", (chunk: string) => this.#receive(chunk));
    this.#child.stderr.on("data", (chunk: Buffer) => {
      this.#stderr = stderrWithLimit(this.#stderr, chunk);
    });
    this.#child.once("error", (error: Error) => {
      this.#rejectPending(
        this.#failure(`MCPShell stdio server failed: ${error.message}`)
      );
    });
  }

  async initialize(): Promise<unknown> {
    return this.#request("initialize", {
      capabilities: {},
      clientInfo: { name: "mcpshell-workspace-bridge-smoke", version: "1" },
      protocolVersion: "2024-11-05"
    });
  }

  initialized(): void {
    this.#notify("notifications/initialized", {});
  }

  async listTools(): Promise<unknown> {
    return this.#request("tools/list", {});
  }

  async callReadOnlyShell(command: string): Promise<unknown> {
    return this.callTool("workspace_shell", { command });
  }

  async callTool(name: string, args: JsonObject): Promise<unknown> {
    return this.#request("tools/call", { arguments: args, name });
  }

  async close(): Promise<void> {
    this.#child.stdin.end();
    if (await this.#exitsWithin(shutdownGraceMs)) {
      if (this.#exit?.code !== 0 || this.#exit.signal !== null) {
        throw this.#failure(
          "MCPShell stdio server did not exit cleanly after stdin closed"
        );
      }
      return;
    }
    this.#child.kill("SIGTERM");
    if (await this.#exitsWithin(shutdownGraceMs)) {
      throw this.#failure(
        "MCPShell stdio server did not exit after stdin closed"
      );
    }
    this.#child.kill("SIGKILL");
    await this.#exited;
    throw this.#failure(
      "MCPShell stdio server required SIGKILL during cleanup"
    );
  }

  async terminate(): Promise<void> {
    if (this.#exit !== null) {
      return;
    }
    this.#child.stdin.end();
    if (await this.#exitsWithin(shutdownGraceMs)) {
      return;
    }
    this.#child.kill("SIGTERM");
    if (await this.#exitsWithin(shutdownGraceMs)) {
      return;
    }
    this.#child.kill("SIGKILL");
    await this.#exited;
  }

  #notify(method: string, params: JsonObject): void {
    this.#write({ jsonrpc: "2.0", method, params });
  }

  #request(method: string, params: JsonObject): Promise<unknown> {
    if (this.#exit !== null) {
      return Promise.reject(
        this.#failure("cannot call an exited MCPShell server")
      );
    }
    const id = this.#nextRequestId;
    this.#nextRequestId += 1;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        reject(this.#failure(`MCP request ${method} timed out`));
      }, requestTimeoutMs);
      this.#pending.set(id, { reject, resolve, timeout });
      try {
        this.#write({ id, jsonrpc: "2.0", method, params });
      } catch (error) {
        clearTimeout(timeout);
        this.#pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  #write(message: JsonObject): void {
    if (this.#exit !== null || this.#child.stdin.destroyed) {
      throw this.#failure("MCPShell stdio input is unavailable");
    }
    this.#child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  #receive(chunk: string): void {
    this.#stdoutRemainder += chunk;
    let newline = this.#stdoutRemainder.indexOf("\n");
    while (newline !== -1) {
      const line = this.#stdoutRemainder.slice(0, newline).trim();
      this.#stdoutRemainder = this.#stdoutRemainder.slice(newline + 1);
      if (line.length > 0) {
        this.#receiveMessage(line);
      }
      newline = this.#stdoutRemainder.indexOf("\n");
    }
  }

  #receiveMessage(line: string): void {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      this.#rejectPending(
        this.#failure(
          `MCPShell stdio emitted non-JSON output: ${line.slice(0, 200)}`
        )
      );
      return;
    }
    if (!isJsonObject(message) || typeof message.id !== "number") {
      return;
    }
    const pending = this.#pending.get(message.id);
    if (pending === undefined) {
      return;
    }
    clearTimeout(pending.timeout);
    this.#pending.delete(message.id);
    if ("error" in message) {
      pending.reject(
        this.#failure(`MCP request failed: ${JSON.stringify(message.error)}`)
      );
      return;
    }
    pending.resolve(message.result);
  }

  #rejectPending(error: Error): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.#pending.clear();
  }

  #failure(message: string): Error {
    const exit =
      this.#exit === null
        ? "still running"
        : `exit=${String(this.#exit.code)} signal=${String(this.#exit.signal)}`;
    const stderr = this.#stderr.length === 0 ? "<empty>" : this.#stderr;
    return new Error(`${message}; ${exit}; stderr:\n${stderr}`);
  }

  async #exitsWithin(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), timeoutMs);
      void this.#exited.then(() => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
  }
}
