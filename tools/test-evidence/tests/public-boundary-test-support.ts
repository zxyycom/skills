import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

export type CliResult = Readonly<{
  code: number | null;
  stderr: string;
  stdout: string;
}>;

type NodeScope = Readonly<{
  run: (
    args: readonly string[],
    onStdout?: (chunk: string) => void
  ) => Promise<CliResult | null>;
  close: () => Promise<void>;
}>;

function nodeScope(root: string): NodeScope {
  const running = new Map<
    ReturnType<typeof spawn>,
    Promise<CliResult | null>
  >();
  let cancelled = false;
  return {
    async run(args: readonly string[], onStdout?: (chunk: string) => void) {
      if (cancelled) return null;
      const child = spawn("node", [...args], {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"]
      });
      const result = new Promise<CliResult | null>((resolve, reject) => {
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          stdout += chunk;
          onStdout?.(chunk);
        });
        child.stderr.on("data", (chunk: string) => (stderr += chunk));
        let failure: Error | undefined;
        child.once("error", (error) => {
          failure = error;
        });
        child.once("close", (code) => {
          // Bun 超时后可能恢复旧 callback，且不 abort TestContext.signal；
          // 清理取消不是 CLI 结果，不能将其当作 code: null 继续断言。
          if (cancelled) resolve(null);
          else if (failure !== undefined) reject(failure);
          else resolve({ code, stderr, stdout });
        });
      });
      running.set(child, result);
      try {
        return await result;
      } finally {
        running.delete(child);
      }
    },
    async close() {
      cancelled = true;
      for (const child of running.keys()) child.kill("SIGKILL");
      await Promise.allSettled(running.values());
    }
  };
}

export async function fixture(context: TestContext) {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), "test-evidence-public-")
  );
  const root = path.join(parent, "workspace");
  const node = nodeScope(root);
  context.after(async () => {
    await node.close();
    await fs.rm(parent, { force: true, recursive: true });
  });
  const cases = path.join(root, "docs/test-evidence/cases");
  await fs.mkdir(cases, { recursive: true });
  await fs.writeFile(
    path.join(cases, "alpha.md"),
    "### Case PUBLIC-BOUNDARY-ALPHA-001: alpha Case\n\nTests:\n- `test:alpha`\n- `test:shared`\n\nTags:\n- `alpha`\n\nContract:\n- alpha remains queryable\n\nProves:\n- alpha is returned by exact filters\n"
  );
  await fs.writeFile(
    path.join(cases, "beta.md"),
    "### Case PUBLIC-BOUNDARY-BETA-001: beta Case\n\nTests:\n- `test:beta`\n- `test:shared`\n\nTags:\n- `alpha`\n- `beta`\n\nContract:\n- authoritative needle stays searchable\n\nProves:\n- search returns the authoritative Case body\n"
  );
  return { root, node };
}
