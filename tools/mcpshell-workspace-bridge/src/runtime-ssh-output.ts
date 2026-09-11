import { capturedTextLimit } from "./shared.ts";

export type OutputCollector = Readonly<{
  capture: (stream: "stderr" | "stdout", chunk: Buffer) => void;
  result: () => Readonly<{
    outputLimit: "stderr" | "stdout" | null;
    stderr: Buffer;
    stdout: Buffer;
  }>;
}>;

function capturedChunk(chunk: Buffer, remaining: number): Buffer | null {
  return remaining > 0 ? Buffer.from(chunk.subarray(0, remaining)) : null;
}

export function outputCollector(onLimit: () => void): OutputCollector {
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  const bytes = { stderr: 0, stdout: 0 };
  let outputLimit: "stderr" | "stdout" | null = null;
  const capture = (stream: "stderr" | "stdout", chunk: Buffer): void => {
    const remaining = capturedTextLimit - bytes[stream];
    const captured = capturedChunk(chunk, remaining);
    if (captured !== null)
      (stream === "stdout" ? stdout : stderr).push(captured);
    bytes[stream] += Math.min(chunk.length, Math.max(remaining, 0));
    if (chunk.length <= remaining || outputLimit !== null) return;
    outputLimit = stream;
    onLimit();
  };
  return {
    capture,
    result: () => ({
      outputLimit,
      stderr: Buffer.concat(stderr),
      stdout: Buffer.concat(stdout)
    })
  };
}
