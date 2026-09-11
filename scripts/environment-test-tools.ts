import fs from "node:fs/promises";
import path from "node:path";
import type { CommandResult } from "./environment-test-process.ts";
import {
  run,
  workspaceRoot,
  writeExecutable
} from "./environment-test-process.ts";

type MetricToolMode = "missing" | "mismatch" | "probe-failure" | "ready";

type FakeToolOptions = Readonly<{
  bunVersion?: string;
  nodeVersion?: string;
  scc?: MetricToolMode;
}>;

export async function createFakeToolPath(
  parent: string,
  options: FakeToolOptions = {}
): Promise<string> {
  const bin = path.join(parent, "fake tools");
  await fs.mkdir(bin, { recursive: true });
  const metricTools = { scc: options.scc ?? "ready" };
  const tools = availableFakeTools(metricTools);
  const bunVersion = options.bunVersion ?? "1.3.14";
  const nodeVersion = options.nodeVersion ?? "24.18.0";
  if (process.platform === "win32") {
    await createWindowsFakeTools(
      bin,
      tools,
      metricTools,
      bunVersion,
      nodeVersion
    );
  } else {
    await createPosixFakeTools(
      bin,
      tools,
      metricTools,
      bunVersion,
      nodeVersion
    );
  }
  return bin;
}

function availableFakeTools(metricTools: { scc: MetricToolMode }): string[] {
  return [
    "node",
    "bun",
    "pnpm",
    "codegraph",
    ...(metricTools.scc === "missing" ? [] : ["scc"])
  ];
}

async function createWindowsFakeTools(
  bin: string,
  tools: readonly string[],
  metricTools: { scc: MetricToolMode },
  bunVersion: string,
  nodeVersion: string
): Promise<void> {
  const dispatcherPath = path.join(bin, "fake-tool.mjs");
  await fs.writeFile(
    dispatcherPath,
    windowsFakeToolDispatcher(metricTools, bunVersion, nodeVersion),
    "utf8"
  );
  for (const tool of tools) {
    await fs.writeFile(
      path.join(bin, `${tool}.cmd`),
      `@${quoteBatch(process.execPath)} ${quoteBatch(dispatcherPath)} ${tool} %*\r\n`,
      "utf8"
    );
  }
}

function windowsFakeToolDispatcher(
  metricTools: { scc: MetricToolMode },
  bunVersion: string,
  nodeVersion: string
): string {
  return [
    "const [tool, command] = process.argv.slice(2);",
    `if (tool === 'node' && command === '--version') console.log(${JSON.stringify(`v${nodeVersion}`)});`,
    `else if (tool === 'bun' && command === '--version') console.log(${JSON.stringify(bunVersion)});`,
    "else if (tool === 'pnpm' && command === '--version') console.log('11.7.0');",
    "else if (tool === 'pnpm' && command === 'list') console.log('[{}]');",
    "else if (tool === 'pnpm' && command === 'install') process.exit(0);",
    "else if (tool === 'codegraph' && command === '--version') console.log('codegraph 1.2.3');",
    "else if (tool === 'codegraph' && command === 'status') console.log(JSON.stringify({ initialized: true, lastIndexed: 'fixture' }));",
    "else if (tool === 'codegraph' && (command === 'init' || command === 'sync')) process.exit(0);",
    `else if (tool === 'scc' && command === '--version') { const mode = ${JSON.stringify(metricTools.scc)}; if (mode === 'mismatch') console.log('scc version 4.0.1'); else if (mode === 'probe-failure') { console.error('scc probe failed'); process.exit(2); } else console.log('scc version 4.0.0'); }`,
    "else { console.error(`unexpected ${tool} command: ${process.argv.slice(3).join(' ')}`); process.exit(2); }",
    ""
  ].join("\n");
}

function quoteBatch(value: string): string {
  return `"${value.replaceAll("%", "%%").replaceAll('"', '""')}"`;
}

async function createPosixFakeTools(
  bin: string,
  tools: readonly string[],
  metricTools: { scc: MetricToolMode },
  bunVersion: string,
  nodeVersion: string
): Promise<void> {
  const dispatcherPath = path.join(bin, "fake-tool");
  await writeExecutable(
    dispatcherPath,
    posixFakeToolDispatcher(metricTools, bunVersion, nodeVersion)
  );
  for (const tool of tools) await fs.link(dispatcherPath, path.join(bin, tool));
}

function posixFakeToolDispatcher(
  metricTools: { scc: MetricToolMode },
  bunVersion: string,
  nodeVersion: string
): string {
  return [
    "#!/bin/sh",
    "tool=${0##*/}",
    "command=$1",
    "shift",
    'case "$tool:$command" in',
    `  node:--version) printf '%s\\n' ${JSON.stringify(`v${nodeVersion}`)} ;;`,
    `  bun:--version) printf '%s\\n' ${JSON.stringify(bunVersion)} ;;`,
    "  pnpm:--version) printf '%s\\n' '11.7.0' ;;",
    "  pnpm:list) printf '%s\\n' '[{}]' ;;",
    "  pnpm:install) ;;",
    "  codegraph:--version) printf '%s\\n' 'codegraph 1.2.3' ;;",
    `  codegraph:status) printf '%s\\n' '${JSON.stringify({ initialized: true, lastIndexed: "fixture" })}' ;;`,
    "  codegraph:init|codegraph:sync) ;;",
    metricTools.scc === "probe-failure"
      ? "  scc:--version) printf '%s\\n' 'scc probe failed' >&2; exit 2 ;;"
      : `  scc:--version) printf '%s\\n' ${JSON.stringify(metricTools.scc === "mismatch" ? "scc version 4.0.1" : "scc version 4.0.0")} ;;`,
    '  *) printf \'unexpected %s command: %s\\n\' "$tool" "$*" >&2; exit 2 ;;',
    "esac",
    ""
  ].join("\n");
}

export function environmentWith(
  fakeToolPath: string,
  pathValue: string = process.env.PATH ?? ""
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${fakeToolPath}${path.delimiter}${pathValue}`
  };
}

export function runEnvironment(
  root: string,
  action: "check" | "setup",
  fakeToolPath: string,
  environment: NodeJS.ProcessEnv = environmentWith(fakeToolPath)
): CommandResult {
  return run(
    process.execPath,
    [path.join(root, "scripts", "environment.js"), action],
    root,
    environment
  );
}

export function systemCommandPaths(command: string): readonly string[] {
  const locator = process.platform === "win32" ? "where" : "which";
  const args = process.platform === "win32" ? [command] : ["-a", command];
  return run(locator, args, workspaceRoot)
    .stdout.split(/\r?\n/u)
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0);
}
