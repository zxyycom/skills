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
