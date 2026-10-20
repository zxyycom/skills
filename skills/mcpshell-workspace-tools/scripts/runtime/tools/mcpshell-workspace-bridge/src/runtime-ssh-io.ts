/*
 * Synced TypeScript runtime; repository maintenance edits tools/mcpshell-workspace-bridge/src/runtime-ssh-io.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/mcpshell-workspace-bridge/src/runtime-ssh-io.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/mcpshell-workspace-bridge/src/runtime-ssh-io.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/mcpshell-workspace-tools
 * Rebuild: bun run sync:mcpshell-workspace-bridge
 */
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import type { OutputCollector } from "./runtime-ssh-output.ts";

export function wireSshIo(
  child: ChildProcessWithoutNullStreams,
  options: Readonly<{
    input?: Buffer | ReturnType<typeof createReadStream>;
    output?: ReturnType<typeof createWriteStream>;
  }>,
  collector: OutputCollector
): void {
  child.stdin.on("error", () => undefined);
  child.stderr.on("data", (chunk: Buffer) =>
    collector.capture("stderr", Buffer.from(chunk))
  );
  if (options.output === undefined)
    child.stdout.on("data", (chunk: Buffer) =>
      collector.capture("stdout", Buffer.from(chunk))
    );
  else child.stdout.pipe(options.output);
  if (options.input === undefined) child.stdin.end();
  else if (Buffer.isBuffer(options.input)) child.stdin.end(options.input);
  else options.input.pipe(child.stdin);
}
