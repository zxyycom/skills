import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import path from "node:path";

export type Summary = Readonly<Record<string, unknown>>;
export type Operation = () => Promise<Summary>;

export async function measure(
  domain: "decision" | "investigation",
  operation: string,
  size: number,
  run: Operation
): Promise<void> {
  const heapBeforeBytes = process.memoryUsage().heapUsed;
  const cpuBefore = process.cpuUsage();
  const start = performance.now();
  const summary = await run();
  const elapsedMs = performance.now() - start;
  const cpu = process.cpuUsage(cpuBefore);
  assert.ok(summary.status === "ok" || summary.status === "error");
  process.stdout.write(
    JSON.stringify({
      domain,
      operation,
      size,
      elapsedMs,
      cpuUserMs: cpu.user / 1000,
      cpuSystemMs: cpu.system / 1000,
      maxRssKiB: process.resourceUsage().maxRSS,
      heapBeforeBytes,
      heapAfterBytes: process.memoryUsage().heapUsed,
      summary
    }) + "\n"
  );
}

export function argumentsForWorker(): Readonly<{
  operation: string;
  root: string;
  size: number;
}> {
  const [operation, root, sizeText] = process.argv.slice(2);
  assert.ok(operation !== undefined && operation.length > 0);
  assert.ok(root !== undefined && path.isAbsolute(root));
  assert.ok(sizeText !== undefined && /^[1-9][0-9]*$/u.test(sizeText));
  const size = Number(sizeText);
  assert.ok(Number.isSafeInteger(size) && size >= 10 && size <= 100000);
  return { operation, root, size };
}
