import fs from "node:fs/promises";

export async function observeSourceReads<T>(
  targets: readonly string[],
  action: (counts: ReadonlyMap<string, number>) => Promise<T>
): Promise<T> {
  const original = fs.open;
  const counts = new Map(targets.map((target) => [target, 0]));
  fs.open = (async (...args: Parameters<typeof fs.open>) => {
    const target = String(args[0]);
    if (counts.has(target)) counts.set(target, counts.get(target)! + 1);
    return await original(...args);
  }) as typeof fs.open;
  try {
    return await action(counts);
  } finally {
    fs.open = original;
  }
}
